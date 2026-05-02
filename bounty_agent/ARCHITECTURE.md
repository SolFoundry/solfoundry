# Architecture — Autonomous Bounty-Hunting Agent

## System Overview

```mermaid
graph TB
    subgraph Controller["🎯 AutonomousBountyAgent (Main Controller)"]
        CLI["CLI Entry Point<br/>main_bounty_agent.py"]
    end

    subgraph Phase1["Phase 1: Discover"]
        Scanner["BountyScanner<br/>GitHub search + label detection"]
        Scanner -->|prioritize| Queue["Priority Queue<br/>easy → medium → hard"]
    end

    subgraph Phase2["Phase 2: Analyze"]
        Planner["BountyPlanner<br/>Department-based decomposition"]
        Planner --> Subtasks["SubTask[]<br/>research → code → security → docs"]
    end

    subgraph Phase3["Phase 3: Implement"]
        Scheduler["AgentScheduler<br/>S/A/B/C grading + memory-aware"]
        Scheduler -->|assign| Orchestrator["TeamOrchestrator<br/>51 agents × 7 gateways"]
        LLM["LLMClient<br/>Multi-provider + fallback chain"]
        AntiHalluc["Anti-Hallucination<br/>5-layer defense + cross-review"]
    end

    subgraph Phase4["Phase 4: Submit"]
        Submitter["PRSubmitter<br/>Credential sanitization"]
        Submitter --> PR["Pull Request<br/>with Solana wallet"]
    end

    CLI -->|scan| Scanner
    Scanner -->|bounties| Planner
    Planner -->|plan| Scheduler
    Scheduler -->|dispatch| Orchestrator
    Orchestrator -->|results| Submitter
    LLM -.->|API calls| Orchestrator
    AntiHalluc -.->|confidence check| Orchestrator
```

## 4-Phase Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Scanner as 🔍 BountyScanner
    participant Planner as 📊 BountyPlanner
    participant Scheduler as ⚙️ AgentScheduler
    participant Orch as 🤖 TeamOrchestrator
    participant Submitter as 📤 PRSubmitter

    User->>Scanner: --scan --keywords "bounty"
    Scanner->>Scanner: gh search issues
    Scanner-->>Planner: DiscoveredBounty[]
    Planner->>Planner: Decompose into SubTask[]
    Planner-->>Scheduler: BountyPlan (4 subtasks)
    loop For each subtask
        Scheduler->>Orch: assign_task(department)
        Orch-->>Orch: AgentNode executes
        Orch-->>Scheduler: task completed
    end
    Scheduler-->>Submitter: Implementation ready
    Submitter->>Submitter: _sanitize_pr_body()
    Submitter-->>User: PR URL + wallet address
```

## Agent Architecture (51 Agents, 7 Gateways)

```mermaid
graph LR
    subgraph GW1["GW-1 :18789"]
        SEC1["🛡️ Security ×5"]
        OPS1["⚙️ Ops ×4"]
    end

    subgraph GW2["GW-2 :18790"]
        RES1["🔍 Research ×9"]
        OPS2["⚙️ Ops ×3"]
    end

    subgraph GW3["GW-3 :18801"]
        RES2["🔍 Research ×8"]
    end

    subgraph GW4["GW-4 :18792"]
        CODE1["💻 Code ×5"]
    end

    subgraph GW5["GW-5 :18793"]
        CODE2["💻 Code ×4"]
    end

    subgraph GW6["GW-6 :18794"]
        KNOW["📚 Knowledge ×5"]
    end

    subgraph GW7["GW-7 :18795"]
        SEC2["🛡️ Security ×8"]
    end
```

## Scheduler S/A/B/C Grading

```mermaid
graph TD
    New["🆕 New Agent<br/>Default: C-tier"] -->|10+ tasks completed| B["B-tier<br/>Reliable"]
    B -->|25+ tasks, >90% success| A["A-tier<br/>Expert"]
    A -->|50+ tasks, >95% success| S["S-tier<br/>Elite"]

    S -->|< 80% success rate| A
    A -->|< 70% success rate| B
    B -->|< 60% success rate| C

    Memory["Memory Watermark<br/>850MB / 1600MB / 3200MB"] -->|controls| Dispatch["Task Dispatch<br/>Reject if over limit"]
    Heartbeat["Heartbeat Monitor<br/>30s interval"] -->|timeout| Demote["Auto-demote<br/>+ mark offline"]

    style S fill:#fbbf24,stroke:#92400e
    style A fill:#34d399,stroke:#065f46
    style B fill:#60a5fa,stroke:#1e40af
    style C fill:#9ca3af,stroke:#374151
```

## Three-Layer Economic System

```mermaid
graph LR
    subgraph Layer1["Layer 1: ClawTasks"]
        B1["SolFoundry<br/>$FNDRY"]
        B2["RustChain<br/>RTC"]
        B3["Expensify<br/>USD"]
    end

    subgraph Layer2["Layer 2: agent-token"]
        Earn["Earn per subtask<br/>Research: 10tk<br/>Code: 25tk<br/>Security: 30tk<br/>Docs: 15tk"]
        Spend["Spend on<br/>Priority boost<br/>Model upgrade<br/>GW slot reserve"]
    end

    subgraph Layer3["Layer 3: MoltsPay"]
        Settle["Settlement to<br/>Solana wallet<br/>Proportional split"]
    end

    Layer1 -->|bounty claimed| Layer2
    Layer2 -->|PR merged| Layer3
```

## Disaster Recovery (4-Layer)

```mermaid
graph TB
    subgraph L1["Data Layer"]
        D1["3-2-1 Backup<br/>3 copies, 2 media, 1 offsite"]
    end

    subgraph L2["Application Layer"]
        D2["Process Guardian<br/>LaunchAgent KeepAlive=true<br/>Auto-restart on crash"]
    end

    subgraph L3["Business Layer"]
        D3["Checkpoint Recovery<br/>Mayday bundles<br/>State persistence"]
    end

    subgraph L4["Disaster Layer"]
        D4["Primary/Standby<br/>Gateway failover<br/>7 GW redundant"]
    end

    L1 -->|data safe| L2
    L2 -->|process up| L3
    L3 -->|business resume| L4
```

## Multi-LLM Fallback Chain

```mermaid
graph TD
    Primary["GLM-5.1<br/>Primary Model"] -->|timeout| Fallback1["DeepSeek-V4-Pro<br/>Security Specialist"]
    Fallback1 -->|timeout| Fallback2["Qwen-3.5-397B<br/>Research Specialist"]
    Fallback2 -->|timeout| Fallback3["Qwen-2.5-Coder-32B<br/>Code Specialist"]
    Fallback3 -->|timeout| Local["Local Model<br/>Offline fallback"]

    RateLimit["Rate Limiter<br/>60 req/min per provider"] -->|controls| Primary
    TokenCount["Token Counter<br/>Track usage per model"] -->|monitors| Primary
```

## React Dashboard Components

```mermaid
graph TB
    subgraph Dashboard["BountyAgentDashboard.tsx (1060 lines)"]
        MissionCtrl["Mission Control<br/>Start/Stop/Reset"]
        Pipeline["Pipeline Progress<br/>Discover→Analyze→Implement→Submit"]
        AgentGrid["Agent Status Grid<br/>51 agents, 5 departments"]
        EconPanel["💰 Economic Panel<br/>ClawTasks → agent-token → MoltsPay"]
        BountyList["🎯 Bounty List<br/>Skill-match scoring"]
        RelayStream["📡 Relay Stream<br/>Agent-to-agent messages"]
        Confidence["🎯 Confidence Dashboard<br/>5 gauges + anti-hallucination"]
        SchedQueue["⚙️ Scheduler Queue<br/>S/A/B/C ratings + memory bar"]
        Disaster["🛡️ Disaster Recovery<br/>4-layer status"]
        WSBar["WebSocket Status<br/>Latency + reconnect count"]
        EventLog["📜 Event Log<br/>Real-time events"]
    end

    subgraph Hooks["useBountyAgent.ts (542 lines)"]
        QHooks["Query Hooks<br/>8 auto-refresh endpoints"]
        MutHooks["Mutation Hooks<br/>Start/Stop/Reset/Stage/Select"]
        WSHook["WebSocket Hook<br/>Exponential backoff reconnect"]
        SchedHook["Scheduler Hook<br/>Queue + ratings + memory"]
        ConfHook["Confidence Hook<br/>5 metrics + anti-hallucination"]
        DRHook["Disaster Recovery Hook<br/>4-layer monitoring"]
    end

    Hooks -->|data| Dashboard
```
