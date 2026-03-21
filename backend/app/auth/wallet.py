from solders.pubkey import Pubkey
from solders.signature import Signature
import base58

def verify_wallet_signature(wallet_address: str, signature_base58: str, message: str) -> bool:
    try:
        pubkey = Pubkey.from_string(wallet_address)
        signature = Signature.from_string(signature_base58)
        # Verify that the message was signed by this specific wallet
        signature.verify(pubkey, message.encode())
        return True
    except Exception:
        return False
