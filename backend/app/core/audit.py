"""Audit logging for security-sensitive operations.

This module provides audit logging for:
- Authentication events (login, logout, token refresh)
- Payout operations (escrow, release, refund)
- Bounty state changes (claim, complete, cancel)
- Permission changes (role updates, access grants)
- Webhook events (signature verification, event processing)

Audit logs are stored separately from application logs and include
additional security context like actor, IP address, and user agent.

Usage:
    from app.core.audit import audit_log, AuditAction

    # Log a payout
    audit_log(
        action=AuditAction.PAYOUT_RELEASED,
        actor="contributor_123",
        resource="bounty",
        resource_id="bounty_456",
        result="success",
        ip_address="192.168.1.1",
    )
"""

from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from dataclasses import dataclass, field

from app.core.logging_config import get_audit_logger, get_correlation_id


class AuditAction(str, Enum):
    """Audit action types for security-sensitive operations."""

    # Authentication events
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_TOKEN_REFRESH = "auth.token_refresh"
    AUTH_WALLET_VERIFY = "auth.wallet_verify"
    AUTH_TOKEN_INVALID = "auth.token_invalid"
    AUTH_TOKEN_EXPIRED = "auth.token_expired"

    # Payout events
    PAYOUT_ESCROW_CREATED = "payout.escrow_created"
    PAYOUT_ESCROW_LOCKED = "payout.escrow_locked"
    PAYOUT_RELEASED = "payout.released"
    PAYOUT_REFUNDED = "payout.refunded"
    PAYOUT_FAILED = "payout.failed"

    # Bounty state changes
    BOUNTY_CREATED = "bounty.created"
    BOUNTY_CLAIMED = "bounty.claimed"
    BOUNTY_UNCLAIMED = "bounty.unclaimed"
    BOUNTY_COMPLETED = "bounty.completed"
    BOUNTY_CANCELLED = "bounty.cancelled"
    BOUNTY_ESCALATED = "bounty.escalated"

    # Contributor events
    CONTRIBUTOR_REGISTERED = "contributor.registered"
    CONTRIBUTOR_PROFILE_UPDATED = "contributor.profile_updated"
    CONTRIBUTOR_REPUTATION_CHANGED = "contributor.reputation_changed"
    CONTRIBUTOR_BANNED = "contributor.banned"
    CONTRIBUTOR_UNBANNED = "contributor.unbanned"

    # Webhook events
    WEBHOOK_RECEIVED = "webhook.received"
    WEBHOOK_VERIFIED = "webhook.verified"
    WEBHOOK_REJECTED = "webhook.rejected"
    WEBHOOK_FAILED = "webhook.failed"

    # Permission events
    PERMISSION_GRANTED = "permission.granted"
    PERMISSION_REVOKED = "permission.revoked"
    ROLE_ASSIGNED = "role.assigned"
    ROLE_REMOVED = "role.removed"

    # System events
    SYSTEM_CONFIG_CHANGED = "system.config_changed"
    SYSTEM_KEY_ROTATED = "system.key_rotated"
    SYSTEM_BACKUP_CREATED = "system.backup_created"


@dataclass
class AuditEntry:
    """Structured audit log entry.

    Attributes:
        action: The action that was performed
        actor: Who performed the action (user ID, system, or API key)
        resource: Type of resource affected (bounty, contributor, payout)
        resource_id: ID of the specific resource
        result: Outcome of the action (success, failure, pending)
        ip_address: Source IP address of the request
        user_agent: User agent string from the request
        correlation_id: Request correlation ID for tracing
        timestamp: When the action occurred
        metadata: Additional context-specific data
    """

    action: AuditAction
    actor: str
    resource: str
    resource_id: Optional[str] = None
    result: str = "success"  # success, failure, pending
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    correlation_id: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "action": self.action.value,
            "actor": self.actor,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "result": self.result,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "correlation_id": self.correlation_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


class AuditLogger:
    """Logger for audit events with structured output.

    Provides a simple interface for logging security-sensitive operations
    with consistent formatting and context.

    Example:
        logger = AuditLogger()
        logger.log(
            action=AuditAction.PAYOUT_RELEASED,
            actor="contributor_123",
            resource="bounty",
            resource_id="bounty_456",
            result="success",
            ip_address="192.168.1.1",
        )
    """

    def __init__(self):
        self._logger = get_audit_logger()

    def log(
        self,
        action: AuditAction,
        actor: str,
        resource: str,
        resource_id: Optional[str] = None,
        result: str = "success",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log an audit event.

        Args:
            action: The action that was performed
            actor: Who performed the action
            resource: Type of resource affected
            resource_id: ID of the specific resource
            result: Outcome (success, failure, pending)
            ip_address: Source IP address
            user_agent: User agent string
            metadata: Additional context data
        """
        entry = AuditEntry(
            action=action,
            actor=actor,
            resource=resource,
            resource_id=resource_id,
            result=result,
            ip_address=ip_address,
            user_agent=user_agent,
            correlation_id=get_correlation_id(),
            metadata=metadata or {},
        )

        # Determine log level based on result
        # "success" and "pending" are normal states -> info
        # failure states -> warning
        log_level = "info" if result.lower() in ("success", "pending") else "warning"

        # Log with structured data
        getattr(self._logger, log_level)(
            f"Audit: {action.value}",
            extra={
                "extra_data": entry.to_dict(),
                "action": action.value,
                "actor": actor,
                "resource": resource,
                "resource_id": resource_id,
                "result": result,
                "ip_address": ip_address,
            },
        )

    def log_auth_event(
        self,
        action: AuditAction,
        actor: str,
        result: str = "success",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log an authentication event.

        Convenience method for auth-related audit events.
        """
        self.log(
            action=action,
            actor=actor,
            resource="auth",
            result=result,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    def log_payout_event(
        self,
        action: AuditAction,
        actor: str,
        bounty_id: str,
        amount: float,
        token: str,
        wallet_address: str,
        result: str = "success",
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a payout event.

        Convenience method for payout-related audit events.
        
        Note: Wallet address is redacted for privacy/security.
        """
        # Redact wallet address for privacy - only keep last 4 characters
        redacted_wallet = f"****{wallet_address[-4:]}" if len(wallet_address) > 4 else "****"
        
        self.log(
            action=action,
            actor=actor,
            resource="payout",
            resource_id=bounty_id,
            result=result,
            ip_address=ip_address,
            metadata={
                "amount": amount,
                "token": token,
                "wallet_address_redacted": redacted_wallet,
                **(metadata or {}),
            },
        )

    def log_bounty_event(
        self,
        action: AuditAction,
        actor: str,
        bounty_id: str,
        result: str = "success",
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a bounty state change event.

        Convenience method for bounty-related audit events.
        """
        self.log(
            action=action,
            actor=actor,
            resource="bounty",
            resource_id=bounty_id,
            result=result,
            ip_address=ip_address,
            metadata=metadata,
        )

    def log_webhook_event(
        self,
        action: AuditAction,
        event_type: str,
        delivery_id: str,
        repository: str,
        result: str = "success",
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a webhook event.

        Convenience method for webhook-related audit events.
        """
        self.log(
            action=action,
            actor="github",
            resource="webhook",
            resource_id=delivery_id,
            result=result,
            ip_address=ip_address,
            metadata={
                "event_type": event_type,
                "repository": repository,
                **(metadata or {}),
            },
        )


# Global audit logger instance
_audit_logger: Optional[AuditLogger] = None


def get_audit_logger_instance() -> AuditLogger:
    """Get or create the global audit logger instance."""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


def audit_log(
    action: AuditAction,
    actor: str,
    resource: str,
    resource_id: Optional[str] = None,
    result: str = "success",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Convenience function for logging audit events.

    This is a shorthand for:
        logger = get_audit_logger_instance()
        logger.log(...)

    Example:
        audit_log(
            action=AuditAction.BOUNTY_CLAIMED,
            actor="contributor_123",
            resource="bounty",
            resource_id="bounty_456",
        )
    """
    logger = get_audit_logger_instance()
    logger.log(
        action=action,
        actor=actor,
        resource=resource,
        resource_id=resource_id,
        result=result,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )
