"""Application-specific exception classes."""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""


class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""


class EscrowNotFoundError(Exception):
    """Raised when an escrow account does not exist for the given bounty ID."""


class EscrowAlreadyExistsError(Exception):
    """Raised when attempting to create an escrow for a bounty that already has one."""


class EscrowInvalidStateError(Exception):
    """Raised when an escrow state transition is not allowed."""


class EscrowDoubleSpendError(Exception):
    """Raised when a duplicate transaction hash is detected (double-spend protection)."""
