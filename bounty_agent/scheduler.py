"""Agent scheduling module with tiered priority and memory-aware dispatch.

Implements S/A/B/C four-tier agent rating system with:
- Memory watermark scheduling (850MB limit per gateway)
- Peak-shifting staggered online strategy
- Rate limiting and queue management
- Heartbeat-based health monitoring

Production-validated on 7-gateway Mac Mini cluster.
Author: Xeophon
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import time
import logging
import heapq

logger = logging.getLogger(__name__)


class AgentTier(Enum):
    """Agent performance tiers — higher tier = higher priority."""
    S = 4  # Elite: proven high-output agents
    A = 3  # Senior: reliable with good track record
    B = 2  # Regular: standard capability
    C = 1  # Junior: new or underperforming


class AgentStatus(Enum):
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"
    ERROR = "error"
    DRAINING = "draining"  # Gracefully shutting down


@dataclass
class AgentProfile:
    """Complete agent profile for scheduling decisions."""
    agent_id: str
    tier: AgentTier = AgentTier.B
    status: AgentStatus = AgentStatus.IDLE
    gateway_id: int = 1
    department: str = "general"

    # Performance metrics
    tasks_completed: int = 0
    tasks_failed: int = 0
    avg_completion_time: float = 0.0  # seconds
    last_heartbeat: float = field(default_factory=time.time)

    # Resource tracking
    memory_usage_mb: float = 0.0
    memory_limit_mb: float = 850.0  # Per-gateway limit
    active_tasks: int = 0
    max_concurrent_tasks: int = 3

    # Scheduling metadata
    priority_score: float = 0.0
    assigned_bounty: Optional[str] = None

    @property
    def success_rate(self) -> float:
        total = self.tasks_completed + self.tasks_failed
        return self.tasks_completed / total if total > 0 else 0.0

    @property
    def is_available(self) -> bool:
        return (
            self.status in (AgentStatus.IDLE, AgentStatus.BUSY)
            and self.active_tasks < self.max_concurrent_tasks
            and self.memory_usage_mb < self.memory_limit_mb * 0.9
            and (time.time() - self.last_heartbeat) < 300  # 5min heartbeat timeout
        )

    @property
    def is_healthy(self) -> bool:
        return self.status not in (AgentStatus.ERROR, AgentStatus.OFFLINE) \
               and (time.time() - self.last_heartbeat) < 300

    def update_tier(self):
        """Auto-promote/demote based on performance."""
        rate = self.success_rate
        if self.tasks_completed >= 20 and rate >= 0.95:
            self.tier = AgentTier.S
        elif self.tasks_completed >= 10 and rate >= 0.85:
            self.tier = AgentTier.A
        elif self.tasks_completed >= 5 and rate >= 0.70:
            self.tier = AgentTier.B
        elif rate < 0.50 and self.tasks_failed >= 3:
            self.tier = AgentTier.C


@dataclass
class Task:
    """A schedulable task with priority."""
    task_id: str
    bounty_id: str
    task_type: str  # discovery, coding, testing, submission, review
    priority: int = 5  # 1-10, higher = more urgent
    estimated_time: float = 60.0  # seconds
    required_tier: AgentTier = AgentTier.B
    required_memory_mb: float = 100.0
    created_at: float = field(default_factory=time.time)
    assigned_to: Optional[str] = None
    deadline: Optional[float] = None

    def __lt__(self, other):
        """Priority queue ordering — higher priority first."""
        if self.priority != other.priority:
            return self.priority > other.priority
        return self.created_at < other.created_at


class Scheduler:
    """Agent scheduler with tiered dispatch and memory awareness.

    Core algorithms:
    1. Tiered priority matching — assign S-tier tasks to S-tier agents
    2. Memory watermark scheduling — skip agents above 90% memory
    3. Peak-shifting stagger — delay low-priority tasks during peak
    4. Round-robin fallback — for equal-priority agents
    """

    # Memory watermark thresholds
    MEMORY_HIGH_WATERMARK = 0.9   # 90% — reject new tasks
    MEMORY_LOW_WATERMARK = 0.7   # 70% — allow all tasks
    MEMORY_CRITICAL = 0.95       # 95% — force task migration

    def __init__(self, max_queue_size: int = 1000):
        self._agents: Dict[str, AgentProfile] = {}
        self._task_queue: List[Task] = []  # Min-heap by priority
        self._max_queue_size = max_queue_size
        self._schedule_history: List[Dict] = []

        # Peak-shifting configuration
        self._peak_hours = [(9, 12), (14, 18)]  # 9-12, 14-18 UTC+8
        self._peak_delay_multiplier = 2.0

    def register_agent(self, profile: AgentProfile):
        """Register an agent for scheduling."""
        self._agents[profile.agent_id] = profile
        profile.priority_score = profile.tier.value
        logger.info(f"[scheduler] Registered {profile.agent_id} as tier-{profile.tier.name} on GW-{profile.gateway_id}")

    def submit_task(self, task: Task) -> bool:
        """Submit a task to the scheduling queue."""
        if len(self._task_queue) >= self._max_queue_size:
            logger.warning(f"[scheduler] Queue full, rejecting task {task.task_id}")
            return False
        heapq.heappush(self._task_queue, task)
        logger.info(f"[scheduler] Task {task.task_id} queued (priority={task.priority})")
        return True

    def schedule_next(self) -> Optional[Tuple[Task, AgentProfile]]:
        """Pick the highest-priority task and assign to best agent.

        Scheduling algorithm:
        1. Pop highest-priority task from queue
        2. Filter agents by: status, tier >= required, memory < high watermark
        3. If peak hours and task is low priority, delay
        4. Sort candidates by: tier desc, success_rate desc, memory asc
        5. Assign to top candidate
        """
        if not self._task_queue:
            return None

        task = heapq.heappop(self._task_queue)

        # Peak-shifting: delay low-priority tasks during peak hours
        if self._is_peak_hour() and task.priority < 5:
            task.priority = max(1, task.priority - 1)
            if task.priority < 3:
                heapq.heappush(self._task_queue, task)
                logger.debug(f"[scheduler] Delaying low-priority task {task.task_id} (peak hours)")
                return None

        # Find eligible agents
        candidates = []
        for agent in self._agents.values():
            if not agent.is_available:
                continue
            if agent.tier.value < task.required_tier.value:
                continue
            if agent.memory_usage_mb + task.required_memory_mb > agent.memory_limit_mb * self.MEMORY_HIGH_WATERMARK:
                continue
            candidates.append(agent)

        if not candidates:
            # No eligible agent — re-queue with slight priority boost
            task.priority = min(10, task.priority + 1)
            heapq.heappush(self._task_queue, task)
            logger.debug(f"[scheduler] No eligible agent for {task.task_id}, re-queued")
            return None

        # Sort: highest tier first, then best success rate, then least memory
        candidates.sort(key=lambda a: (
            -a.tier.value,
            -a.success_rate,
            a.memory_usage_mb
        ))

        assigned = candidates[0]
        task.assigned_to = assigned.agent_id
        assigned.active_tasks += 1
        assigned.assigned_bounty = task.bounty_id
        assigned.memory_usage_mb += task.required_memory_mb

        self._schedule_history.append({
            "task_id": task.task_id,
            "agent_id": assigned.agent_id,
            "tier": assigned.tier.name,
            "timestamp": time.time(),
        })

        logger.info(f"[scheduler] Assigned {task.task_id} → {assigned.agent_id} (tier-{assigned.tier.name})")
        return (task, assigned)

    def complete_task(self, agent_id: str, success: bool, duration: float = 0):
        """Mark a task as completed and update agent metrics."""
        agent = self._agents.get(agent_id)
        if not agent:
            return
        agent.active_tasks = max(0, agent.active_tasks - 1)
        agent.assigned_bounty = None
        if success:
            agent.tasks_completed += 1
        else:
            agent.tasks_failed += 1
        if duration > 0:
            total = agent.avg_completion_time * (agent.tasks_completed + agent.tasks_failed - 1) + duration
            agent.avg_completion_time = total / (agent.tasks_completed + agent.tasks_failed)
        agent.update_tier()
        logger.info(f"[scheduler] {agent_id} task {'succeeded' if success else 'failed'} → tier-{agent.tier.name}")

    def update_heartbeat(self, agent_id: str, memory_mb: float = None):
        """Update agent heartbeat and optionally memory usage."""
        agent = self._agents.get(agent_id)
        if not agent:
            return
        agent.last_heartbeat = time.time()
        if memory_mb is not None:
            old = agent.memory_usage_mb
            agent.memory_usage_mb = memory_mb
            if memory_mb > agent.memory_limit_mb * self.MEMORY_CRITICAL:
                logger.warning(f"[scheduler] CRITICAL: {agent_id} memory {memory_mb:.0f}MB > {agent.memory_limit_mb * self.MEMORY_CRITICAL:.0f}MB")

    def _is_peak_hour(self) -> bool:
        """Check if current time is in configured peak hours."""
        from datetime import datetime
        hour = datetime.now().hour
        return any(start <= hour < end for start, end in self._peak_hours)

    def get_cluster_status(self) -> Dict:
        """Get full cluster status for monitoring dashboard."""
        tier_counts = {t.name: 0 for t in AgentTier}
        status_counts = {s.value: 0 for s in AgentStatus}
        total_memory = 0
        available = 0

        for agent in self._agents.values():
            tier_counts[agent.tier.name] += 1
            status_counts[agent.status.value] += 1
            total_memory += agent.memory_usage_mb
            if agent.is_available:
                available += 1

        return {
            "total_agents": len(self._agents),
            "available_agents": available,
            "tier_distribution": tier_counts,
            "status_distribution": status_counts,
            "total_memory_mb": total_memory,
            "queued_tasks": len(self._task_queue),
            "total_scheduled": len(self._schedule_history),
        }

    def check_memory_watermarks(self) -> List[Dict]:
        """Check all agents against memory watermarks."""
        alerts = []
        for agent in self._agents.values():
            ratio = agent.memory_usage_mb / agent.memory_limit_mb
            if ratio > self.MEMORY_CRITICAL:
                alerts.append({"agent": agent.agent_id, "level": "CRITICAL", "usage_mb": agent.memory_usage_mb, "ratio": round(ratio, 2)})
            elif ratio > self.MEMORY_HIGH_WATERMARK:
                alerts.append({"agent": agent.agent_id, "level": "HIGH", "usage_mb": agent.memory_usage_mb, "ratio": round(ratio, 2)})
        return alerts

    def rebalance(self) -> List[Dict]:
        """Rebalance tasks from overloaded agents to idle ones."""
        migrations = []
        overloaded = [a for a in self._agents.values()
                      if a.memory_usage_mb > a.memory_limit_mb * self.MEMORY_HIGH_WATERMARK
                      and a.active_tasks > 0]
        underloaded = [a for a in self._agents.values()
                       if a.is_available and a.active_tasks == 0]

        for src in overloaded:
            if not underloaded:
                break
            dst = underloaded.pop(0)
            migrations.append({
                "from": src.agent_id,
                "to": dst.agent_id,
                "reason": f"memory overload ({src.memory_usage_mb:.0f}MB)"
            })
            logger.info(f"[scheduler] Rebalancing: {src.agent_id} → {dst.agent_id}")
        return migrations
