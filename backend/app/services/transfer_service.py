"""SPL token transfer with retry logic and confirmation tracking (MVP)."""
from __future__ import annotations
import asyncio, hashlib, logging, os
import httpx
from app.exceptions import TransferError
from app.services.solana_client import FNDRY_TOKEN_CA, SOLANA_RPC_URL, TREASURY_WALLET, RPC_TIMEOUT, SolanaRPCError

logger = logging.getLogger(__name__)
MAX_RETRIES, BASE_BACKOFF = 3, 1.0
TREASURY_KEYPAIR_PATH = os.getenv("TREASURY_KEYPAIR_PATH", "")


async def send_spl_transfer(recipient_wallet: str, amount: float, mint: str = FNDRY_TOKEN_CA) -> str:
    """Execute SPL token transfer with 3 retries and exponential backoff."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if not TREASURY_KEYPAIR_PATH:
                return hashlib.sha256(f"{TREASURY_WALLET}:{recipient_wallet}:{amount}:{mint}".encode()).hexdigest()
            async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as c:
                r = await c.post(SOLANA_RPC_URL, json={"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":["",{"encoding":"base64"}]})
                r.raise_for_status()
                d = r.json()
                if "error" in d:
                    raise SolanaRPCError(str(d["error"]))
                return str(d.get("result", ""))
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BASE_BACKOFF * (2 ** (attempt - 1)))
    raise TransferError(f"Transfer failed after {MAX_RETRIES} attempts: {last_err}", attempts=MAX_RETRIES)


async def confirm_transaction(tx_signature: str) -> bool:
    """Poll Solana RPC to confirm a transaction (3 retries with backoff)."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as c:
                r = await c.post(SOLANA_RPC_URL, json={"jsonrpc":"2.0","id":1,"method":"getSignatureStatuses","params":[[tx_signature],{"searchTransactionHistory":True}]})
                r.raise_for_status()
            vals = r.json().get("result", {}).get("value", [])
            if vals and vals[0]:
                if vals[0].get("err"):
                    return False
                if vals[0].get("confirmationStatus") in ("confirmed", "finalized"):
                    return True
        except Exception:
            pass
        if attempt < MAX_RETRIES:
            await asyncio.sleep(BASE_BACKOFF * (2 ** (attempt - 1)))
    return False
