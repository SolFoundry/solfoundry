"""Application-specific exception classes."""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""


class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""

class EscrowNotFoundError(Exception):
    """Escrow not found for given bounty."""
class EscrowAlreadyExistsError(Exception):
    """Escrow already exists for this bounty."""
class EscrowInvalidStateError(Exception):
    """State transition not allowed."""
class EscrowDoubleSpendError(Exception):
    """Duplicate tx hash (double-spend protection)."""
class EscrowAuthorizationError(Exception):
    """Caller not authorized to mutate this escrow."""
