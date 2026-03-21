class BountyLifecycleError(Exception):
    """Base exception for bounty lifecycle operations."""

    def __init__(self, message: str, bounty_id: str = None, context: dict = None):
        super().__init__(message)
        self.bounty_id = bounty_id
        self.context = context or {}


class InvalidTransitionError(BountyLifecycleError):
    """Raised when attempting an invalid state transition."""

    def __init__(self, current_state: str, target_state: str, bounty_id: str = None):
        self.current_state = current_state
        self.target_state = target_state
        message = f"Cannot transition from '{current_state}' to '{target_state}'"
        super().__init__(message, bounty_id, {
            'current_state': current_state,
            'target_state': target_state
        })


class TerminalStateError(BountyLifecycleError):
    """Raised when attempting to modify a bounty in terminal state."""

    def __init__(self, state: str, bounty_id: str = None, operation: str = None):
        self.state = state
        self.operation = operation
        message = f"Cannot perform operation on bounty in terminal state '{state}'"
        if operation:
            message = f"Cannot '{operation}' bounty in terminal state '{state}'"
        super().__init__(message, bounty_id, {
            'state': state,
            'operation': operation
        })


class ClaimConflictError(BountyLifecycleError):
    """Raised when attempting to claim already claimed bounty."""

    def __init__(self, bounty_id: str, current_claimer: str, attempted_claimer: str):
        self.current_claimer = current_claimer
        self.attempted_claimer = attempted_claimer
        message = f"Bounty already claimed by '{current_claimer}', cannot claim by '{attempted_claimer}'"
        super().__init__(message, bounty_id, {
            'current_claimer': current_claimer,
            'attempted_claimer': attempted_claimer
        })


class TierGateError(BountyLifecycleError):
    """Raised when user lacks reputation for tier-gated bounty."""

    def __init__(self, required_tier: str, user_tier: str, bounty_id: str = None, user_id: str = None):
        self.required_tier = required_tier
        self.user_tier = user_tier
        self.user_id = user_id
        message = f"Tier {required_tier} bounty requires higher reputation (user tier: {user_tier})"
        super().__init__(message, bounty_id, {
            'required_tier': required_tier,
            'user_tier': user_tier,
            'user_id': user_id
        })


class DeadlineViolationError(BountyLifecycleError):
    """Raised when claim deadline is exceeded."""

    def __init__(self, deadline_hours: int, elapsed_hours: float, bounty_id: str = None):
        self.deadline_hours = deadline_hours
        self.elapsed_hours = elapsed_hours
        message = f"Claim deadline exceeded: {elapsed_hours:.1f}h elapsed (limit: {deadline_hours}h)"
        super().__init__(message, bounty_id, {
            'deadline_hours': deadline_hours,
            'elapsed_hours': elapsed_hours
        })


class WebhookProcessingError(BountyLifecycleError):
    """Raised when webhook processing fails."""

    def __init__(self, webhook_type: str, error_details: str, bounty_id: str = None):
        self.webhook_type = webhook_type
        self.error_details = error_details
        message = f"Webhook processing failed for '{webhook_type}': {error_details}"
        super().__init__(message, bounty_id, {
            'webhook_type': webhook_type,
            'error_details': error_details
        })
