"""Application-specific exception classes."""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""


class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""


class PayoutError(Exception):
    """Base class for all payout-pipeline errors."""


class DoublePayError(PayoutError):
    """Raised when a bounty already has an active payout (prevents double-pay)."""


class PayoutLockError(PayoutError):
    """Raised when a payout cannot acquire the per-bounty processing lock."""


class TransferError(PayoutError):
    """Raised when an on-chain SPL token transfer fails after all retries."""

    def __init__(self, message: str, attempts: int = 0) -> None:
        super().__init__(message)
        self.attempts = attempts


class PayoutNotFoundError(PayoutError):
    """Raised when a payout ID does not exist in the store."""


class InvalidPayoutTransitionError(PayoutError):
    """Raised when a status transition is not allowed by the state machine."""
