"""Unit tests for the agent scheduler module — aligned with AgentScheduler API."""

import time
import threading
from bounty_agent.scheduler import (
    AgentScheduler,
    AgentProfile,
    AgentTier,
    AgentStatus,
    Task,
)


class TestAgentProfile:
    def test_default_tier(self):
        p = AgentProfile(agent_id="a1")
        assert p.tier == AgentTier.C  # New agents default to C

    def test_is_available_idle(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.IDLE)
        assert p.is_available is True

    def test_is_available_online(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.ONLINE)
        assert p.is_available is True

    def test_is_available_error(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.ERROR)
        assert p.is_available is False

    def test_is_available_busy(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.BUSY)
        assert p.is_available is False

    def test_is_available_offline(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.OFFLINE)
        assert p.is_available is False

    def test_reliability_score_with_tasks(self):
        p = AgentProfile(agent_id="a1", tasks_completed=8, tasks_failed=2)
        assert p.reliability_score == 0.8

    def test_reliability_score_zero_tasks(self):
        p = AgentProfile(agent_id="a1")
        assert p.reliability_score == 0.5  # Neutral default

    def test_reliability_all_failures(self):
        p = AgentProfile(agent_id="a1", tasks_completed=0, tasks_failed=5)
        assert p.reliability_score == 0.0

    def test_reliability_perfect(self):
        p = AgentProfile(agent_id="a1", tasks_completed=10, tasks_failed=0)
        assert p.reliability_score == 1.0


class TestTask:
    def test_priority_ordering(self):
        t1 = Task(task_id="t1", difficulty="easy", priority=3)
        t2 = Task(task_id="t2", difficulty="medium", priority=8)
        # Higher priority should be dispatched first
        assert t2.priority > t1.priority

    def test_task_defaults(self):
        t = Task(task_id="t1")
        assert t.difficulty == "medium"
        assert t.assigned_agent is None
        assert t.priority == 0


class TestAgentScheduler:
    def setup_method(self):
        self.scheduler = AgentScheduler(memory_limit_mb=1600.0, max_concurrent_tasks=10)
        # Register agents across tiers
        configs = [
            ("agent-s1", AgentTier.S, "gw-1", "glm-5.1", "security"),
            ("agent-a1", AgentTier.A, "gw-2", "qwen-3.5", "research"),
            ("agent-a2", AgentTier.A, "gw-3", "glm-5.1", "research"),
            ("agent-b1", AgentTier.B, "gw-4", "qwen-coder", "code"),
            ("agent-b2", AgentTier.B, "gw-5", "glm-5.1", "code"),
            ("agent-c1", AgentTier.C, "gw-6", "glm-5.1", "knowledge"),
            ("agent-c2", AgentTier.C, "gw-1", "glm-5.1", "ops"),
        ]
        for aid, tier, gw, model, dept in configs:
            self.scheduler.register_agent(aid, tier=tier, gateway_id=gw, model=model, department=dept)
            self.scheduler.update_heartbeat(aid, memory_mb=100.0)

    def test_submit_task(self):
        task = Task(task_id="t1", difficulty="medium", priority=5)
        assert self.scheduler.submit_task(task) is True
        assert len(self.scheduler.task_queue) == 1

    def test_submit_task_peak_shedding(self):
        s = AgentScheduler(memory_limit_mb=200.0, peak_threshold=0.5)
        for i in range(3):
            s.register_agent(f"m-{i}", tier=AgentTier.B)
            s.update_heartbeat(f"m-{i}", memory_mb=150.0)
        task = Task(task_id="overflow", difficulty="easy", memory_estimate_mb=100.0)
        assert s.submit_task(task) is False
        assert s.total_rejected == 1

    def test_dispatch_next_assigns(self):
        task = Task(task_id="t1", difficulty="hard", priority=5)
        self.scheduler.submit_task(task)
        result = self.scheduler.dispatch_next()
        assert result is not None
        assigned_task, agent = result
        assert assigned_task.assigned_agent is not None
        assert agent.tier in (AgentTier.S, AgentTier.A)  # Only S/A handle hard

    def test_dispatch_prefers_higher_tier(self):
        task = Task(task_id="t1", difficulty="hard", priority=8)
        self.scheduler.submit_task(task)
        result = self.scheduler.dispatch_next()
        assert result is not None
        assert result[1].tier == AgentTier.S  # S-tier preferred for hard tasks

    def test_dispatch_easy_to_lower_tier(self):
        task = Task(task_id="t1", difficulty="easy", priority=1)
        self.scheduler.submit_task(task)
        result = self.scheduler.dispatch_next()
        assert result is not None
        assert result[1].tier in (AgentTier.B, AgentTier.C)  # B/C handle easy

    def test_dispatch_prefers_same_department(self):
        task = Task(task_id="t1", difficulty="hard", department="security", priority=5)
        self.scheduler.submit_task(task)
        result = self.scheduler.dispatch_next()
        assert result is not None
        assert result[1].department == "security"

    def test_complete_task_success(self):
        self.scheduler.submit_task(Task(task_id="t1", difficulty="easy"))
        result = self.scheduler.dispatch_next()
        agent_id = result[1].agent_id
        self.scheduler.complete_task(agent_id, "t1", success=True)
        agent = self.scheduler.agents[agent_id]
        assert agent.tasks_completed == 1
        assert agent.status == AgentStatus.IDLE

    def test_complete_task_failure(self):
        self.scheduler.submit_task(Task(task_id="t1", difficulty="easy"))
        result = self.scheduler.dispatch_next()
        self.scheduler.complete_task(result[1].agent_id, "t1", success=False)
        assert self.scheduler.agents[result[1].agent_id].tasks_failed == 1

    def test_update_heartbeat(self):
        self.scheduler.update_heartbeat("agent-s1", memory_mb=400)
        agent = self.scheduler.agents["agent-s1"]
        assert agent.memory_usage_mb == 400
        assert agent.last_heartbeat > 0

    def test_get_status(self):
        status = self.scheduler.get_status()
        assert status["total_agents"] == 7
        assert "tier_distribution" in status
        assert status["tier_distribution"]["S"] == 1

    def test_check_memory_watermarks(self):
        # Push agent memory high
        self.scheduler.agents["agent-s1"].memory_usage_mb = 1450
        pct = self.scheduler.memory_usage_percent()
        assert pct > 80  # Should be high

    def test_auto_promote(self):
        agent = self.scheduler.agents["agent-b1"]
        agent.tasks_completed = 15
        agent.tasks_failed = 0
        assert self.scheduler._auto_promote("agent-b1") is True
        assert agent.tier == AgentTier.A

    def test_auto_demote(self):
        agent = self.scheduler.agents["agent-a1"]
        agent.tasks_completed = 2
        agent.tasks_failed = 8
        assert self.scheduler._auto_demote("agent-a1") is True
        assert agent.tier == AgentTier.B

    def test_heartbeat_timeout(self):
        self.scheduler.heartbeat_timeout_sec = 0.1
        agent = self.scheduler.agents["agent-c1"]
        agent.last_heartbeat = time.time() - 10  # Expired
        timed_out = self.scheduler.check_heartbeats()
        assert "agent-c1" in timed_out
        assert agent.status == AgentStatus.ERROR

    def test_no_dispatch_when_all_busy(self):
        self.scheduler.max_concurrent_tasks = 0
        task = Task(task_id="blocked", difficulty="easy")
        self.scheduler.submit_task(task)
        assert self.scheduler.dispatch_next() is None

    def test_staggered_onboarding(self):
        configs = [
            {"agent_id": "s1", "tier": "S", "gateway_id": "gw-1", "model": "glm", "department": "sec"},
            {"agent_id": "a1", "tier": "A", "gateway_id": "gw-2", "model": "qwen", "department": "res"},
        ]
        registered = self.scheduler.staggered_onboarding(configs, delay_seconds=0.01)
        assert len(registered) == 2
        assert self.scheduler.agents["s1"].tier == AgentTier.S

    def test_load_shedding(self):
        # Add idle C-tier agents, then shed them
        for i in range(3):
            aid = f"shed-{i}"
            self.scheduler.register_agent(aid, tier=AgentTier.C)
            self.scheduler.update_heartbeat(aid, memory_mb=200.0)
            self.scheduler.agents[aid].status = AgentStatus.IDLE
        shed = self.scheduler.enable_load_shedding()
        assert shed > 0

    def test_concurrent_registrations(self):
        """Test RLock prevents race conditions."""
        errors = []

        def register_many(start):
            try:
                for i in range(start, start + 50):
                    self.scheduler.register_agent(f"concurrent-{i}", tier=AgentTier.B)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=register_many, args=(i * 50,)) for i in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(errors) == 0
        assert len(self.scheduler.agents) > 7  # Original 7 + concurrent 200

    def test_priority_ordering_in_queue(self):
        """Higher priority tasks should be dispatched first."""
        for pri in [1, 10, 5, 3, 8]:
            self.scheduler.submit_task(Task(task_id=f"pri-{pri}", difficulty="easy", priority=pri))
        result = self.scheduler.dispatch_next()
        assert result is not None
        assert result[0].priority == 10  # Highest priority first
