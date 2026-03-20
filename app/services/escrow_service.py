# app/services/escrow_service.py
from solana.publickey import PublicKey
from solana.rpc.api import Client
import os

SOLANA_RPC_URL = os.getenv('SOLANA_RPC_URL', 'https://api.devnet.solana.com')
solana_client = Client(SOLANA_RPC_URL)

def verify_solana_signature(transaction_id, signature_b58):
    try:
        tx = solana_client.get_transaction(signature_b58, 'jsonParsed')
        if tx and tx['result'] and tx['result']['transaction']['meta']['err'] is None:
            return True
        return False
    except Exception as e:
        print(f"Signature verification failed: {e}")
        return False

processed_transactions = set()

def process_fund_operation(user_id, amount, transaction_id):
    if transaction_id in processed_transactions:
        print(f"Double-spend attempt detected for transaction_id: {transaction_id}")
        return False
    processed_transactions.add(transaction_id)
    print(f"Successfully processed fund: user={user_id}, amount={amount}, tx_id={transaction_id}")
    return True
