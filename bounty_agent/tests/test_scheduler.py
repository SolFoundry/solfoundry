"""Tests for the agent scheduler module."""

import pytest
import time
from bounty_agent.scheduler import (
    AgentScheduler,
    AgentTier,
    AgentStatus,
    Task,
    MEMORY_LIMITS,
    TIER_DIFFICULTY_MAP,
)


# ── Fixtures ────────────────────────────────────────────────────

@pytest.fixture
def scheduler():
    """Create a fresh scheduler for each test."""
    s = AgentScheduler(
        memory_limit_mb=1600.0,
        heartbeat_timeout_sec=300.0,
        max_concurrent_tasks=5,
        peak_threshold=0.85,
    )
    yield s
    s.stop_heartbeat_monitor()


@pytest.fixture
def scheduler_with_agents(scheduler):
    """Scheduler with a full set of agents across all tiers."""
    agents = [
        ("agent-s1", AgentTier.S, "gw-1", "glm-5.1", "security"),
        ("agent-s2", AgentTier.S, "gw-7", "deepseek-v4", "security"),
        ("agent-a1", AgentTier.A, "gw-2", "qwen-3.5", "research"),
        ("agent-a2", AgentTier.A, "gw-3", "glm-5.1", "research"),
        ("agent-b1", AgentTier.B, "gw-4", "qwen-2.5-coder", "code"),
        ("agent-b2", AgentTier.B, "gw-5", "glm-5.1", "code"),
        ("agent-c1", AgentTier.C, "gw-6", "glm-5.1", "knowledge"),
        ("agent-c2", AgentTier.C, "gw-1", "glm-5.1", "ops"),
    ]
    for aid, tier, gw, model, dept in agents:
        scheduler.register_agent(aid, tier=tier, gateway_id=gw, model=model, department=dept)
        scheduler.update_heartbeat(aid, memory_mb=100.0)
    return scheduler


# ── Agent Registration Tests ────────────────────────────────────

class TestAgentRegistration:
    def test_register_single_agent(self, scheduler):
        profile = scheduler.register_agent("test-agent", tier=AgentTier.A, gateway_id="gw-1")
        assert profile.agent_id == "test-agent"
        assert profile.tier == AgentTier.A
        assert profile.status == AgentStatus.OFFLINE
        assert "test-agent" in scheduler.agents

    def test_register_multiple_agents(self, scheduler):
        for i in range(5):
            scheduler.register_agent(f"agent-{i}", tier=AgentTier.B)
        assert len(scheduler.agents) == 5

    def test_deregister_agent(self, scheduler):
        scheduler.register_agent("to-remove")
        assert scheduler.deregister_agent("to-remove") is True
        assert "to-remove" not in scheduler.agents

    def test_deregister_nonexistent(self, scheduler):
        assert scheduler.deregister_agent("no-such-agent") is False


# ── Tier Rating Tests ──────────────────────────────────────────

class TestTierRating:
    def test_tier_enum_ordering(self):
        assert AgentTier.S.value == "S"
        assert AgentTier.A.value == "A"
        assert AgentTier.B.value == "B"
        assert AgentTier.C.value == "C"

    def test_tier_difficulty_mapping(self):
        assert "critical" in TIER_DIFFICULTY_MAP[AgentTier.S]
        assert "easy" in TIER_DIFFICULTY_MAP[AgentTier.C]
        assert "medium" in TIER_DIFFICULTY_MAP[AgentTier.B]

    def test_tier_can_handle(self, scheduler):
        assert scheduler._tier_can_handle(AgentTier.S, "critical") is True
        assert scheduler._tier_can_handle(AgentTier.S, "easy") is False
        assert scheduler._tier_can_handle(AgentTier.C, "easy") is True
        assert scheduler._tier_can_handle(AgentTier.C, "hard") is False
        assert scheduler._tier_can_handle(AgentTier.A, "hard") is True
        assert scheduler._tier_can_handle(AgentTier.B, "medium") is True

    def test_auto_promote_high_reliability(self, scheduler):
        agent = scheduler.register_agent("star-agent", tier=AgentTier.B)
        agent.tasks_completed = 15
        agent.tasks_failed = 0
        assert scheduler._auto_promote("star-agent") is True
        assert agent.tier == AgentTier.A

    def test_auto_promote_insufficient_tasks(self, scheduler):
        agent = scheduler.register_agent("new-agent", tier=AgentTier.C)
        agent.tasks_completed = 3
        agent.tasks_failed = 0
        assert scheduler._auto_promote("new-agent") is False  # Need 10+ tasks

    def test_auto_demote_low_reliability(self, scheduler):
        agent = scheduler.register_agent("failing-agent", tier=AgentTier.A)
        agent.tasks_completed = 2
        agent.tasks_failed = 8
        assert scheduler._auto_demote("failing-agent") is True
        assert agent.tier == AgentTier.B

    def test_cannot_demote_below_c(self, scheduler):
        agent = scheduler.register_agent("bottom-agent", tier=AgentTier.C)
        agent.tasks_failed = 100
        assert scheduler._auto_demote("bottom-agent") is False

    def test_cannot_promote_above_s(self, scheduler):
        agent = scheduler.register_agent("top-agent", tier=AgentTier.S)
        agent.tasks_completed = 50
        assert scheduler._auto_promote("top-agent") is False

    def test_evaluate_tiers_batch(self, scheduler):
        # One agent to promote, one to demote
        good = scheduler.register_agent("good", tier=AgentTier.B)
        good.tasks_completed = 20
        good.tasks_failed = 1

        bad = scheduler.register_agent("bad", tier=AgentTier.A)
        bad.tasks_completed = 1
        bad.tasks_failed = 5

        changes = scheduler.evaluate_tiers()
        assert "good" in changes or "bad" in changes


# ── Heartbeat Tests ────────────────────────────────────────────

class TestHeartbeat:
    def test_update_heartbeat(self, scheduler):
        scheduler.register_agent("hb-agent")
        result = scheduler.update_heartbeat("hb-agent", memory_mb=200.0)
        assert result is True
        assert scheduler.agents["hb-agent"].memory_usage_mb == 200.0
        assert scheduler.agents["hb-agent"].status == AgentStatus.IDLE

    def test_update_nonexistent_heartbeat(self, scheduler):
        assert scheduler.update_heartbeat("no-agent") is False

    def test_heartbeat_timeout_detection(self, scheduler):
        scheduler.heartbeat_timeout_sec = 0.1  # Very short timeout
        agent = scheduler.register_agent("timeout-agent")
        scheduler.update_heartbeat("timeout-agent")
        agent.last_heartbeat = time.time() - 10  # Simulate expired heartbeat
        timed_out = scheduler.check_heartbeats()
        assert "timeout-agent" in timed_out
        assert agent.status == AgentStatus.ERROR


# ── Task Scheduling Tests ──────────────────────────────────────

class TestTaskScheduling:
    def test_submit_task(self, scheduler_with_agents):
        task = Task(task_id="t-1", difficulty="medium", department="code", priority=5)
        assert scheduler_with_agents.submit_task(task) is True
        assert len(scheduler_with_agents.task_queue) == 1

    def test_dispatch_to_correct_tier(self, scheduler_with_agents):
        # Critical task should go to S-tier agent
        task = Task(task_id="critical-1", difficulty="critical", priority=10, required_tier=AgentTier.S)
        scheduler_with_agents.submit_task(task)
        result = scheduler_with_agents.dispatch_next()
        assert result is not None
        task, agent = result
        assert agent.tier == AgentTier.S

    def test_dispatch_easy_to_c_tier(self, scheduler_with_agents):
        task = Task(task_id="easy-1", difficulty="easy", priority=1)
        scheduler_with_agents.submit_task(task)
        result = scheduler_with_agents.dispatch_next()
        assert result is not None
        _, agent = result
        assert agent.tier in (AgentTier.B, AgentTier.C)  # B or C can handle easy

    def test_dispatch_prefers_same_department(self, scheduler_with_agents):
        task = Task(task_id="sec-task", difficulty="hard", department="security", priority=5)
        scheduler_with_agents.submit_task(task)
        result = scheduler_with_agents.dispatch_next()
        assert result is not None
        _, agent = result
        assert agent.department == "security"

    def test_no_dispatch_when_all_busy(self, scheduler_with_agents):
        # Set max concurrent very low
        scheduler_with_agents.max_concurrent_tasks = 0
        task = Task(task_id="t-blocked", difficulty="easy")
        scheduler_with_agents.submit_task(task)
        assert scheduler_with_agents.dispatch_next() is None

    def test_complete_task_success(self, scheduler_with_agents):
        task = Task(task_id="t-done", difficulty="easy", priority=1)
        scheduler_with_agents.submit_task(task)
        result = scheduler_with_agents.dispatch_next()
        _, agent = result
        scheduler_with_agents.complete_task(agent.agent_id, task.task_id, success=True)
        assert agent.tasks_completed == 1
        assert agent.status == AgentStatus.IDLE

    def test_complete_task_failure(self, scheduler_with_agents):
        task = Task(task_id="t-fail", difficulty="easy", priority=1)
        scheduler_with_agents.submit_task(task)
        result = scheduler_with_agents.dispatch_next()
        _, agent = result
        scheduler_with_agents.complete_task(agent.agent_id, task.task_id, success=False)
        assert agent.tasks_failed == 1


# ── Memory Management Tests ────────────────────────────────────

class TestMemoryManagement:
    def test_memory_usage_calculation(self, scheduler_with_agents):
        usage = scheduler_with_agents._calculate_memory_load()
        assert usage > 0  # 8 agents * 100MB each = 800MB

    def test_memory_usage_percent(self, scheduler_with_agents):
        pct = scheduler_with_agents.memory_usage_percent()
        assert 0 < pct < 100

    def test_peak_shedding_rejects_task(self, scheduler):
        scheduler.memory_limit_mb = 200.0
        scheduler.peak_threshold = 0.5
        # Fill up memory
        for i in range(3):
            agent = scheduler.register_agent(f"mem-agent-{i}", tier=AgentTier.B)
            scheduler.update_heartbeat(f"mem-agent-{i}", memory_mb=150.0)
        task = Task(task_id="overflow", difficulty="easy", memory_estimate_mb=100.0)
        result = scheduler.submit_task(task)
        assert result is False
        assert scheduler.total_rejected == 1

    def test_load_shedding_frees_memory(self, scheduler):
        scheduler.memory_limit_mb = 500.0
        for i in range(5):
            agent = scheduler.register_agent(f"shed-{i}", tier=AgentTier.C)
            scheduler.update_heartbeat(f"shed-{i}", memory_mb=120.0)
            agent.status = AgentStatus.IDLE

        initial = scheduler._calculate_memory_load()
        shed = scheduler.enable_load_shedding()
        assert shed > 0
        after = scheduler._calculate_memory_load()
        assert after < initial

    def test_memory_limits_config(self):
        assert MEMORY_LIMITS["2gb"] == 850.0
        assert MEMORY_LIMITS["4gb"] == 1600.0
        assert MEMORY_LIMITS["8gb"] == 3200.0


# ── Staggered Onboarding Tests ─────────────────────────────────

class TestStaggeredOnboarding:
    def test_staggered_registration(self, scheduler):
        configs = [
            {"agent_id": "s1", "tier": "S", "gateway_id": "gw-1", "model": "glm", "department": "security"},
            {"agent_id": "a1", "tier": "A", "gateway_id": "gw-2", "model": "qwen", "department": "research"},
            {"agent_id": "b1", "tier": "B", "gateway_id": "gw-4", "model": "qwen-coder", "department": "code"},
        ]
        registered = scheduler.staggered_onboarding(configs, delay_seconds=0.01)
        assert len(registered) == 3
        assert all(rid in scheduler.agents for rid in registered)
        assert scheduler.agents["s1"].tier == AgentTier.S

    def test_staggered_defaults(self, scheduler):
        configs = [{"agent_id": f"a-{i}"} for i in range(3)]
        registered = scheduler.staggered_onboarding(configs, delay_seconds=0.01)
        assert len(registered) == 3
        for rid in registered:
            assert scheduler.agents[rid].tier == AgentTier.C


# ── Status & Metrics Tests ─────────────────────────────────────

class TestStatusMetrics:
    def test_get_status(self, scheduler_with_agents):
        status = scheduler_with_agents.get_status()
        assert status["total_agents"] == 8
        assert "tier_distribution" in status
        assert status["tier_distribution"]["S"] == 2
        assert status["tier_distribution"]["C"] == 2

    def test_get_agents_by_tier(self, scheduler_with_agents):
        s_agents = scheduler_with_agents.get_agents_by_tier(AgentTier.S)
        assert len(s_agents) == 2
        c_agents = scheduler_with_agents.get_agents_by_tier(AgentTier.C)
        assert len(c_agents) == 2

    def test_get_available_agents(self, scheduler_with_agents):
        available = scheduler_with_agents.get_available_agents()
        assert len(available) == 8  # All idle after heartbeat update

    def test_get_department_summary(self, scheduler_with_agents):
        summary = scheduler_with_agents.get_department_summary()
        assert "security" in summary
        assert "research" in summary
        assert "code" in summary
        assert summary["security"]["count"] == 2

    def test_reliability_score_calculation(self, scheduler):
        agent = scheduler.register_agent("rel-test", tier=AgentTier.A)
        # No tasks: neutral
        assert agent.reliability_score == 0.5
        # All success
        agent.tasks_completed = 8
        agent.tasks_failed = 2
        assert agent.reliability_score == 0.8
        # All failure
        agent.tasks_completed = 0
        agent.tasks_failed = 5
        assert agent.reliability_score == 0.0


# ── Edge Case Tests ────────────────────────────────────────────

class TestEdgeCases:
    def test_dispatch_with_no_agents(self, scheduler):
        task = Task(task_id="lonely", difficulty="easy")
        scheduler.submit_task(task)
        assert scheduler.dispatch_next() is None

    def test_dispatch_with_no_matching_tier(self, scheduler):
        scheduler.register_agent("c-agent", tier=AgentTier.C)
        scheduler.update_heartbeat("c-agent")
        task = Task(task_id="critical-task", difficulty="critical")
        scheduler.submit_task(task)
        assert scheduler.dispatch_next() is None  # C-tier can't handle critical

    def test_empty_queue_dispatch(self, scheduler_with_agents):
        assert scheduler_with_agents.dispatch_next() is None

    def test_concurrent_registrations(self, scheduler):
        """Test that RLock prevents race conditions."""
        import threading
        errors = []

        def register_many(start):
            try:
                for i in range(start, start + 50):
                    scheduler.register_agent(f"concurrent-{i}", tier=AgentTier.B)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=register_many, args=(i * 50,)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(errors) == 0
        assert len(scheduler.agents) == 200

    def test_priority_ordering(self, scheduler_with_agents):
        # Submit tasks with different priorities
        for pri in [1, 10, 5, 3, 8]:
            scheduler_with_agents.submit_task(
                Task(task_id=f"pri-{pri}", difficulty="easy", priority=pri)
            )
        # Dispatch should return highest priority first
        result = scheduler_with_agents.dispatch_next()
        assert result is not None
        task, _ = result
        assert task.priority == 10
