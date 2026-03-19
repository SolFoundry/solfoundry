import asyncio
import logging
from typing import Dict, List, Optional, Any
from decimal import Decimal
from datetime import datetime, timezone
import aiohttp
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TokenAccountOpts
from solana.publickey import PublicKey
from solana.rpc.commitment import Commitment
from solders.signature import Signature
from solders.pubkey import Pubkey
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class SolanaService:
    def __init__(self):
        self.rpc_url = settings.SOLANA_RPC_URL
        self.client = None
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        self.client = AsyncClient(self.rpc_url, session=self.session)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.close()
        if self.session:
            await self.session.close()

    async def get_balance(self, address: str) -> Decimal:
        """Get SOL balance for an address in SOL units"""
        try:
            pubkey = PublicKey(address)
            response = await self.client.get_balance(pubkey)
            
            if response.value is None:
                return Decimal('0')
                
            # Convert lamports to SOL (1 SOL = 1e9 lamports)
            balance_sol = Decimal(response.value) / Decimal('1000000000')
            return balance_sol
            
        except Exception as e:
            logger.error(f"Error getting balance for {address}: {str(e)}")
            return Decimal('0')

    async def get_token_balance(self, owner_address: str, mint_address: str) -> Decimal:
        """Get SPL token balance for an address"""
        try:
            owner_pubkey = PublicKey(owner_address)
            mint_pubkey = PublicKey(mint_address)
            
            # Get token accounts by owner
            response = await self.client.get_token_accounts_by_owner(
                owner_pubkey,
                TokenAccountOpts(mint=mint_pubkey)
            )
            
            total_balance = Decimal('0')
            
            if response.value:
                for account in response.value:
                    account_pubkey = PublicKey(account.pubkey)
                    account_info = await self.client.get_token_account_balance(account_pubkey)
                    
                    if account_info.value and account_info.value.amount:
                        # Convert based on decimals
                        decimals = account_info.value.decimals
                        amount = Decimal(account_info.value.amount) / (Decimal('10') ** decimals)
                        total_balance += amount
                        
            return total_balance
            
        except Exception as e:
            logger.error(f"Error getting token balance for {owner_address}, mint {mint_address}: {str(e)}")
            return Decimal('0')

    async def get_transaction_history(
        self, 
        address: str, 
        limit: int = 100,
        before_signature: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get transaction history for an address"""
        try:
            pubkey = PublicKey(address)
            
            # Build request options
            opts = {"limit": min(limit, 1000)}  # API limit is 1000
            if before_signature:
                opts["before"] = before_signature
                
            response = await self.client.get_signatures_for_address(
                pubkey, 
                **opts
            )
            
            transactions = []
            
            if response.value:
                for signature_info in response.value:
                    transaction_data = {
                        'signature': str(signature_info.signature),
                        'slot': signature_info.slot,
                        'block_time': signature_info.block_time,
                        'confirmation_status': signature_info.confirmation_status,
                        'err': signature_info.err,
                        'memo': signature_info.memo
                    }
                    
                    # Convert block_time to datetime if available
                    if signature_info.block_time:
                        transaction_data['datetime'] = datetime.fromtimestamp(
                            signature_info.block_time, 
                            tz=timezone.utc
                        )
                    
                    transactions.append(transaction_data)
                    
            return transactions
            
        except Exception as e:
            logger.error(f"Error getting transaction history for {address}: {str(e)}")
            return []

    async def get_transaction_details(self, signature: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific transaction"""
        try:
            sig = Signature.from_string(signature)
            
            response = await self.client.get_transaction(
                sig,
                commitment=Commitment("confirmed"),
                max_supported_transaction_version=0
            )
            
            if not response.value:
                return None
                
            transaction = response.value
            
            # Parse transaction details
            transaction_data = {
                'signature': signature,
                'slot': transaction.slot,
                'block_time': transaction.block_time,
                'fee': transaction.transaction.meta.fee if transaction.transaction.meta else 0,
                'status': 'success' if not (transaction.transaction.meta and transaction.transaction.meta.err) else 'failed',
                'error': transaction.transaction.meta.err if transaction.transaction.meta else None,
                'pre_balances': transaction.transaction.meta.pre_balances if transaction.transaction.meta else [],
                'post_balances': transaction.transaction.meta.post_balances if transaction.transaction.meta else [],
                'account_keys': [str(key) for key in transaction.transaction.transaction.message.account_keys],
                'instructions': []
            }
            
            # Convert block_time to datetime if available
            if transaction.block_time:
                transaction_data['datetime'] = datetime.fromtimestamp(
                    transaction.block_time, 
                    tz=timezone.utc
                )
            
            # Parse instructions
            if transaction.transaction.transaction.message.instructions:
                for instruction in transaction.transaction.transaction.message.instructions:
                    instruction_data = {
                        'program_id_index': instruction.program_id_index,
                        'accounts': instruction.accounts,
                        'data': instruction.data
                    }
                    
                    # Get program ID
                    if instruction.program_id_index < len(transaction_data['account_keys']):
                        instruction_data['program_id'] = transaction_data['account_keys'][instruction.program_id_index]
                    
                    transaction_data['instructions'].append(instruction_data)
            
            return transaction_data
            
        except Exception as e:
            logger.error(f"Error getting transaction details for {signature}: {str(e)}")
            return None

    async def get_token_accounts(self, owner_address: str) -> List[Dict[str, Any]]:
        """Get all token accounts for an address"""
        try:
            owner_pubkey = PublicKey(owner_address)
            
            response = await self.client.get_token_accounts_by_owner(
                owner_pubkey,
                TokenAccountOpts(program_id=PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"))
            )
            
            token_accounts = []
            
            if response.value:
                for account in response.value:
                    account_pubkey = PublicKey(account.pubkey)
                    balance_info = await self.client.get_token_account_balance(account_pubkey)
                    
                    if balance_info.value:
                        token_data = {
                            'address': str(account.pubkey),
                            'mint': account.account.data.parsed['info']['mint'],
                            'owner': account.account.data.parsed['info']['owner'],
                            'amount': balance_info.value.amount,
                            'decimals': balance_info.value.decimals,
                            'ui_amount': balance_info.value.ui_amount,
                            'ui_amount_string': balance_info.value.ui_amount_string
                        }
                        token_accounts.append(token_data)
                        
            return token_accounts
            
        except Exception as e:
            logger.error(f"Error getting token accounts for {owner_address}: {str(e)}")
            return []

    async def get_multiple_balances(self, addresses: List[str]) -> Dict[str, Decimal]:
        """Get balances for multiple addresses efficiently"""
        try:
            pubkeys = [PublicKey(addr) for addr in addresses]
            response = await self.client.get_multiple_accounts(pubkeys)
            
            balances = {}
            
            if response.value:
                for i, account_info in enumerate(response.value):
                    address = addresses[i]
                    if account_info:
                        # This would need to be adapted based on account type
                        # For now, we'll fall back to individual balance calls
                        balance = await self.get_balance(address)
                        balances[address] = balance
                    else:
                        balances[address] = Decimal('0')
            else:
                # Fall back to individual calls
                for address in addresses:
                    balances[address] = await self.get_balance(address)
                    
            return balances
            
        except Exception as e:
            logger.error(f"Error getting multiple balances: {str(e)}")
            # Fall back to individual calls
            balances = {}
            for address in addresses:
                balances[address] = await self.get_balance(address)
            return balances

    async def get_slot(self) -> Optional[int]:
        """Get current slot"""
        try:
            response = await self.client.get_slot()
            return response.value
        except Exception as e:
            logger.error(f"Error getting current slot: {str(e)}")
            return None

    async def get_block_time(self, slot: int) -> Optional[datetime]:
        """Get block time for a slot"""
        try:
            response = await self.client.get_block_time(slot)
            if response.value:
                return datetime.fromtimestamp(response.value, tz=timezone.utc)
            return None
        except Exception as e:
            logger.error(f"Error getting block time for slot {slot}: {str(e)}")
            return None

    async def is_valid_address(self, address: str) -> bool:
        """Validate if an address is a valid Solana public key"""
        try:
            PublicKey(address)
            return True
        except Exception:
            return False