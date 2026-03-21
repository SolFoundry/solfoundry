"""Async Solana RPC client with SPL token transfer and verification.

Inbound funding: creator sends $FNDRY to treasury externally, we verify via
``verify_spl_transfer`` (getTransaction + jsonParsed checks on mint, amount,
recipient, finalization).

Outbound release/refund: treasury keypair (TREASURY_KEYPAIR env var, base-58)
signs a ``transfer_checked`` instruction via ``send_spl_transfer`` using solders.
"""
from __future__ import annotations
import base64, logging, os
from decimal import Decimal
from typing import Any
import httpx

logger = logging.getLogger(__name__)

SOLANA_RPC_URL: str = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
TREASURY_WALLET: str = os.getenv("TREASURY_WALLET", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp")
FNDRY_TOKEN_CA: str = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
TOKEN_PROGRAM_ID: str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
RPC_TIMEOUT: float = float(os.getenv("SOLANA_RPC_TIMEOUT", "10"))
_TRANSIENT_HTTP_CODES = frozenset({429, 502, 503, 504})

class SolanaRPCError(Exception):
    """Raised when the Solana JSON-RPC returns an error payload."""
    def __init__(self, message: str, code: int | None = None, *, transient: bool = False) -> None:
        super().__init__(message); self.code = code; self.transient = transient

class SolanaTransientError(SolanaRPCError):
    """Network / rate-limit errors safe to retry."""
    def __init__(self, message: str, code: int | None = None) -> None:
        super().__init__(message, code, transient=True)

async def _rpc_call(method: str, params: list[Any] | None = None) -> dict[str, Any]:
    """JSON-RPC 2.0 request. Raises SolanaTransientError on recoverable failures."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
    try:
        async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
            resp = await client.post(SOLANA_RPC_URL, json=payload)
            if resp.status_code in _TRANSIENT_HTTP_CODES:
                raise SolanaTransientError(f"Transient HTTP {resp.status_code}", code=resp.status_code)
            resp.raise_for_status()
    except httpx.TimeoutException as exc:
        raise SolanaTransientError(f"RPC timeout: {exc}") from exc
    except httpx.NetworkError as exc:
        raise SolanaTransientError(f"RPC network error: {exc}") from exc
    data: dict[str, Any] = resp.json()
    if "error" in data:
        err = data["error"]; logger.error("Solana RPC error: %s", err)
        raise SolanaRPCError(f"RPC error: {err.get('message', str(err))}", code=err.get("code"))
    return data

async def get_sol_balance(wallet: str = TREASURY_WALLET) -> float:
    """Return the native SOL balance of wallet in SOL (not lamports)."""
    data = await _rpc_call("getBalance", [wallet])
    return data.get("result", {}).get("value", 0) / 1e9

async def get_token_balance(wallet: str = TREASURY_WALLET, mint: str = FNDRY_TOKEN_CA) -> float:
    """Return the SPL-token balance for mint held by wallet."""
    data = await _rpc_call("getTokenAccountsByOwner", [wallet, {"mint": mint}, {"encoding": "jsonParsed"}])
    accounts = data.get("result", {}).get("value", [])
    total = 0.0
    for acct in accounts:
        ta = acct.get("account", {}).get("data", {}).get("parsed", {}).get("info", {}).get("tokenAmount", {})
        total += float(ta.get("uiAmount", 0) or 0)
    return total

async def get_treasury_balances(wallet: str = TREASURY_WALLET) -> tuple[float, float]:
    """Return (sol_balance, fndry_balance) for the treasury wallet."""
    return await get_sol_balance(wallet), await get_token_balance(wallet)

# ---------------------------------------------------------------------------
# On-chain transaction verification
# ---------------------------------------------------------------------------

async def verify_spl_transfer(tx_hash: str, expected_mint: str = FNDRY_TOKEN_CA,
                               expected_recipient: str = TREASURY_WALLET,
                               min_amount: Decimal = Decimal("0")) -> bool:
    """Verify tx_hash is a finalized SPL transfer to expected_recipient for expected_mint.

    Checks: (1) tx exists with no error, (2) finalized commitment, (3) contains
    transfer/transferChecked to recipient's token account for correct mint with
    amount >= min_amount. Raises SolanaTransientError on network failures.
    """
    data = await _rpc_call("getTransaction", [tx_hash, {"encoding": "jsonParsed",
        "commitment": "finalized", "maxSupportedTransactionVersion": 0}])
    result = data.get("result")
    if result is None:
        logger.warning("Transaction %s not found on-chain", tx_hash); return False
    meta = result.get("meta") or {}
    if meta.get("err") is not None:
        logger.warning("Transaction %s has execution error: %s", tx_hash, meta["err"]); return False
    # Collect all instructions (outer + inner/CPI)
    message = result.get("transaction", {}).get("message", {})
    instructions: list[dict[str, Any]] = list(message.get("instructions", []))
    for ig in meta.get("innerInstructions", []):
        instructions.extend(ig.get("instructions", []))
    for ix in instructions:
        parsed = ix.get("parsed")
        if not isinstance(parsed, dict): continue
        ix_type = parsed.get("type", "")
        if ix_type not in ("transfer", "transferChecked"): continue
        info = parsed.get("info", {})
        if ix_type == "transferChecked" and info.get("mint") != expected_mint: continue
        dest = info.get("destination", "")
        if not _check_dest_owner(result, dest, expected_recipient): continue
        if _extract_amount(info) >= min_amount:
            logger.info("Verified SPL transfer %s: to %s", tx_hash, expected_recipient)
            return True
    logger.warning("Tx %s: no matching SPL transfer (mint=%s, to=%s)", tx_hash, expected_mint, expected_recipient)
    return False

def _check_dest_owner(tx_result: dict, token_account: str, expected_owner: str) -> bool:
    """Check if a token account belongs to expected_owner via postTokenBalances."""
    meta = tx_result.get("meta", {}); message = tx_result.get("transaction", {}).get("message", {})
    keys_raw = message.get("accountKeys", [])
    keys = [k if isinstance(k, str) else k.get("pubkey", "") for k in keys_raw]
    idx = next((i for i, k in enumerate(keys) if k == token_account), None)
    for bal in meta.get("postTokenBalances", []):
        if bal.get("accountIndex") == idx and bal.get("owner") == expected_owner: return True
    return expected_owner in keys  # fallback

def _extract_amount(info: dict[str, Any]) -> Decimal:
    """Extract human-readable transfer amount from parsed instruction info."""
    ui = info.get("tokenAmount", {}).get("uiAmountString")
    if ui is not None: return Decimal(ui)
    return Decimal(str(info.get("amount", "0"))) / Decimal("1000000000")  # 9 decimals

# ---------------------------------------------------------------------------
# Outgoing SPL token transfers (treasury -> recipient)
# ---------------------------------------------------------------------------

async def _resolve_token_accounts(wallet: str, mint: str) -> list[dict[str, Any]]:
    """Resolve SPL token accounts for wallet filtered by mint."""
    data = await _rpc_call("getTokenAccountsByOwner", [wallet, {"mint": mint}, {"encoding": "jsonParsed"}])
    return data.get("result", {}).get("value", [])

async def send_spl_transfer(to_wallet: str, amount: Decimal, mint: str = FNDRY_TOKEN_CA) -> str:
    """Send SPL transfer from treasury to to_wallet using solders for tx construction.

    Loads treasury keypair from TREASURY_KEYPAIR env var (base-58 secret key),
    builds transfer_checked instruction, signs, and submits via sendTransaction.
    Returns the transaction signature.
    """
    from solders.keypair import Keypair; from solders.pubkey import Pubkey  # type: ignore[import-untyped]
    from solders.transaction import Transaction; from solders.message import Message  # type: ignore[import-untyped]
    from solders.instruction import Instruction, AccountMeta  # type: ignore[import-untyped]
    from solders.hash import Hash as Blockhash  # type: ignore[import-untyped]

    keypair_b58 = os.getenv("TREASURY_KEYPAIR")
    if not keypair_b58: raise RuntimeError("TREASURY_KEYPAIR env var not set")
    kp = Keypair.from_base58_string(keypair_b58); treasury_pk = kp.pubkey()
    mint_pk, token_prog = Pubkey.from_string(mint), Pubkey.from_string(TOKEN_PROGRAM_ID)
    # Resolve token accounts
    src = await _resolve_token_accounts(str(treasury_pk), mint)
    if not src: raise RuntimeError("Treasury has no token account for this mint")
    dst = await _resolve_token_accounts(to_wallet, mint)
    if not dst: raise RuntimeError(f"Recipient {to_wallet} has no token account")
    src_ata, dst_ata = Pubkey.from_string(src[0]["pubkey"]), Pubkey.from_string(dst[0]["pubkey"])
    decimals = int(src[0].get("account",{}).get("data",{}).get("parsed",{}).get("info",{}).get("tokenAmount",{}).get("decimals",9))
    raw = int(amount * Decimal(10**decimals))
    # transfer_checked: opcode 12, 8-byte amount LE, 1-byte decimals
    ix_data = bytes([12]) + raw.to_bytes(8, "little") + bytes([decimals])
    ix = Instruction(program_id=token_prog, accounts=[
        AccountMeta(pubkey=src_ata, is_signer=False, is_writable=True),
        AccountMeta(pubkey=mint_pk, is_signer=False, is_writable=False),
        AccountMeta(pubkey=dst_ata, is_signer=False, is_writable=True),
        AccountMeta(pubkey=treasury_pk, is_signer=True, is_writable=False)], data=ix_data)
    bh_data = await _rpc_call("getLatestBlockhash", [{"commitment": "finalized"}])
    bh_str = bh_data.get("result",{}).get("value",{}).get("blockhash","")
    if not bh_str: raise RuntimeError("Failed to fetch blockhash")
    bh = Blockhash.from_string(bh_str)
    msg = Message.new_with_blockhash([ix], treasury_pk, bh)
    tx = Transaction.new_unsigned(msg); tx.sign([kp], bh)
    encoded = base64.b64encode(bytes(tx)).decode("ascii")
    res = await _rpc_call("sendTransaction", [encoded, {"encoding":"base64","preflightCommitment":"finalized"}])
    sig = res.get("result", "")
    if not sig: raise RuntimeError("sendTransaction returned empty signature")
    logger.info("SPL transfer sent: %s tokens to %s, tx=%s", amount, to_wallet, sig)
    return sig
