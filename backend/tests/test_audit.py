"""Tests for the audit logging module."""

import logging

import pytest

from app.core.audit import audit_log, audit_logger
from app.core.correlation import set_correlation_id


@pytest.fixture(autouse=True)
def _enable_audit_propagation():
    """Temporarily enable propagation so caplog can capture audit records."""
    original = audit_logger.propagate
    audit_logger.propagate = True
    yield
    audit_logger.propagate = original


class TestAuditLog:
    def test_audit_log_emits_info_record(self, caplog):
        with caplog.at_level(logging.INFO, logger="solfoundry.audit"):
            audit_log(
                action="payout.created",
                resource_type="payout",
                resource_id="tx-abc123",
                user_id="user-42",
                details={"amount": 1000},
            )

        assert len(caplog.records) >= 1
        record = caplog.records[-1]
        assert record.levelname == "INFO"
        assert "AUDIT" in record.message
        assert "payout.created" in record.message
        assert record.action == "payout.created"  # type: ignore[attr-defined]
        assert record.resource_type == "payout"  # type: ignore[attr-defined]
        assert record.resource_id == "tx-abc123"  # type: ignore[attr-defined]
        assert record.user_id == "user-42"  # type: ignore[attr-defined]
        assert record.details == {"amount": 1000}  # type: ignore[attr-defined]

    def test_audit_log_defaults_user_to_system(self, caplog):
        with caplog.at_level(logging.INFO, logger="solfoundry.audit"):
            audit_log("webhook.received", "webhook", resource_id="delivery-99")

        record = caplog.records[-1]
        assert "system" in record.message

    def test_audit_log_with_correlation_id(self, caplog):
        set_correlation_id("audit-cid-test")
        with caplog.at_level(logging.INFO, logger="solfoundry.audit"):
            audit_log("auth.login", "auth", user_id="u1")
        assert len(caplog.records) >= 1

    def test_audit_log_empty_details(self, caplog):
        with caplog.at_level(logging.INFO, logger="solfoundry.audit"):
            audit_log("bounty.deleted", "bounty", resource_id="b-1")
        record = caplog.records[-1]
        assert record.details == {}  # type: ignore[attr-defined]

    def test_audit_log_multiple_events(self, caplog):
        with caplog.at_level(logging.INFO, logger="solfoundry.audit"):
            audit_log("bounty.created", "bounty", resource_id="b-1")
            audit_log("bounty.updated", "bounty", resource_id="b-1")
            audit_log("bounty.cancelled", "bounty", resource_id="b-1")

        audit_records = [r for r in caplog.records if "AUDIT" in r.message]
        assert len(audit_records) == 3
        actions = [r.action for r in audit_records]  # type: ignore[attr-defined]
        assert actions == ["bounty.created", "bounty.updated", "bounty.cancelled"]
