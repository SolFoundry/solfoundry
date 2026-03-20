console.log('// src/services/escrowService.js');
const { Connection, Transaction, SystemProgram, PublicKey } = require('@solana/web3.js');

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function verifySolanaSignature(signature_b58) {
  try {
    const tx = await connection.getTransaction(signature_b58, { commitment: 'confirmed' });
    if (tx && !tx.meta.err) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Signature verification failed: ${error.message}`);
    return false;
  }
}

const processedTransactions = new Set();

function processFundOperation(userId, amount, transactionId) {
  if (processedTransactions.has(transactionId)) {
    console.log(`Double-spend attempt detected for transactionId: ${transactionId}`);
    return false;
  }
  processedTransactions.add(transactionId);
  console.log(`Successfully processed fund: user=${userId}, amount=${amount}, tx_id=${transactionId}`);
  return true;
}

module.exports = { verifySolanaSignature, processFundOperation };
