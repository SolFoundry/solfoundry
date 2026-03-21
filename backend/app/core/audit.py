"""Audit logger for sensitive operations.

Every audit event is emitted to the dedicated ``solfoundry.audit`` logger
(which writes to ``logs/audit.log``).  Events are structured JSON with fields:

    action          – verb describing the operation (e.g. "payout.created")
    resource_type   – entity type (e.g. "payout", "bounty", "auth")
    resource_id     – primary key / identifier of the affected resource
    user_id         – authenticated user performing the action (if known)
    details         – free-form dict with additional context
    correlation_id  – automatically injected by CorrelationFilter
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

audit_logger = logging.getLogger("solfoundry.audit")


def audit_log(
    action: str,
    resource_type: str,
    resource_id: str = "",
    user_id: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Write a single audit event."""
    audit_logger.info(
        "AUDIT %s %s/%s by user=%s",
        action,
        resource_type,
        resource_id,
        user_id or "system",
        extra={
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "details": details or {},
        },
    )
