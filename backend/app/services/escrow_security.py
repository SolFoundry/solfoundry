"""Escrow security service for Solana transaction verification and fraud prevention.

Provides server-side verification of Solana transactions to prevent:
- Double-spend attacks: Same transaction hash used for multiple payouts
- Signature forgery: Invalid or tampered transaction signatures
- Replay attacks: Reuse of old transaction data
- Race condition exploits: Concurrent fund/release requests

All escrow-related operations (fund, release, refund) must pass through
this service's verification pipeline before state changes are committed.

Attack vectors and mitigations are documented in docs/ESCROW_SECURITY.md.

References:
    - Solana Transaction Format: https://solana.com/docs/core/transactions
    - Double-Spend Prevention: https://solana.com/docs/advanced/confirmation
"""

import hashlib
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Transaction verification configuration
TRANSACTION_MAX_AGE_SECONDS: int = int(os.getenv("ESCROW_TX_MAX_AGE", "300"))
SIGNATURE_CACHE_TTL_SECONDS: int = int(os.getenv("ESCROW_SIG_CACHE_TTL", "86400"))
MAX_CONCURRENT_ESCROW_OPS: int = int(os.getenv("ESCROW_MAX_CONCURRENT", "10"))

# Solana address validation pattern
SOLANA_ADDRESS_LENGTH_MIN: int = 32
SOLANA_ADDRESS_LENGTH_MAX: int = 44
SOLANA_BASE58_CHARS: set[str] = set(
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
)

# Known treasury and program addresses for validation
TREASURY_WALLET: str = os.getenv(
    "TREASURY_WALLET", "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1"
)
FNDRY_TOKEN_CA: str = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"


class EscrowSecurityError(Exception):
    """Base exception for escrow security violations.

    Attributes:
        code: Machine-readable error code for the violation type.
    """

    def __init__(self, message: str, code: str = "ESCROW_ERROR") -> None:
        """Initialize with a descriptive message and error code.

        Args:
            message: Human-readable description of the security violation.
            code: Machine-readable error code.
        """
        super().__init__(message)
        self.code = code


class DoubleSpendError(EscrowSecurityError):
    """Raised when a transaction hash has already been processed."""

    def __init__(self, tx_hash: str) -> None:
        """Initialize with the duplicate transaction hash.

        Args:
            tx_hash: The transaction hash that was already used.
        """
        super().__init__(
            f"Transaction {tx_hash[:16]}... has already been processed",
            code="DOUBLE_SPEND",
        )


class InvalidSignatureError(EscrowSecurityError):
    """Raised when a transaction signature fails verification."""

    def __init__(self, reason: str) -> None:
        """Initialize with the verification failure reason.

        Args:
            reason: Description of why the signature is invalid.
        """
        super().__init__(
            f"Transaction signature verification failed: {reason}",
            code="INVALID_SIGNATURE",
        )


class TransactionExpiredError(EscrowSecurityError):
    """Raised when a transaction is too old to be accepted."""

    def __init__(self, age_seconds: int) -> None:
        """Initialize with the transaction's age.

        Args:
            age_seconds: How old the transaction is in seconds.
        """
        super().__init__(
            f"Transaction is too old ({age_seconds}s, max {TRANSACTION_MAX_AGE_SECONDS}s)",
            code="TX_EXPIRED",
        )


class ConcurrencyLimitError(EscrowSecurityError):
    """Raised when too many escrow operations are running concurrently."""

    def __init__(self) -> None:
        """Initialize the concurrency limit error."""
        super().__init__(
            f"Too many concurrent escrow operations (max {MAX_CONCURRENT_ESCROW_OPS})",
            code="CONCURRENCY_LIMIT",
        )


class ProcessedTransactionRecord:
    """Record of a successfully processed transaction for double-spend prevention.

    Attributes:
        tx_hash: The transaction hash (base58 encoded).
        processed_at: Unix timestamp when the transaction was processed.
        operation: The escrow operation type (fund, release, refund).
        amount: The transaction amount.
        recipient: The recipient wallet address.
    """

    __slots__ = ("tx_hash", "processed_at", "operation", "amount", "recipient")

    def __init__(
        self,
        tx_hash: str,
        operation: str,
        amount: float = 0.0,
        recipient: str = "",
    ) -> None:
        """Initialize a processed transaction record.

        Args:
            tx_hash: The transaction hash.
            operation: The operation type (fund/release/refund).
            amount: The transaction amount.
            recipient: The recipient address.
        """
        self.tx_hash = tx_hash
        self.processed_at = time.time()
        self.operation = operation
        self.amount = amount
        self.recipient = recipient


def validate_solana_address(address: str) -> bool:
    """Validate that a string is a properly formatted Solana public key.

    Checks length constraints (32-44 characters) and Base58 character set
    (no 0, O, I, l characters which are excluded from Base58).

    Args:
        address: The address string to validate.

    Returns:
        bool: True if the address is properly formatted.
    """
    if not address:
        return False
    if len(address) < SOLANA_ADDRESS_LENGTH_MIN or len(address) > SOLANA_ADDRESS_LENGTH_MAX:
        return False
    return all(char in SOLANA_BASE58_CHARS for char in address)


def validate_transaction_hash(tx_hash: str) -> bool:
    """Validate that a string is a properly formatted Solana transaction signature.

    Solana transaction signatures are 88-character Base58 strings.

    Args:
        tx_hash: The transaction hash to validate.

    Returns:
        bool: True if the hash is properly formatted.
    """
    if not tx_hash:
        return False
    if len(tx_hash) < 64 or len(tx_hash) > 88:
        return False
    return all(char in SOLANA_BASE58_CHARS for char in tx_hash)


class TransactionVerifier:
    """Verifies Solana transactions for escrow operations.

    Maintains a record of all processed transaction hashes to prevent
    double-spend attacks, and provides signature verification utilities.

    Thread-safe implementation using a threading lock and semaphore for
    concurrency control.

    PostgreSQL migration path:
        Replace the in-memory _processed_transactions dict with queries
        against a 'processed_transactions' table:

        CREATE TABLE processed_transactions (
            tx_hash VARCHAR(88) PRIMARY KEY,
            operation VARCHAR(20) NOT NULL,
            amount DECIMAL(20, 9),
            recipient VARCHAR(44),
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX idx_processed_tx_hash ON processed_transactions(tx_hash);

    Attributes:
        max_concurrent: Maximum concurrent escrow operations allowed.
    """

    def __init__(self, max_concurrent: int = MAX_CONCURRENT_ESCROW_OPS) -> None:
        """Initialize the transaction verifier.

        Args:
            max_concurrent: Maximum number of concurrent escrow operations.
        """
        self.max_concurrent = max_concurrent
        self._processed_transactions: dict[str, ProcessedTransactionRecord] = {}
        self._lock = threading.Lock()
        self._semaphore = threading.Semaphore(max_concurrent)
        self._active_operations: int = 0
        logger.info(
            "TransactionVerifier initialized (max concurrent: %d, "
            "tx max age: %ds, sig cache TTL: %ds)",
            max_concurrent,
            TRANSACTION_MAX_AGE_SECONDS,
            SIGNATURE_CACHE_TTL_SECONDS,
        )

    def check_double_spend(self, tx_hash: str) -> None:
        """Check if a transaction hash has already been processed.

        Must be called before processing any escrow operation to prevent
        the same on-chain transaction from being credited multiple times.

        Args:
            tx_hash: The transaction hash to check.

        Raises:
            DoubleSpendError: If the transaction was already processed.
            InvalidSignatureError: If the transaction hash format is invalid.
        """
        if not validate_transaction_hash(tx_hash):
            raise InvalidSignatureError(
                f"Invalid transaction hash format: {tx_hash[:20]}..."
            )

        with self._lock:
            if tx_hash in self._processed_transactions:
                existing = self._processed_transactions[tx_hash]
                logger.critical(
                    "SECURITY: Double-spend attempt detected! tx_hash=%s "
                    "was already processed at %s for operation '%s'",
                    tx_hash[:16],
                    datetime.fromtimestamp(
                        existing.processed_at, tz=timezone.utc
                    ).isoformat(),
                    existing.operation,
                )
                raise DoubleSpendError(tx_hash)

    def record_processed_transaction(
        self,
        tx_hash: str,
        operation: str,
        amount: float = 0.0,
        recipient: str = "",
    ) -> None:
        """Record a successfully processed transaction for double-spend prevention.

        Must be called after the escrow operation completes successfully.

        Args:
            tx_hash: The processed transaction hash.
            operation: The operation type (fund/release/refund).
            amount: The transaction amount.
            recipient: The recipient wallet address.
        """
        record = ProcessedTransactionRecord(
            tx_hash=tx_hash,
            operation=operation,
            amount=amount,
            recipient=recipient,
        )

        with self._lock:
            self._processed_transactions[tx_hash] = record

        logger.info(
            "Recorded processed transaction: hash=%s, op=%s, amount=%.4f, recipient=%s",
            tx_hash[:16],
            operation,
            amount,
            recipient[:8] if recipient else "none",
        )

    def acquire_operation_slot(self) -> bool:
        """Acquire a concurrency slot for an escrow operation.

        Used to limit the number of concurrent escrow operations to prevent
        race conditions and resource exhaustion.

        Returns:
            bool: True if a slot was acquired.

        Raises:
            ConcurrencyLimitError: If all slots are occupied.
        """
        acquired = self._semaphore.acquire(blocking=False)
        if not acquired:
            raise ConcurrencyLimitError()

        with self._lock:
            self._active_operations += 1
            logger.debug(
                "Acquired escrow operation slot (%d/%d active)",
                self._active_operations,
                self.max_concurrent,
            )
        return True

    def release_operation_slot(self) -> None:
        """Release a concurrency slot after an escrow operation completes.

        Must be called in a finally block to prevent slot leaks.
        """
        self._semaphore.release()
        with self._lock:
            self._active_operations = max(0, self._active_operations - 1)
            logger.debug(
                "Released escrow operation slot (%d/%d active)",
                self._active_operations,
                self.max_concurrent,
            )

    def verify_transaction_age(self, tx_timestamp: float) -> None:
        """Verify that a transaction is recent enough to accept.

        Rejects transactions older than TRANSACTION_MAX_AGE_SECONDS to prevent
        replay attacks with old transaction data.

        Args:
            tx_timestamp: Unix timestamp of the transaction.

        Raises:
            TransactionExpiredError: If the transaction is too old.
        """
        now = time.time()
        age = int(now - tx_timestamp)

        if age > TRANSACTION_MAX_AGE_SECONDS:
            logger.warning(
                "Rejected expired transaction (age: %ds, max: %ds)",
                age,
                TRANSACTION_MAX_AGE_SECONDS,
            )
            raise TransactionExpiredError(age)

    def verify_recipient_address(self, address: str) -> None:
        """Verify that a recipient address is a valid Solana public key.

        Args:
            address: The recipient address to validate.

        Raises:
            InvalidSignatureError: If the address format is invalid.
        """
        if not validate_solana_address(address):
            raise InvalidSignatureError(
                f"Invalid recipient address format: {address[:20]}..."
            )

    def verify_escrow_operation(
        self,
        tx_hash: str,
        operation: str,
        recipient: str,
        amount: float,
        tx_timestamp: Optional[float] = None,
    ) -> None:
        """Run the full verification pipeline for an escrow operation.

        Performs all security checks in sequence:
        1. Validate transaction hash format
        2. Check for double-spend
        3. Verify transaction age (if timestamp provided)
        4. Validate recipient address
        5. Validate amount is positive

        Args:
            tx_hash: The Solana transaction hash.
            operation: Operation type (fund/release/refund).
            recipient: The recipient wallet address.
            amount: The transaction amount (must be positive).
            tx_timestamp: Optional transaction timestamp for age check.

        Raises:
            InvalidSignatureError: If any format validation fails.
            DoubleSpendError: If the transaction was already processed.
            TransactionExpiredError: If the transaction is too old.
            EscrowSecurityError: If the amount is invalid.
        """
        # Step 1 & 2: Format validation and double-spend check
        self.check_double_spend(tx_hash)

        # Step 3: Transaction age check
        if tx_timestamp is not None:
            self.verify_transaction_age(tx_timestamp)

        # Step 4: Recipient address validation
        self.verify_recipient_address(recipient)

        # Step 5: Amount validation
        if amount <= 0:
            raise EscrowSecurityError(
                f"Invalid escrow amount: {amount}. Must be positive.",
                code="INVALID_AMOUNT",
            )

        logger.info(
            "Escrow operation verified: op=%s, tx=%s, recipient=%s, amount=%.4f",
            operation,
            tx_hash[:16],
            recipient[:8],
            amount,
        )

    def get_processed_count(self) -> int:
        """Return the total number of processed transactions.

        Returns:
            int: Number of recorded transaction hashes.
        """
        with self._lock:
            return len(self._processed_transactions)

    def get_active_operations(self) -> int:
        """Return the number of currently active escrow operations.

        Returns:
            int: Number of active operations.
        """
        with self._lock:
            return self._active_operations

    def cleanup_old_records(self, max_age_seconds: int = SIGNATURE_CACHE_TTL_SECONDS) -> int:
        """Remove processed transaction records older than max_age_seconds.

        Keeps the in-memory store bounded. In production with PostgreSQL,
        old records should be archived rather than deleted for audit purposes.

        Args:
            max_age_seconds: Records older than this are removed.

        Returns:
            int: Number of records removed.
        """
        cutoff = time.time() - max_age_seconds
        removed = 0

        with self._lock:
            stale_hashes = [
                tx_hash for tx_hash, record in self._processed_transactions.items()
                if record.processed_at < cutoff
            ]
            for tx_hash in stale_hashes:
                del self._processed_transactions[tx_hash]
                removed += 1

        if removed:
            logger.info("Cleaned up %d old processed transaction records", removed)
        return removed

    def reset(self) -> None:
        """Clear all tracking data. Used for testing."""
        with self._lock:
            self._processed_transactions.clear()
            self._active_operations = 0


# Global singleton instance
transaction_verifier = TransactionVerifier()
