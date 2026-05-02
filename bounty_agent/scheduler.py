"""Agent scheduler with S/A/B/C tier rating, memory-aware dispatch, and heartbeat monitoring."""

import time
import threading
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class AgentTier(Enum):
    """S/A/B/C four-tier agent rating system."""
    S = "S"  # Elite: top performers, handle critical tasks
    A = "A"  # Senior: reliable, handle complex tasks
    B = "B"  # Standard: competent, handle routine tasks
    C = "C"  # Junior: new/lightweight agents, handle easy tasks


class AgentStatus(Enum):
    """Agent lifecycle states."""
    ONLINE = "online"
    BUSY = "busy"
    IDLE = "idle"
    ERROR = "error"
    OFFLINE = "offline"


@dataclass
class AgentProfile:
    """Profile for a single agent in the pool."""
    agent_id: str
    tier: AgentTier = AgentTier.C
    status: AgentStatus = AgentStatus.OFFLINE
    gateway_id: str = ""
    model: str = ""
    memory_usage_mb: float = 0.0
    tasks_completed: int = 0
    tasks_failed: int = 0
    last_heartbeat: float = 0.0
    current_task: Optional[str] = None
    uptime_seconds: float = 0.0
    department: str = ""

    @property
    def reliability_score(self) -> float:
        """Calculate reliability score (0.0-1.0) based on task history."""
        total = self.tasks_completed + self.tasks_failed
        if total == 0:
            return 0.5  # New agents start at neutral
        return self.tasks_completed / total

    @property
    def is_available(self) -> bool:
        """Check if agent is available for task assignment."""
        return self.status in (AgentStatus.ONLINE, AgentStatus.IDLE)


@dataclass
class Task:
    """A schedulable task."""
    task_id: str
    difficulty: str = "medium"  # easy, medium, hard, critical
    department: str = ""
    required_tier: AgentTier = AgentTier.B
    memory_estimate_mb: float = 50.0
    priority: int = 0  # Higher = more urgent
    created_at: float = field(default_factory=time.time)
    assigned_agent: Optional[str] = None
    deadline: Optional[float] = None


# Tier-to-difficulty mapping
TIER_DIFFICULTY_MAP = {
    AgentTier.S: ["critical", "hard"],
    AgentTier.A: ["hard", "medium"],
    AgentTier.B: ["medium", "easy"],
    AgentTier.C: ["easy"],
}

# Memory limits per environment
MEMORY_LIMITS = {
    "2gb": 850.0,    # 2GB environment → 850MB agent ceiling
    "4gb": 1600.0,   # 4GB environment → 1.6GB agent ceiling
    "8gb": 3200.0,   # 8GB environment → 3.2GB agent ceiling
    "default": 1600.0,
}


class AgentScheduler:
    """
    Production-grade agent scheduler with:
    - S/A/B/C four-tier dynamic rating
    - Memory-watermark dispatch
    - Staggered onboarding (错峰上线)
    - Peak load shedding (峰值限流)
    - Heartbeat monitoring with auto-demotion
    """

    def __init__(
        self,
        memory_limit_mb: float = 1600.0,
        heartbeat_timeout_sec: float = 300.0,
        max_concurrent_tasks: int = 5,
        peak_threshold: float = 0.85,
        demotion_threshold: float = 0.4,
        promotion_threshold: float = 0.9,
    ):
        self.memory_limit_mb = memory_limit_mb
        self.heartbeat_timeout_sec = heartbeat_timeout_sec
        self.max_concurrent_tasks = max_concurrent_tasks
        self.peak_threshold = peak_threshold  # % of memory limit before shedding
        self.demotion_threshold = demotion_threshold  # Reliability below this → demote
        self.promotion_threshold = promotion_threshold  # Reliability above this → promote

        self.agents: Dict[str, AgentProfile] = {}
        self.task_queue: List[Task] = []
        self.completed_tasks: List[Task] = []
        self._lock = threading.RLock()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._running = False

        # Metrics
        self.total_dispatched = 0
        self.total_rejected = 0
        self.peak_shed_events = 0

    # ── Agent Registration ──────────────────────────────────────

    def register_agent(
        self,
        agent_id: str,
        tier: AgentTier = AgentTier.C,
        gateway_id: str = "",
        model: str = "",
        department: str = "",
    ) -> AgentProfile:
        """Register a new agent in the pool."""
        with self._lock:
            profile = AgentProfile(
                agent_id=agent_id,
                tier=tier,
                gateway_id=gateway_id,
                model=model,
                department=department,
                status=AgentStatus.OFFLINE,
                last_heartbeat=time.time(),
            )
            self.agents[agent_id] = profile
            logger.info(f"Registered agent {agent_id} as tier {tier.value}")
            return profile

    def deregister_agent(self, agent_id: str) -> bool:
        """Remove an agent from the pool."""
        with self._lock:
            if agent_id in self.agents:
                del self.agents[agent_id]
                logger.info(f"Deregistered agent {agent_id}")
                return True
            return False

    # ── Heartbeat Monitoring ────────────────────────────────────

    def update_heartbeat(self, agent_id: str, memory_mb: float = 0.0) -> bool:
        """Update agent heartbeat and memory usage."""
        with self._lock:
            if agent_id not in self.agents:
                return False
            agent = self.agents[agent_id]
            agent.last_heartbeat = time.time()
            agent.memory_usage_mb = memory_mb
            if agent.status == AgentStatus.OFFLINE:
                agent.status = AgentStatus.IDLE
                agent.uptime_seconds = 0.0
            return True

    def check_heartbeats(self) -> List[str]:
        """Check for agents with expired heartbeats. Returns list of timed-out agent IDs."""
        now = time.time()
        timed_out = []
        with self._lock:
            for agent_id, agent in self.agents.items():
                if agent.status == AgentStatus.OFFLINE:
                    continue
                elapsed = now - agent.last_heartbeat
                if elapsed > self.heartbeat_timeout_sec:
                    logger.warning(
                        f"Agent {agent_id} heartbeat expired "
                        f"({elapsed:.0f}s > {self.heartbeat_timeout_sec}s)"
                    )
                    agent.status = AgentStatus.ERROR
                    timed_out.append(agent_id)
        return timed_out

    def start_heartbeat_monitor(self, interval_sec: float = 60.0):
        """Start background heartbeat monitoring thread."""
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            return
        self._running = True

        def _monitor():
            while self._running:
                timed_out = self.check_heartbeats()
                for agent_id in timed_out:
                    self._auto_demote(agent_id)
                # Update uptime for active agents
                with self._lock:
                    for agent in self.agents.values():
                        if agent.status in (AgentStatus.ONLINE, AgentStatus.IDLE, AgentStatus.BUSY):
                            agent.uptime_seconds += interval_sec
                time.sleep(interval_sec)

        self._heartbeat_thread = threading.Thread(target=_monitor, daemon=True)
        self._heartbeat_thread.start()

    def stop_heartbeat_monitor(self):
        """Stop the heartbeat monitoring thread."""
        self._running = False
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=5.0)

    # ── Tier Rating ────────────────────────────────────────────

    def _auto_demote(self, agent_id: str) -> bool:
        """Demote agent one tier if reliability is below threshold."""
        agent = self.agents.get(agent_id)
        if not agent or agent.tier == AgentTier.C:
            return False
        if agent.reliability_score < self.demotion_threshold:
            old_tier = agent.tier
            tiers = list(AgentTier)
            current_idx = tiers.index(agent.tier)
            if current_idx < len(tiers) - 1:
                agent.tier = tiers[current_idx + 1]
                logger.warning(
                    f"Demoted {agent_id} from {old_tier.value} → {agent.tier.value} "
                    f"(reliability: {agent.reliability_score:.2f})"
                )
                return True
        return False

    def _auto_promote(self, agent_id: str) -> bool:
        """Promote agent one tier if reliability is above threshold."""
        agent = self.agents.get(agent_id)
        if not agent or agent.tier == AgentTier.S:
            return False
        # Require minimum 10 tasks completed for promotion
        if agent.tasks_completed < 10:
            return False
        if agent.reliability_score >= self.promotion_threshold:
            old_tier = agent.tier
            tiers = list(AgentTier)
            current_idx = tiers.index(agent.tier)
            if current_idx > 0:
                agent.tier = tiers[current_idx - 1]
                logger.info(
                    f"Promoted {agent_id} from {old_tier.value} → {agent.tier.value} "
                    f"(reliability: {agent.reliability_score:.2f})"
                )
                return True
        return False

    def evaluate_tiers(self) -> Dict[str, str]:
        """Run tier evaluation for all agents. Returns {agent_id: new_tier}."""
        changes = {}
        with self._lock:
            for agent_id in list(self.agents.keys()):
                demoted = self._auto_demote(agent_id)
                if not demoted:
                    promoted = self._auto_promote(agent_id)
                    if promoted:
                        changes[agent_id] = self.agents[agent_id].tier.value
                else:
                    changes[agent_id] = self.agents[agent_id].tier.value
        return changes

    # ── Task Scheduling ────────────────────────────────────────

    def submit_task(self, task: Task) -> bool:
        """Add a task to the scheduling queue."""
        with self._lock:
            # Check if we can handle more tasks (peak shedding)
            current_load = self._calculate_memory_load()
            if current_load >= self.memory_limit_mb * self.peak_threshold:
                logger.warning(
                    f"Peak shedding: memory at {current_load:.0f}MB "
                    f"(threshold: {self.memory_limit_mb * self.peak_threshold:.0f}MB). "
                    f"Rejecting task {task.task_id}"
                )
                self.total_rejected += 1
                self.peak_shed_events += 1
                return False

            self.task_queue.append(task)
            # Sort by priority (descending) then by created_at (ascending)
            self.task_queue.sort(key=lambda t: (-t.priority, t.created_at))
            logger.info(f"Task {task.task_id} queued (difficulty={task.difficulty}, priority={task.priority})")
            return True

    def dispatch_next(self) -> Optional[tuple]:
        """
        Dispatch the highest-priority task to the best available agent.
        Returns (task, agent) tuple or None if no dispatch possible.
        """
        with self._lock:
            if not self.task_queue:
                return None

            # Count currently busy agents
            busy_count = sum(
                1 for a in self.agents.values()
                if a.status == AgentStatus.BUSY
            )
            if busy_count >= self.max_concurrent_tasks:
                logger.debug("Max concurrent tasks reached, cannot dispatch")
                return None

            # Find best agent for highest-priority task
            task = self.task_queue[0]
            agent = self._find_best_agent(task)

            if agent is None:
                return None

            # Assign
            self.task_queue.pop(0)
            agent.status = AgentStatus.BUSY
            agent.current_task = task.task_id
            task.assigned_agent = agent.agent_id
            self.total_dispatched += 1

            logger.info(
                f"Dispatched {task.task_id} → {agent.agent_id} "
                f"(tier={agent.tier.value}, dept={agent.department})"
            )
            return (task, agent)

    def _find_best_agent(self, task: Task) -> Optional[AgentProfile]:
        """Find the best available agent for a given task."""
        eligible = [
            a for a in self.agents.values()
            if a.is_available
            and self._tier_can_handle(a.tier, task.difficulty)
            and a.memory_usage_mb + task.memory_estimate_mb <= self.memory_limit_mb
        ]

        if not eligible:
            return None

        # Prefer: same department → higher tier → higher reliability → less memory
        def agent_score(a: AgentProfile) -> tuple:
            dept_match = 0 if a.department == task.department else 1
            tier_order = list(AgentTier).index(a.tier)  # S=0, A=1, B=2, C=3
            return (dept_match, tier_order, -a.reliability_score, a.memory_usage_mb)

        eligible.sort(key=agent_score)
        return eligible[0]

    def _tier_can_handle(self, tier: AgentTier, difficulty: str) -> bool:
        """Check if a tier can handle a given difficulty level."""
        allowed = TIER_DIFFICULTY_MAP.get(tier, [])
        return difficulty in allowed

    def complete_task(self, agent_id: str, task_id: str, success: bool = True):
        """Mark a task as completed and release the agent."""
        with self._lock:
            agent = self.agents.get(agent_id)
            if not agent:
                return

            agent.status = AgentStatus.IDLE
            agent.current_task = None

            if success:
                agent.tasks_completed += 1
            else:
                agent.tasks_failed += 1

            # Find and archive the task
            for i, t in enumerate(self.task_queue):
                if t.task_id == task_id:
                    t.assigned_agent = None
                    self.completed_tasks.append(t)
                    break

            logger.info(
                f"Agent {agent_id} completed {task_id} "
                f"({'success' if success else 'failed'})"
            )

    # ── Memory Management ──────────────────────────────────────

    def _calculate_memory_load(self) -> float:
        """Calculate total memory usage across all active agents."""
        return sum(
            a.memory_usage_mb for a in self.agents.values()
            if a.status != AgentStatus.OFFLINE
        )

    def memory_usage_percent(self) -> float:
        """Get current memory usage as percentage of limit."""
        if self.memory_limit_mb == 0:
            return 0.0
        return (self._calculate_memory_load() / self.memory_limit_mb) * 100

    # ── Staggered Onboarding (错峰上线) ─────────────────────────

    def staggered_onboarding(
        self,
        agent_configs: List[dict],
        delay_seconds: float = 2.0,
    ) -> List[str]:
        """
        Register agents with staggered delays to avoid API rate limits.

        Args:
            agent_configs: List of dicts with keys: agent_id, tier, gateway_id, model, department
            delay_seconds: Delay between each agent registration

        Returns:
            List of registered agent IDs
        """
        registered = []
        for i, config in enumerate(agent_configs):
            agent_id = config.get("agent_id", f"agent-{i}")
            profile = self.register_agent(
                agent_id=agent_id,
                tier=AgentTier(config.get("tier", "C")),
                gateway_id=config.get("gateway_id", ""),
                model=config.get("model", ""),
                department=config.get("department", ""),
            )
            # Stagger the status change to online
            if i > 0:
                time.sleep(delay_seconds)
            profile.status = AgentStatus.IDLE
            profile.last_heartbeat = time.time()
            registered.append(agent_id)
            logger.info(f"Onboarded {agent_id} (delay={delay_seconds}s)")
        return registered

    # ── Peak Load Shedding (峰值限流) ──────────────────────────

    def enable_load_shedding(self) -> int:
        """
        Activate load shedding: idle low-tier agents to free memory.
        Returns number of agents shed.
        """
        shed_count = 0
        with self._lock:
            # Shed C-tier agents first, then B-tier
            for tier in [AgentTier.C, AgentTier.B]:
                for agent in self.agents.values():
                    if agent.tier == tier and agent.status == AgentStatus.IDLE:
                        agent.status = AgentStatus.OFFLINE
                        shed_count += 1
                        logger.info(f"Load shedding: idled {agent.agent_id} (tier {tier.value})")
                if self._calculate_memory_load() < self.memory_limit_mb * 0.7:
                    break  # Enough memory freed
        return shed_count

    # ── Status & Metrics ───────────────────────────────────────

    def get_status(self) -> dict:
        """Get comprehensive scheduler status."""
        with self._lock:
            tier_counts = defaultdict(int)
            status_counts = defaultdict(int)
            for agent in self.agents.values():
                tier_counts[agent.tier.value] += 1
                status_counts[agent.status.value] += 1

            return {
                "total_agents": len(self.agents),
                "tier_distribution": dict(tier_counts),
                "status_distribution": dict(status_counts),
                "queued_tasks": len(self.task_queue),
                "completed_tasks": len(self.completed_tasks),
                "memory_usage_mb": self._calculate_memory_load(),
                "memory_limit_mb": self.memory_limit_mb,
                "memory_usage_percent": round(self.memory_usage_percent(), 1),
                "total_dispatched": self.total_dispatched,
                "total_rejected": self.total_rejected,
                "peak_shed_events": self.peak_shed_events,
            }

    def get_agents_by_tier(self, tier: AgentTier) -> List[AgentProfile]:
        """Get all agents of a specific tier."""
        return [a for a in self.agents.values() if a.tier == tier]

    def get_available_agents(self) -> List[AgentProfile]:
        """Get all currently available agents."""
        return [a for a in self.agents.values() if a.is_available]

    def get_department_summary(self) -> Dict[str, dict]:
        """Get agent summary grouped by department."""
        dept_data = defaultdict(lambda: {"count": 0, "tiers": defaultdict(int), "available": 0})
        for agent in self.agents.values():
            dept = agent.department or "unassigned"
            dept_data[dept]["count"] += 1
            dept_data[dept]["tiers"][agent.tier.value] += 1
            if agent.is_available:
                dept_data[dept]["available"] += 1
        return dict(dept_data)
