"""Unit tests for the agent scheduler module."""
import time
import pytest
from bounty_agent.scheduler import (
    Scheduler, AgentProfile, AgentTier, AgentStatus,
    Task
)


class TestAgentProfile:
    def test_default_tier(self):
        p = AgentProfile(agent_id="a1")
        assert p.tier == AgentTier.B

    def test_is_available_idle(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.IDLE)
        assert p.is_available is True

    def test_is_available_error(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.ERROR)
        assert p.is_available is False

    def test_is_available_max_tasks(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.IDLE, active_tasks=3, max_concurrent_tasks=3)
        assert p.is_available is False

    def test_is_available_memory_limit(self):
        p = AgentProfile(agent_id="a1", status=AgentStatus.IDLE, memory_usage_mb=800, memory_limit_mb=850)
        assert p.is_available is False

    def test_success_rate(self):
        p = AgentProfile(agent_id="a1", tasks_completed=8, tasks_failed=2)
        assert p.success_rate == 0.8

    def test_success_rate_zero(self):
        p = AgentProfile(agent_id="a1")
        assert p.success_rate == 0.0

    def test_update_tier_promote_to_s(self):
        p = AgentProfile(agent_id="a1", tasks_completed=25, tasks_failed=1)
        p.update_tier()
        assert p.tier == AgentTier.S

    def test_update_tier_demote_to_c(self):
        p = AgentProfile(agent_id="a1", tasks_completed=2, tasks_failed=5)
        p.update_tier()
        assert p.tier == AgentTier.C


class TestTask:
    def test_priority_ordering(self):
        t1 = Task(task_id="t1", bounty_id="b1", task_type="discovery", priority=3)
        t2 = Task(task_id="t2", bounty_id="b2", task_type="coding", priority=8)
        assert t2 < t1  # Higher priority first

    def test_same_priority_fifo(self):
        t1 = Task(task_id="t1", bounty_id="b1", task_type="discovery", priority=5, created_at=100)
        t2 = Task(task_id="t2", bounty_id="b2", task_type="coding", priority=5, created_at=200)
        assert t1 < t2


class TestScheduler:
    def setup_method(self):
        self.scheduler = Scheduler()
        for i in range(5):
            tier = [AgentTier.S, AgentTier.A, AgentTier.B, AgentTier.B, AgentTier.C][i]
            self.scheduler.register_agent(AgentProfile(
                agent_id=f"agent-{i+1}",
                tier=tier,
                gateway_id=i % 3 + 1,
                department=["security", "research", "code", "ops", "general"][i]
            ))

    def test_submit_task(self):
        task = Task(task_id="t1", bounty_id="b1", task_type="discovery", priority=5)
        assert self.scheduler.submit_task(task) is True

    def test_submit_task_queue_full(self):
        s = Scheduler(max_queue_size=2)
        s.submit_task(Task(task_id="t1", bounty_id="b1", task_type="discovery"))
        s.submit_task(Task(task_id="t2", bounty_id="b2", task_type="coding"))
        assert s.submit_task(Task(task_id="t3", bounty_id="b3", task_type="testing")) is False

    def test_schedule_next_assigns(self):
        task = Task(task_id="t1", bounty_id="b1", task_type="discovery", priority=5, required_tier=AgentTier.B)
        self.scheduler.submit_task(task)
        result = self.scheduler.schedule_next()
        assert result is not None
        assigned_task, agent = result
        assert assigned_task.assigned_to is not None
        assert agent.tier.value >= AgentTier.B.value

    def test_schedule_prefers_higher_tier(self):
        task = Task(task_id="t1", bounty_id="b1", task_type="coding", priority=8, required_tier=AgentTier.B)
        self.scheduler.submit_task(task)
        result = self.scheduler.schedule_next()
        assert result is not None
        # S-tier agent should be preferred
        assert result[1].tier == AgentTier.S

    def test_complete_task_success(self):
        self.scheduler.submit_task(Task(task_id="t1", bounty_id="b1", task_type="discovery"))
        result = self.scheduler.schedule_next()
        agent_id = result[1].agent_id
        self.scheduler.complete_task(agent_id, success=True, duration=30.0)
        agent = self.scheduler._agents[agent_id]
        assert agent.tasks_completed == 1

    def test_complete_task_failure(self):
        self.scheduler.submit_task(Task(task_id="t1", bounty_id="b1", task_type="discovery"))
        result = self.scheduler.schedule_next()
        self.scheduler.complete_task(result[1].agent_id, success=False, duration=10.0)
        assert self.scheduler._agents[result[1].agent_id].tasks_failed == 1

    def test_update_heartbeat(self):
        self.scheduler.update_heartbeat("agent-1", memory_mb=400)
        agent = self.scheduler._agents["agent-1"]
        assert agent.memory_usage_mb == 400
        assert agent.last_heartbeat > 0

    def test_get_cluster_status(self):
        status = self.scheduler.get_cluster_status()
        assert status["total_agents"] == 5
        assert "tier_distribution" in status
        assert status["tier_distribution"]["S"] == 1

    def test_check_memory_watermarks(self):
        agent = self.scheduler._agents["agent-1"]
        agent.memory_usage_mb = 820  # > 90% of 850
        alerts = self.scheduler.check_memory_watermarks()
        assert len(alerts) > 0
        assert alerts[0]["level"] in ("HIGH", "CRITICAL")

    def test_rebalance(self):
        # Overload one agent
        self.scheduler._agents["agent-1"].memory_usage_mb = 800
        self.scheduler._agents["agent-1"].active_tasks = 2
        # Set another as idle
        self.scheduler._agents["agent-4"].active_tasks = 0
        migrations = self.scheduler.rebalance()
        assert len(migrations) >= 1
