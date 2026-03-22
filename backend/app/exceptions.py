"""Application-specific exception classes for the SolFoundry backend.

Each exception maps to a specific failure mode in the payout pipeline
or contributor system, enabling fine-grained error handling and
meaningful HTTP status codes in API endpoints.
"""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""

class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""


# Dispute resolution exceptions (Issue #192)


class DisputeNotFoundError(Exception):
    """Raised when a dispute ID does not exist in the database."""


class DisputeWindowExpiredError(Exception):
    """Raised when the 72-hour dispute window from rejection has passed."""


class InvalidDisputeTransitionError(Exception):
    """Raised when an invalid dispute state transition is attempted."""


class DuplicateDisputeError(Exception):
    """Raised when a dispute already exists for this submission."""


class UnauthorizedDisputeAccessError(Exception):
    """Raised when a non-authorized user attempts a restricted dispute action."""


class BountyNotFoundError(Exception):
    """Raised when a referenced bounty does not exist in the database."""


class SubmissionNotFoundError(Exception):
    """Raised when a referenced submission does not exist in the database."""


class PayoutError(Exception):
    """Base class for all payout-pipeline errors.

    All payout-related exceptions inherit from this so callers can
    catch the entire family with a single ``except PayoutError``.
    """


class DoublePayError(PayoutError):
    """Raised when a bounty already has an active (non-failed) payout.

    The per-bounty lock mechanism ensures only one successful payout
    per bounty; this error signals a duplicate attempt.
    """


class PayoutLockError(PayoutError):
    """Raised when a payout cannot acquire the per-bounty processing lock.

    This typically indicates high contention on a single bounty and
    maps to HTTP 423 (Locked) in the API layer.
    """


class TransferError(PayoutError):
    """Raised when an on-chain SPL token transfer fails after all retries.

    Attributes:
        attempts: The number of transfer attempts that were made before
            giving up.
    """

    def __init__(self, message: str, attempts: int = 0) -> None:
        """Initialize with a message and the number of retry attempts.

        Args:
            message: Human-readable error description.
            attempts: Number of transfer attempts that were made.
        """
        super().__init__(message)
        self.attempts = attempts


class PayoutNotFoundError(PayoutError):
    """Raised when a payout ID does not exist in the store.

    Maps to HTTP 404 in the API layer.
    """


class InvalidPayoutTransitionError(PayoutError):
    """Raised when a status transition is not allowed by the state machine.

    For example, attempting to execute a payout that has not been
    admin-approved yet.  Maps to HTTP 409 in the API layer.
    """


# ---------------------------------------------------------------------------
# Escrow exceptions
# ---------------------------------------------------------------------------

class EscrowError(Exception):
    """Base class for all escrow-related errors."""


class EscrowNotFoundError(EscrowError):
    """Raised when no escrow exists for the given bounty_id."""


class EscrowAlreadyExistsError(EscrowError):
    """Raised when an escrow already exists for the given bounty_id."""


class InvalidEscrowTransitionError(EscrowError):
    """Raised when a state transition is not allowed by the escrow state machine."""


class EscrowFundingError(EscrowError):
    """Raised when the on-chain funding transfer fails."""

    def __init__(self, message: str, tx_hash: str | None = None) -> None:
        super().__init__(message)
        self.tx_hash = tx_hash


class EscrowDoubleSpendError(EscrowError):
    """Raised when a funding transaction could not be confirmed on-chain."""


# ---------------------------------------------------------------------------
# GitHub OAuth exceptions
# ---------------------------------------------------------------------------


class GitHubAccessDeniedError(Exception):
    """Raised when the user denies the GitHub OAuth authorization request."""


class GitHubTokenRevokedError(Exception):
    """Raised when a revoked GitHub access token is used."""


class GitHubRateLimitError(Exception):
    """Raised when the GitHub API rate limit is exceeded.

    Attributes:
        retry_after: Number of seconds until the rate limit resets.
    """

    def __init__(self, message: str, retry_after: int = 0) -> None:
        """Initialize with rate limit details.

        Args:
            message: Human-readable description.
            retry_after: Seconds until the rate limit resets.
        """
        super().__init__(message)
        self.retry_after = retry_after
