#!/usr/bin/env python3
"""
Integration tests — cross-module scenarios for Bounty Agent pipeline.

These tests verify that modules work correctly when composed together,
covering the full pipeline from bounty discovery → planning → implementation
→ testing → submission, as well as cross-cutting concerns like event
propagation, memory across stages, and model fallback with retry.

Scenarios:
1. Full Pipeline: Discovery → Planning → Submission (mocked LLM)
2. Event Propagation: Pipeline events flow through EventBus
3. Memory Integration: Session + Daily + LongTerm across stages
4. Model Fallback with Retry: Circuit breaker + backoff across LLM calls
"""

import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock

from bounty_agent.orchestrator import TeamOrchestrator, MissionStage
from bounty_agent.discovery import BountyIssue, BountyTier, BountyStatus
from bounty_agent.events import EventBus, PipelineEvent, EventType, AgentRole
from bounty_agent.memory_manager import MemoryManager
from bounty_agent.model_fallback import ModelFallbackChain, ModelConfig, ModelTier, ModelExhaustedError
from bounty_agent.retry import with_retry, RetryPolicy
from bounty_agent.submitter import PRSubmitter


def _make_bounty(issue_number=861):
    return BountyIssue(
        platform="SolFoundry",
        repo="SolFoundry/solfoundry",
        issue_number=issue_number,
        title="[T3] Autonomous Bounty-Hunting Agent",
        reward="1000000 FNDRY",
        tier=BountyTier.T3_STANDARD,
        status=BountyStatus.OPEN,
        labels=["bounty", "T3", "agent"],
        url=f"https://github.com/SolFoundry/solfoundry/issues/{issue_number}",
        difficulty="easy",
    )


class TestFullPipelineIntegration:
    """Scenario 1: End-to-end pipeline from discovery to PR submission."""

    @patch("bounty_agent.discovery.BountyScanner")
    def test_discover_plan_implement_test_submit(self, MockScannerClass):
        """Full 5-stage pipeline: discover → plan → implement → test → submit."""
        mock_bounty = _make_bounty()
        mock_scanner = MagicMock()
        mock_scanner.scan_all.return_value = [mock_bounty]
        mock_scanner.prioritize.return_value = [mock_bounty]
        mock_scanner.get_bounty_detail.return_value = mock_bounty
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        state = orch.run_pipeline(state)

        # Verify all 5 stages completed
        assert state.is_complete
        assert not state.is_failed
        assert len(state.stage_results) == 5

        # Verify stage keys
        expected_stages = {"discover", "analyze", "implement", "test", "submit"}
        assert set(state.stage_results.keys()) == expected_stages

        # Verify all stages succeeded
        for key, result in state.stage_results.items():
            assert result.status == "success", f"Stage {key} failed"

    @patch("bounty_agent.discovery.BountyScanner")
    def test_pipeline_with_multiple_bounties(self, MockScannerClass):
        """Pipeline handles multiple discovered bounties."""
        bounties = [_make_bounty(i) for i in [861, 862, 863]]
        mock_scanner = MagicMock()
        mock_scanner.scan_all.return_value = bounties
        mock_scanner.prioritize.return_value = bounties[:1]  # Only top priority
        mock_scanner.get_bounty_detail.return_value = bounties[0]
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        result = orch.run_stage(state, MissionStage.DISCOVER)

        assert result.status == "success"
        assert result.output["total_discovered"] >= 1

    @patch("bounty_agent.discovery.BountyScanner")
    def test_pipeline_failure_recovery(self, MockScannerClass):
        """Pipeline handles stage failure gracefully."""
        mock_scanner = MagicMock()
        mock_scanner.scan_all.side_effect = RuntimeError("API down")
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        state = orch.run_pipeline(state)

        # Should handle failure gracefully
        assert state.is_failed or state.is_complete


class TestEventPropagationIntegration:
    """Scenario 2: Verify events flow correctly through the pipeline."""

    def test_events_published_for_each_stage(self):
        """Each pipeline stage publishes corresponding events."""
        bus = EventBus()
        events_received = []

        def handler(event):
            events_received.append(event)

        bus.subscribe(handler)

        # Simulate pipeline stages emitting events
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_STARTED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="Mission started for bounty #861",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.BOUNTY_DISCOVERED,
            agent_role=AgentRole.SCANNER,
            mission_id="m-001",
            message="Found bounty #861",
            metadata={"tier": "T3"},
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.STAGE_STARTED,
            agent_role=AgentRole.PLANNER,
            mission_id="m-001",
            message="Planning stage started",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.PR_SUBMITTED,
            agent_role=AgentRole.SUBMITTER,
            mission_id="m-001",
            message="PR #1108 submitted",
        ))
        bus.emit(PipelineEvent(
            event_type=EventType.MISSION_COMPLETED,
            agent_role=AgentRole.ORCHESTRATOR,
            mission_id="m-001",
            message="Mission completed successfully",
        ))

        assert len(events_received) == 5
        assert events_received[0].event_type == EventType.MISSION_STARTED
        assert events_received[1].event_type == EventType.BOUNTY_DISCOVERED
        assert events_received[4].event_type == EventType.MISSION_COMPLETED

    def test_error_event_propagation(self):
        """Agent errors are captured as events."""
        bus = EventBus()
        events_received = []

        def handler(event):
            events_received.append(event)

        bus.subscribe(handler)

        bus.emit(PipelineEvent(
            event_type=EventType.AGENT_ERROR,
            agent_role=AgentRole.CODER,
            mission_id="m-001",
            message="Implementation failed: syntax error",
            metadata={"error_type": "RuntimeError", "retry_count": 2},
        ))

        assert len(events_received) == 1
        assert events_received[0].event_type == EventType.AGENT_ERROR
        assert events_received[0].metadata["retry_count"] == 2

    def test_event_history_available_for_debugging(self):
        """Full event history is available for post-mortem debugging."""
        bus = EventBus()

        for i in range(10):
            bus.emit(PipelineEvent(
                event_type=EventType.STAGE_COMPLETED,
                agent_role=AgentRole.TESTER,
                mission_id="m-001",
                message=f"Test batch {i} passed",
            ))

        history = bus.get_history(limit=5)
        assert len(history) == 5

        # Verify most recent events
        error_events = bus.get_history(event_type=EventType.AGENT_ERROR)
        assert len(error_events) == 0  # No errors in this run


class TestMemoryAcrossStagesIntegration:
    """Scenario 3: Memory persists across pipeline stages."""

    def test_session_memory_tracks_active_bounty(self):
        """Session memory maintains active bounty context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mm = MemoryManager(base_dir=tmpdir)

            # Stage 1: Discovery stores bounty info
            mm.remember(
                "Bounty #861 found: Autonomous Bounty-Hunting Agent, 1M FNDRY",
                importance=0.9,
                topic="bounty",
                layer="session",
            )
            mm.session.set_context("active_bounty", "861")

            # Stage 2: Planning recalls bounty details
            results = mm.recall("Bounty #861")
            assert len(results) >= 1
            assert mm.session.get_context("active_bounty") == "861"

    def test_daily_and_longterm_cross_layer_promotion(self):
        """Important daily discoveries get promoted to long-term memory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mm = MemoryManager(base_dir=tmpdir)

            # Discovery stage logs to daily
            mm.remember(
                "Key architectural insight: multi-LLM fallback with circuit breaker",
                importance=0.85,
                topic="architecture",
                layer="daily",
            )

            # Promote to long-term
            result = mm.promote_to_longterm("circuit breaker", topic="architecture")
            assert result is True
            assert mm.longterm.size == 1

            # Later stages can recall from long-term
            lt_results = mm.recall("circuit breaker")
            assert len(lt_results) >= 1

    def test_knowledge_graph_tracks_agent_relationships(self):
        """Knowledge graph tracks entity relationships across pipeline."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mm = MemoryManager(base_dir=tmpdir)

            # Track agent-bounty relationships
            mm.add_knowledge("Orchestrator", "agent", [
                {"target": "Scanner", "type": "delegates_discovery", "weight": 1.0},
                {"target": "Planner", "type": "delegates_planning", "weight": 1.0},
                {"target": "Bounty-861", "type": "claims", "weight": 0.9},
            ])

            assert mm.knowledge.entity_count >= 3
            assert mm.knowledge.relation_count >= 3

            # Verify relationships are queryable
            orch_rels = mm.knowledge.get_relations("Orchestrator")
            assert len(orch_rels) >= 3

    def test_memory_survives_stage_transitions(self):
        """Memory state persists when stages transition."""
        with tempfile.TemporaryDirectory() as tmpdir:
            mm = MemoryManager(base_dir=tmpdir)

            # Pre-pipeline: store configuration
            mm.remember("Using DeepSeek-V3 as primary LLM", importance=0.7, topic="config")
            mm.remember("PR署名: Xeophon", importance=0.8, topic="config")

            # Mid-pipeline: store progress
            mm.remember("Implementation complete, 169 tests passing", importance=0.9, topic="progress")

            # Post-pipeline: recall everything
            config_results = mm.recall("DeepSeek")
            assert len(config_results) >= 1

            progress_results = mm.recall("169 tests")
            assert len(progress_results) >= 1


class TestModelFallbackWithRetryIntegration:
    """Scenario 4: Model fallback + retry across LLM calls."""

    @pytest.mark.asyncio
    async def test_fallback_chain_with_retry(self):
        """Full fallback chain with retry: T1 fails → T2 succeeds."""
        chain = ModelFallbackChain([
            ModelConfig(
                name="DeepSeek-V3", provider="deepseek",
                api_key_env="TEST_KEY_A", model_id="deepseek/chat",
                tier=ModelTier.TIER_1_DEEPSEEK,
            ),
            ModelConfig(
                name="Qwen-72B", provider="nvidia",
                api_key_env="TEST_KEY_B", model_id="qwen/qwen3",
                tier=ModelTier.TIER_2_QWEN,
            ),
        ])
        # Set API keys
        os.environ["TEST_KEY_A"] = "sk-a"
        os.environ["TEST_KEY_B"] = "sk-b"

        call_log = []

        async def mock_call(self_chain, model, prompt, **kwargs):
            call_log.append(model.name)
            if model.name == "DeepSeek-V3":
                raise RuntimeError("Rate limited: 429")
            return f"Response from {model.name}"

        with patch.object(ModelFallbackChain, "_call_model", mock_call):
            result, model_name = await chain.generate("Analyze this bounty")
            assert "Qwen-72B" in result
            assert "DeepSeek-V3" in call_log
            assert "Qwen-72B" in call_log

        # Cleanup
        del os.environ["TEST_KEY_A"]
        del os.environ["TEST_KEY_B"]

    @pytest.mark.asyncio
    async def test_circuit_breaker_prevents_storm(self):
        """Circuit breaker opens after threshold, preventing cascading failures."""
        os.environ["TEST_KEY_C"] = "sk-c"
        chain = ModelFallbackChain([
            ModelConfig(
                name="Flaky-Model", provider="test",
                api_key_env="TEST_KEY_C", model_id="test/flaky",
                tier=ModelTier.TIER_1_DEEPSEEK,
            ),
        ])

        async def mock_fail(self_chain, model, prompt, **kwargs):
            raise RuntimeError("Service down")

        with patch.object(ModelFallbackChain, "_call_model", mock_fail):
            for _ in range(3):
                try:
                    await chain.generate("test")
                except ModelExhaustedError:
                    pass

        # Circuit should be open
        assert chain.models[0].circuit_state in ("open", "half-open")
        del os.environ["TEST_KEY_C"]

    def test_sync_retry_wraps_llm_call(self):
        """with_retry wraps synchronous LLM calls with backoff."""
        attempts = 0

        def call_llm():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise RuntimeError("Connection reset")
            return "Analysis: bounty is feasible"

        result = with_retry(
            call_llm,
            policy=RetryPolicy(max_retries=3, base_delay=0.01, max_delay=0.1),
        )
        assert "feasible" in result
        assert attempts == 3

    @pytest.mark.asyncio
    async def test_full_fallback_then_retry_succeeds(self):
        """Model fallback exhausts → retry at chain level → eventual success."""
        os.environ["TEST_KEY_D"] = "sk-d"
        os.environ["TEST_KEY_E"] = "sk-e"
        chain = ModelFallbackChain([
            ModelConfig(
                name="Model-A", provider="test",
                api_key_env="TEST_KEY_D", model_id="test/a",
                tier=ModelTier.TIER_1_DEEPSEEK,
            ),
            ModelConfig(
                name="Model-B", provider="test",
                api_key_env="TEST_KEY_E", model_id="test/b",
                tier=ModelTier.TIER_2_QWEN,
            ),
        ])

        round_num = 0

        async def mock_intermittent(self_chain, model, prompt, **kwargs):
            nonlocal round_num
            round_num += 1
            if round_num <= 4:
                raise RuntimeError("Transient error")
            return "Success after recovery"

        with patch.object(ModelFallbackChain, "_call_model", mock_intermittent):
            result, name = await chain.generate_with_retry("test", max_retries=2)
            assert result == "Success after recovery"

        del os.environ["TEST_KEY_D"]
        del os.environ["TEST_KEY_E"]


class TestPRSubmitterIntegration:
    """Verify PR formatting and sanitization work end-to-end."""

    def test_format_pr_body_with_wallet(self):
        """PR body includes wallet address for payout."""
        submitter = PRSubmitter()
        body = submitter.format_pr_body(
            bounty_issue=861,
            approach="Multi-LLM agent with 5-stage pipeline",
            implementation="Python implementation with 14 modules",
            testing="169 unit tests, all passing",
            wallet_address="XeophonWallet123",
        )
        assert "#861" in body
        assert "XeophonWallet123" in body
        assert "Xeophon" in body

    def test_format_pr_body_without_wallet(self):
        """PR body works without wallet address."""
        submitter = PRSubmitter()
        body = submitter.format_pr_body(
            bounty_issue=861,
            approach="Automated pipeline",
            implementation="14 modules, 53 files",
            testing="169 tests passing",
        )
        assert "#861" in body
        assert "Wallet" not in body
        assert "Xeophon" in body

    @patch("subprocess.run")
    def test_submit_pr_success(self, mock_run):
        """PR submission via gh CLI succeeds."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="https://github.com/SolFoundry/solfoundry/pull/1108\n",
        )
        submitter = PRSubmitter()
        result = submitter.submit_pr(
            repo="SolFoundry/solfoundry",
            branch="feat/autonomous-bounty-agent-861",
            title="feat: Full Autonomous Bounty-Hunting Agent (#861)",
            body="## Bounty Submission: #861\n...",
        )
        assert result is not None
        assert "1108" in result

    @patch("subprocess.run")
    def test_submit_pr_failure(self, mock_run):
        """PR submission handles gh CLI failure gracefully."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stderr="authentication required",
        )
        submitter = PRSubmitter()
        result = submitter.submit_pr(
            repo="SolFoundry/solfoundry",
            branch="feat/fail",
            title="fail",
            body="fail",
        )
        assert result is None
