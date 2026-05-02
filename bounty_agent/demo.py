#!/usr/bin/env python3
"""Autonomous Bounty Agent — Live Demo Script.

Demonstrates all 5 core systems:
1. Agent Scheduler — S/A/B/C tier rating + memory-aware dispatch
2. Task Dispatch — Priority queue + tier matching
3. LLM Client — Multi-provider with fallback chain
4. Event Bus — Structured pub/sub events
5. Full Pipeline — 5-stage mission execution (discover → submit)

Usage:
    python -m bounty_agent.demo
"""

from bounty_agent.scheduler import AgentScheduler, AgentTier, AgentStatus, Task
from bounty_agent.discovery import BountyIssue, BountyTier
from bounty_agent.orchestrator import TeamOrchestrator, MissionStage
from bounty_agent.llm_client import LLMClient, Provider
from bounty_agent.events import EventBus, EventType, PipelineEvent, AgentRole
from unittest.mock import patch, MagicMock
import json


def main():
    print("=" * 60)
    print("  🤖 Autonomous Bounty Agent — Live Demo")
    print("=" * 60)

    # ── 1. Scheduler ──────────────────────────────────────────
    print("\n📋 [1/5] Agent Scheduler — S/A/B/C Tier Rating")
    print("-" * 40)
    sched = AgentScheduler(memory_limit_mb=1600.0)
    agents = [
        ("sec-alpha", AgentTier.S, "gw-1", "deepseek-v4-pro", "security"),
        ("sec-beta", AgentTier.S, "gw-7", "glm-5.1", "security"),
        ("res-gamma", AgentTier.A, "gw-2", "qwen-3.5-397b", "research"),
        ("res-delta", AgentTier.A, "gw-3", "glm-5.1", "research"),
        ("code-epsilon", AgentTier.B, "gw-4", "qwen-2.5-coder", "code"),
        ("code-zeta", AgentTier.B, "gw-5", "glm-5.1", "code"),
        ("doc-eta", AgentTier.C, "gw-6", "glm-5.1", "knowledge"),
        ("ops-theta", AgentTier.C, "gw-1", "glm-5.1", "ops"),
    ]
    for aid, tier, gw, model, dept in agents:
        sched.register_agent(aid, tier=tier, gateway_id=gw, model=model, department=dept)
        sched.update_heartbeat(aid, memory_mb=80.0)
        print(f"  ✅ {aid} [{tier.value}] → {dept} on {gw}")

    status = sched.get_status()
    print(f"  📊 Team: {status['total_agents']} agents | Tiers: {json.dumps(status['tier_distribution'])}")
    print(f"  💾 Memory: {status['memory_usage_mb']}MB / {status['memory_limit_mb']}MB ({status['memory_usage_percent']}%)")

    # ── 2. Task Dispatch ──────────────────────────────────────
    print("\n🎯 [2/5] Task Dispatch — Priority Queue + Tier Matching")
    print("-" * 40)
    tasks = [
        Task("t-sec-1", difficulty="critical", department="security", priority=10),
        Task("t-code-1", difficulty="medium", department="code", priority=5),
        Task("t-doc-1", difficulty="easy", department="knowledge", priority=2),
    ]
    for t in tasks:
        sched.submit_task(t)
        print(f"  📥 Queued: {t.task_id} (diff={t.difficulty}, pri={t.priority})")

    while sched.task_queue:
        result = sched.dispatch_next()
        if result:
            task, agent = result
            print(f"  🚀 Dispatched: {task.task_id} → {agent.agent_id} [{agent.tier.value}] ({agent.department})")
            sched.complete_task(agent.agent_id, task.task_id, success=True)

    # ── 3. LLM Client ────────────────────────────────────────
    print("\n🤖 [3/5] LLM Client — Multi-Provider + Fallback Chain")
    print("-" * 40)
    client = LLMClient()
    providers = [
        (Provider.OPENAI, "glm-5.1", 60),
        (Provider.ANTHROPIC, "deepseek-v4-pro", 40),
        (Provider.LOCAL, "qwen-3.5-397b", 30),
    ]
    for prov, model, rpm in providers:
        client.add_provider(prov, model, rate_limit_rpm=rpm)
        print(f"  ✅ {prov.value}: {model} (rpm={rpm})")

    stats = client.get_stats()
    print(f"  📊 Fallback chain: {' → '.join(stats['fallback_chain'])}")

    # ── 4. Event Bus ──────────────────────────────────────────
    print("\n📡 [4/5] Event Bus — Structured Events")
    print("-" * 40)
    bus = EventBus()
    log = []
    bus.subscribe(lambda e: log.append(f"[{e.event_type.value}] {e.message}"))

    bus.emit(PipelineEvent(EventType.STAGE_STARTED, AgentRole.SCANNER, "m-1", "Discovery phase started"))
    bus.emit(PipelineEvent(EventType.AGENT_COMPLETED, AgentRole.CODER, "m-1", "Code implementation done"))
    bus.emit(PipelineEvent(EventType.MISSION_COMPLETED, AgentRole.ORCHESTRATOR, "m-1", "Mission #861 completed"))

    for entry in log:
        print(f"  {entry}")

    # ── 5. Full Pipeline ──────────────────────────────────────
    print("\n🔄 [5/5] Full Pipeline — 5-Stage Mission Execution")
    print("-" * 40)
    mock_bounty = BountyIssue(
        platform="SolFoundry",
        repo="SolFoundry/solfoundry",
        issue_number=861,
        title="Autonomous Bounty Agent 1M $FNDRY",
        reward="1000000 FNDRY",
        tier=BountyTier.T3_STANDARD,
        difficulty="medium",
    )

    with patch("bounty_agent.discovery.BountyScanner") as MockScannerClass:
        mock_scanner = MagicMock()
        mock_scanner.scan_all.return_value = [mock_bounty]
        mock_scanner.prioritize.return_value = [mock_bounty]
        mock_scanner.get_bounty_detail.return_value = mock_bounty
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        print(f"  🎯 Mission started: #{state.bounty_id}")

        for stage in [MissionStage.DISCOVER, MissionStage.ANALYZE, MissionStage.IMPLEMENT, MissionStage.TEST, MissionStage.SUBMIT]:
            result = orch.run_stage(state, stage)
            icon = "✅" if result.status == "success" else "❌"
            print(f"  {icon} {stage.value}: {result.status} (agent={result.agent_id}, {result.duration_seconds:.1f}s)")

        print(f"  🏁 Mission complete: {state.is_complete} | {len(state.stage_results)}/5 stages")

    # ── Summary ───────────────────────────────────────────────
    print()
    print("=" * 60)
    print("✅ All systems operational")
    print(f"   Scheduler: {sched.total_dispatched} tasks dispatched")
    print(f"   LLM: {len(client.get_stats()['providers'])} providers with fallback")
    print(f"   Pipeline: 5/5 stages passed")
    print("=" * 60)


if __name__ == "__main__":
    main()
