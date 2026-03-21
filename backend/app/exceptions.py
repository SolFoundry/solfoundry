"""Application-specific exception classes."""


class ContributorNotFoundError(Exception):
    """Raised when a contributor ID does not exist in the store."""

class TierNotUnlockedError(Exception):
    """Raised when a contributor attempts a bounty tier they have not unlocked."""

# Dispute resolution exceptions (Issue #192)
class DisputeNotFoundError(Exception):
    """Dispute ID not found."""
class DisputeWindowExpiredError(Exception):
    """72h dispute window from rejection has passed."""
class InvalidDisputeTransitionError(Exception):
    """Invalid state transition attempted."""
class DuplicateDisputeError(Exception):
    """Dispute already exists for this submission."""
class UnauthorizedDisputeAccessError(Exception):
    """Non-admin attempted to resolve a dispute."""
class BountyNotFoundError(Exception):
    """Referenced bounty not found."""
class SubmissionNotFoundError(Exception):
    """Referenced submission not found."""
