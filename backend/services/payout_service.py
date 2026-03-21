# SPDX-License-Identifier: MIT

import asyncio
import logging
import time
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timezone
from enum import Enum
import json

from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solders.message import to_bytes_versioned
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed, Finalized
from solana.rpc.types import TxOpts
from spl.token.async_client import AsyncToken
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import transfer_checked, TransferCheckedParams

from backend.database import get_db
from backend.models.bounties import BountyModel
from backend.models.payouts import PayoutModel, PayoutStatus
from backend.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


class PayoutError(Exception):
    """Base exception for payout operations"""
    pass


class InsufficientFundsError(PayoutError):
    """Raised when treasury has insufficient funds"""
    pass


class PayoutService:
    """Automated payout service with SPL token transfers and retry logic"""

    def __init__(self):
        self.rpc_client = AsyncClient(settings.SOLANA_RPC_URL)
        self.treasury_keypair = self._load_treasury_keypair()
        self.fndry_mint = Pubkey.from_string(settings.FNDRY_TOKEN_MINT)
        self.decimals = 6  # $FNDRY token decimals
        self.max_retries = 3
        self.base_delay = 2.0  # seconds

        # Payout locks to prevent double-spending
        self._payout_locks: Dict[str, float] = {}
        self.lock_timeout = 600  # 10 minutes

    def _load_treasury_keypair(self) -> Keypair:
        """Load treasury keypair from environment"""
        try:
            private_key = settings.TREASURY_PRIVATE_KEY
            return Keypair.from_base58_string(private_key)
        except Exception as e:
            logger.error(f"Failed to load treasury keypair: {e}")
            raise PayoutError(f"Treasury keypair configuration error: {e}")

    def _acquire_payout_lock(self, user_wallet: str, amount: int) -> bool:
        """Acquire payout lock to prevent double-spending"""
        lock_key = f"{user_wallet}:{amount}"
        current_time = time.time()

        # Clean expired locks
        expired_keys = [
            key for key, timestamp in self._payout_locks.items()
            if current_time - timestamp > self.lock_timeout
        ]
        for key in expired_keys:
            del self._payout_locks[key]

        # Check if already locked
        if lock_key in self._payout_locks:
            lock_age = current_time - self._payout_locks[lock_key]
            logger.warning(f"Payout already locked for {user_wallet} (age: {lock_age:.1f}s)")
            return False

        # Acquire lock
        self._payout_locks[lock_key] = current_time
        return True

    def _release_payout_lock(self, user_wallet: str, amount: int):
        """Release payout lock"""
        lock_key = f"{user_wallet}:{amount}"
        self._payout_locks.pop(lock_key, None)

    async def _get_token_account(self, wallet_pubkey: Pubkey) -> Optional[Pubkey]:
        """Get associated token account for wallet"""
        try:
            from spl.token.client import get_associated_token_address
            ata = get_associated_token_address(wallet_pubkey, self.fndry_mint)

            # Check if account exists
            account_info = await self.rpc_client.get_account_info(ata)
            if account_info.value is None:
                logger.info(f"Token account not found for {wallet_pubkey}")
                return None

            return ata
        except Exception as e:
            logger.error(f"Error getting token account for {wallet_pubkey}: {e}")
            return None

    async def _create_transfer_transaction(
        self,
        recipient: Pubkey,
        amount_tokens: int
    ) -> VersionedTransaction:
        """Create SPL token transfer transaction"""
        try:
            treasury_ata = await self._get_token_account(self.treasury_keypair.pubkey())
            recipient_ata = await self._get_token_account(recipient)

            if not treasury_ata:
                raise PayoutError("Treasury token account not found")
            if not recipient_ata:
                raise PayoutError(f"Recipient token account not found: {recipient}")

            # Create transfer instruction
            transfer_ix = transfer_checked(
                TransferCheckedParams(
                    program_id=TOKEN_PROGRAM_ID,
                    source=treasury_ata,
                    mint=self.fndry_mint,
                    dest=recipient_ata,
                    owner=self.treasury_keypair.pubkey(),
                    amount=amount_tokens,
                    decimals=self.decimals,
                    signers=[self.treasury_keypair.pubkey()]
                )
            )

            # Get recent blockhash
            recent_blockhash = await self.rpc_client.get_latest_blockhash()

            # Build transaction
            from solders.message import MessageV0
            from solders.transaction import VersionedTransaction

            message = MessageV0.try_compile(
                payer=self.treasury_keypair.pubkey(),
                instructions=[transfer_ix],
                address_lookup_table_accounts=[],
                recent_blockhash=recent_blockhash.value.blockhash,
            )

            transaction = VersionedTransaction(message, [self.treasury_keypair])
            return transaction

        except Exception as e:
            logger.error(f"Failed to create transfer transaction: {e}")
            raise PayoutError(f"Transaction creation failed: {e}")

    async def _send_with_retry(self, transaction: VersionedTransaction) -> str:
        """Send transaction with retry logic and exponential backoff"""
        last_error = None

        for attempt in range(self.max_retries):
            try:
                logger.info(f"Sending transaction (attempt {attempt + 1}/{self.max_retries})")

                # Send transaction
                response = await self.rpc_client.send_transaction(
                    transaction,
                    opts=TxOpts(
                        skip_confirmation=False,
                        skip_preflight=False,
                        preflight_commitment=Confirmed
                    )
                )

                if response.value:
                    tx_sig = str(response.value)
                    logger.info(f"Transaction sent successfully: {tx_sig}")
                    return tx_sig
                else:
                    raise PayoutError("Transaction send returned no signature")

            except Exception as e:
                last_error = e
                logger.warning(f"Transaction attempt {attempt + 1} failed: {e}")

                if attempt < self.max_retries - 1:
                    delay = self.base_delay ** (attempt + 1)
                    logger.info(f"Retrying in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)

        raise PayoutError(f"All {self.max_retries} transaction attempts failed. Last error: {last_error}")

    async def _confirm_transaction(self, signature: str, timeout: int = 60) -> bool:
        """Confirm transaction with polling"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                response = await self.rpc_client.get_signature_status(signature)

                if response.value and response.value.confirmation_status:
                    status = response.value.confirmation_status
                    if status in [Confirmed, Finalized]:
                        logger.info(f"Transaction confirmed: {signature}")
                        return True
                    elif response.value.err:
                        logger.error(f"Transaction failed: {signature} - {response.value.err}")
                        return False

                await asyncio.sleep(2)

            except Exception as e:
                logger.warning(f"Error checking transaction status: {e}")
                await asyncio.sleep(2)

        logger.warning(f"Transaction confirmation timeout: {signature}")
        return False

    def generate_solscan_link(self, signature: str) -> str:
        """Generate Solscan explorer link"""
        network = "devnet" if "devnet" in settings.SOLANA_RPC_URL else "mainnet"
        return f"https://solscan.io/tx/{signature}?cluster={network}"

    async def validate_wallet_address(self, wallet_address: str) -> bool:
        """Validate Solana wallet address format"""
        try:
            pubkey = Pubkey.from_string(wallet_address)
            # Check if it's a valid base58 string and proper length
            return len(str(pubkey)) == 44
        except Exception:
            return False

    async def process_payout(
        self,
        user_wallet: str,
        amount_fndry: Decimal,
        bounty_id: str,
        description: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Process a single payout
        Returns: (success, message, transaction_signature)
        """
        amount_tokens = int(amount_fndry * (10 ** self.decimals))

        # Validate wallet
        if not await self.validate_wallet_address(user_wallet):
            return False, f"Invalid wallet address: {user_wallet}", None

        # Acquire payout lock
        if not self._acquire_payout_lock(user_wallet, amount_tokens):
            return False, "Payout already in progress for this wallet", None

        try:
            recipient_pubkey = Pubkey.from_string(user_wallet)

            # Create payout record
            async with get_db() as db:
                payout = PayoutModel(
                    recipient_wallet=user_wallet,
                    amount_fndry=amount_fndry,
                    bounty_id=bounty_id,
                    status=PayoutStatus.PENDING,
                    description=description or f"Bounty completion payout",
                    created_at=datetime.now(timezone.utc)
                )
                db.add(payout)
                await db.commit()
                payout_id = payout.id

            # Update status to processing
            async with get_db() as db:
                payout = await db.get(PayoutModel, payout_id)
                payout.status = PayoutStatus.PROCESSING
                payout.processing_started_at = datetime.now(timezone.utc)
                await db.commit()

            # Create and send transaction
            transaction = await self._create_transfer_transaction(recipient_pubkey, amount_tokens)
            signature = await self._send_with_retry(transaction)

            # Update with transaction signature
            async with get_db() as db:
                payout = await db.get(PayoutModel, payout_id)
                payout.transaction_signature = signature
                payout.solscan_url = self.generate_solscan_link(signature)
                await db.commit()

            # Confirm transaction
            confirmed = await self._confirm_transaction(signature)

            # Final status update
            async with get_db() as db:
                payout = await db.get(PayoutModel, payout_id)
                if confirmed:
                    payout.status = PayoutStatus.CONFIRMED
                    payout.confirmed_at = datetime.now(timezone.utc)
                    success_msg = f"Payout successful: {amount_fndry} $FNDRY sent to {user_wallet}"
                    logger.info(f"{success_msg} | TX: {signature}")
                    return True, success_msg, signature
                else:
                    payout.status = PayoutStatus.FAILED
                    payout.error_message = "Transaction confirmation timeout"
                    await db.commit()
                    return False, "Transaction sent but confirmation timeout", signature

        except InsufficientFundsError as e:
            # Update payout record
            async with get_db() as db:
                payout = await db.get(PayoutModel, payout_id)
                payout.status = PayoutStatus.FAILED
                payout.error_message = str(e)
                await db.commit()
            return False, f"Insufficient treasury funds: {e}", None

        except Exception as e:
            logger.error(f"Payout failed for {user_wallet}: {e}")
            # Update payout record
            async with get_db() as db:
                payout = await db.get(PayoutModel, payout_id)
                payout.status = PayoutStatus.FAILED
                payout.error_message = str(e)
                await db.commit()
            return False, f"Payout failed: {str(e)}", None

        finally:
            self._release_payout_lock(user_wallet, amount_tokens)

    async def get_payout_history(
        self,
        limit: int = 50,
        status_filter: Optional[PayoutStatus] = None,
        wallet_filter: Optional[str] = None
    ) -> List[Dict]:
        """Get payout history with filtering"""
        try:
            async with get_db() as db:
                query = db.query(PayoutModel)

                if status_filter:
                    query = query.filter(PayoutModel.status == status_filter)
                if wallet_filter:
                    query = query.filter(PayoutModel.recipient_wallet == wallet_filter)

                payouts = await query.order_by(PayoutModel.created_at.desc()).limit(limit).all()

                return [
                    {
                        "id": payout.id,
                        "recipient_wallet": payout.recipient_wallet,
                        "amount_fndry": str(payout.amount_fndry),
                        "bounty_id": payout.bounty_id,
                        "status": payout.status.value,
                        "transaction_signature": payout.transaction_signature,
                        "solscan_url": payout.solscan_url,
                        "created_at": payout.created_at.isoformat(),
                        "confirmed_at": payout.confirmed_at.isoformat() if payout.confirmed_at else None,
                        "error_message": payout.error_message,
                        "description": payout.description
                    }
                    for payout in payouts
                ]
        except Exception as e:
            logger.error(f"Failed to get payout history: {e}")
            return []

    async def get_treasury_balance(self) -> Optional[Decimal]:
        """Get current treasury $FNDRY balance"""
        try:
            treasury_ata = await self._get_token_account(self.treasury_keypair.pubkey())
            if not treasury_ata:
                return None

            account_info = await self.rpc_client.get_token_account_balance(treasury_ata)
            if account_info.value:
                amount = int(account_info.value.amount)
                return Decimal(amount) / (10 ** self.decimals)
            return None

        except Exception as e:
            logger.error(f"Failed to get treasury balance: {e}")
            return None

    async def health_check(self) -> Dict[str, any]:
        """Service health check"""
        health = {
            "rpc_connected": False,
            "treasury_balance": None,
            "active_locks": len(self._payout_locks)
        }

        try:
            # Test RPC connection
            slot = await self.rpc_client.get_slot()
            health["rpc_connected"] = slot is not None

            # Get treasury balance
            balance = await self.get_treasury_balance()
            health["treasury_balance"] = str(balance) if balance else "unavailable"

        except Exception as e:
            logger.error(f"Health check failed: {e}")

        return health


# Global service instance
payout_service = PayoutService()
