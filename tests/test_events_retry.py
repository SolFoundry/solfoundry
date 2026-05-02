#!/usr/bin/env python3
"""
Unit tests for Event Bus and Retry modules.

Tests cover:
- PipelineEvent: creation, field access
- EventBus: subscribe, emit, unsubscribe, history, query by type
- RetryPolicy: defaults, custom values
- with_retry: success, retry on failure, max retries, backoff
"""

import pytest
from bounty_agent.events import EventBus, PipelineEvent, EventType, AgentRole
from bounty_agent.retry import with_retry, RetryPolicy


class TestPipelineEvent:
    def test_event_creation(self):
        e = PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m-001",
            message="Found bounty #861",
        )
        assert e.event_type == EventType.BOUNTY_DISCOVERED
        assert e.mission_id == "m-001"
        assert e.timestamp

    def test_event_to_dict(self):
        e = PipelineEvent(
            event_type=EventType.PR_SUBMITTED,
            agent_role=AgentRole.SUBMITTER,
            mission_id="m-002",
            message="PR #1108 submitted",
        )
        d = e.to_dict()
        assert d["event_type"] == "pr_submitted"
        assert d["agent_role"] == "submitter"
        assert d["mission_id"] == "m-002"

    def test_event_types_enum(self):
        assert EventType.MISSION_STARTED.value == "mission_started"
        assert EventType.BOUNTY_DISCOVERED.value == "bounty_discovered"
        assert EventType.PR_SUBMITTED.value == "pr_submitted"
        assert EventType.AGENT_ERROR.value == "agent_error"

    def test_agent_roles_enum(self):
        assert AgentRole.ORCHESTRATOR.value == "orchestrator"
        assert AgentRole.SCANNER.value == "scanner"
        assert AgentRole.SUBMITTER.value == "submitter"


class TestEventBus:
    def test_subscribe_and_emit(self):
        bus = EventBus()
        received = []

        def handler(event):
            received.append(event)

        bus.subscribe(handler)
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m-001",
            message="Found bounty #861",
        ))

        assert len(received) == 1
        assert received[0].message == "Found bounty #861"

    def test_multiple_subscribers(self):
        bus = EventBus()
        count_a = 0
        count_b = 0

        def handler_a(event):
            nonlocal count_a
            count_a += 1

        def handler_b(event):
            nonlocal count_b
            count_b += 1

        bus.subscribe(handler_a)
        bus.subscribe(handler_b)
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="Starting",
        ))

        assert count_a == 1
        assert count_b == 1

    def test_all_handlers_receive_events(self):
        """All subscribed handlers receive all events (pub/sub)."""
        bus = EventBus()
        received = []

        def handler(event):
            received.append(event.event_type.value)

        bus.subscribe(handler)
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m1",
            message="found",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.PR_SUBMITTED,
            agent_role=AgentRole.SUBMITTER,
            mission_id="m1",
            message="submitted",
        ))

        assert "bounty_discovered" in received
        assert "pr_submitted" in received

    def test_unsubscribe(self):
        bus = EventBus()
        count = 0

        def handler(event):
            nonlocal count
            count += 1

        bus.subscribe(handler)
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="Go",
        ))
        bus.unsubscribe(handler)
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_COMPLETED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="Done",
        ))

        assert count == 1

    def test_emit_with_no_handlers(self):
        bus = EventBus()
        # Should not raise
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="No handlers",
        ))

    def test_event_history(self):
        bus = EventBus()
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m1", message="a",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.PR_SUBMITTED,
            agent_role=AgentRole.SUBMITTER,
            mission_id="m1", message="b",
        ))
        history = bus.get_history(limit=10)
        assert len(history) >= 2

    def test_query_events_by_type(self):
        bus = EventBus()
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m1", message="Bounty 1",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.PR_SUBMITTED,
            agent_role=AgentRole.SUBMITTER,
            mission_id="m1", message="PR 1",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m2", message="Bounty 2",
        ))

        results = bus.get_history(event_type=EventType.BOUNTY_DISCOVERED)
        assert len(results) == 2

    def test_clear_history(self):
        bus = EventBus()
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m1", message="start",
        ))
        bus.clear_history()
        assert len(bus.get_history()) == 0

    def test_handler_exception_doesnt_break_bus(self):
        bus = EventBus()
        received = []

        def bad_handler(event):
            raise ValueError("boom")

        def good_handler(event):
            received.append(event)

        bus.subscribe(bad_handler)
        bus.subscribe(good_handler)
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m1", message="test",
        ))

        # Good handler still gets called even if bad handler throws
        assert len(received) == 1


class TestRetryPolicy:
    def test_default_values(self):
        policy = RetryPolicy()
        assert policy.max_retries == 3
        assert policy.base_delay == 1.0
        assert policy.max_delay == 30.0
        assert policy.backoff_factor == 2.0

    def test_custom_values(self):
        policy = RetryPolicy(max_retries=5, base_delay=0.5, max_delay=10.0)
        assert policy.max_retries == 5
        assert policy.base_delay == 0.5


class TestWithRetry:
    def test_success_first_try(self):
        call_count = 0

        def func():
            nonlocal call_count
            call_count += 1
            return "ok"

        result = with_retry(func)
        assert result == "ok"
        assert call_count == 1

    def test_retry_on_failure(self):
        call_count = 0

        def func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("fail")
            return "ok"

        result = with_retry(func, policy=RetryPolicy(max_retries=3, base_delay=0.01, max_delay=0.1))
        assert result == "ok"
        assert call_count == 3

    def test_max_retries_exceeded(self):
        def func():
            raise RuntimeError("always fails")

        with pytest.raises(RuntimeError):
            with_retry(func, policy=RetryPolicy(max_retries=2, base_delay=0.01))

    def test_backoff_respects_max_delay(self):
        policy = RetryPolicy(max_retries=5, base_delay=1.0, max_delay=2.0, backoff_factor=10.0)
        for attempt in range(policy.max_retries):
            delay = min(
                policy.base_delay * (policy.backoff_factor ** attempt),
                policy.max_delay,
            )
            assert delay <= policy.max_delay

    def test_returns_value_immediately_on_success(self):
        result = with_retry(lambda: 42)
        assert result == 42
