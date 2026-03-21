"""Application-specific exception classes."""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""


class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""
