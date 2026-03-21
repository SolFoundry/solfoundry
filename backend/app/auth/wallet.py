from solders.pubkey import Pubkey
from solders.signature import Signature
import base58

def verify_solana_signature(wallet_address: str, signature_base58: str, message: str) -> bool:
    try:
        pubkey = Pubkey.from_string(wallet_address)
        sig = Signature.from_string(signature_base58)
        
        sig.verify(pubkey, message.encode("utf-8"))
        return True
    except Exception as e:
        print(f"Auth Error: {e}")
        return False
