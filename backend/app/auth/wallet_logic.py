from solders.pubkey import Pubkey
from solders.signature import Signature
import base58

def verify_solana_signature(wallet_address: str, signature_hex: str, message: str) -> bool:
    try:
        pubkey = Pubkey.from_string(wallet_address)
        # Signatures from frontend wallets (Phantom) are often base58 or hex
        signature = Signature.from_string(signature_hex)
        
        # This confirms the message was signed by the private key of that address
        signature.verify(pubkey, message.encode())
        return True
    except Exception as e:
        print(f"Verification failed: {e}")
        return False
