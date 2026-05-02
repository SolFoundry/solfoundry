# Autonomous Bounty-Hunting Agent — Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                  AutonomousBountyAgent                    │
│                    (Main Controller)                      │
├──────────┬──────────┬──────────────┬──────────┤
│  Phase 1  │  Phase 2  │    Phase 3    │  Phase 4  │
│  Discover  │  Analyze   │   Implement   │  Submit   │
│            │           │               │           │
│ ┌───────┐ │ ┌────────┐│  ┌──────────┐ │ ┌───────┐ │
│ │Scanner │ │ │Planner ││  │Orchestrator│ │ │Submit │ │
│ │       │ │ │        ││  │          │ │ │       │ │
│ │GitHub │ │ │Dept    ││  │Multi-agent │ │ │gh pr  │ │
│ │Search │ │ │Mapping ││  │Multi-GW │ │ │create │ │
│ └───────┘ │ └────────┘│  └──────────┘ │ └───────┘ │
└───────────┴───────────┴───────────────┴──────────┘
```

## 4-Phase Pipeline

### Phase 1: Discovery (`BountyScanner`)
- Scans GitHub for issues labeled `bounty`
- Extracts reward amounts from issue titles
- Assesses difficulty from tier labels (tier-1=easy, tier-2=medium, tier-3=hard)
- Prioritizes: easy → medium → hard → unknown

### Phase 2: Planning (`BountyPlanner`)
- Decomposes bounty into subtasks
- Maps each subtask to a department:
  - 🔍 **Research (Research)** — Requirements analysis
  - 💻 **Code (Code)** — Implementation
  - 🛡️ **Security (Security)** — Security review
  - 📚 **Knowledge (Knowledge)** — Documentation
  - ⚙️ **Ops (Ops)** — Infrastructure

### Phase 3: Execution (`TeamOrchestrator`)
- Multi-agent across multiple gateways
- Multi-LLM: GLM-5.1, DeepSeek-V4-Pro, Qwen-3.5-397B, Qwen-2.5-Coder-32B
- Task assignment with idle detection
- Gateway load balancing across 7 ports (18789-18795)

### Phase 4: Submission (`PRSubmitter`)
- Fork → Branch → Commit → PR workflow
- Multi-LLM reviewed PR body template
- Automatic PR creation via `gh` CLI

## Agent Architecture

```
Department     │ Count │ Gateways │ Models
───────────────┼───────┼──────────┼──────────────────────
Security  │  13   │ GW-1,7  │ glm-5.1, deepseek-v4
Research  │  17   │ GW-2,3  │ glm-5.1, qwen-3.5
Code      │   9   │ GW-4,5  │ qwen-2.5-coder, glm
Knowledge │   5   │ GW-6    │ glm-5.1
Ops       │   7   │ GW-1,2  │ glm-5.1
```

## Gateway Topology

```
GW-1:18789 ─┬─ Security (5 agents)
             └─ Ops (4 agents)
GW-2:18790 ─┬─ Research (9 agents)
             └─ Ops (3 agents)
GW-3:18801 ─── Research (8 agents)
GW-4:18792 ─── Code (5 agents)
GW-5:18793 ─── Code (4 agents)
GW-6:18794 ─── Knowledge (5 agents)
GW-7:18795 ─── Security (8 agents)
```

## Security Model

- GitHub Token via environment variable (never hardcoded)
- API keys stored in GitHub Secrets
- Multi-LLM cross-review before PR submission
- No data exfiltration — agents only access public repos
- Subprocess calls use explicit arguments (not shell=True)

## Why Python?

This agent is implemented in Python — a deliberate choice over TypeScript/Node.js alternatives. Here's why:

### Production Reliability
| Factor | Python | TypeScript/Node.js |
|--------|--------|-------------------|
| **Crash recovery** | Native SQLite via stdlib | Requires `better-sqlite3` native addon |
| **Subprocess control** | `subprocess.run()` — explicit args, no shell injection | `child_process.exec()` — shell=True by default |
| **Retry/resilience** | Clean generator-based backoff | Requires async ceremony for equivalent logic |
| **Type safety** | `dataclass` + type hints (runtime + static) | TypeScript interfaces (compile-time only) |

### Cross-Platform Advantage
- **Zero runtime dependency**: Python 3.10+ is pre-installed on macOS, Ubuntu, Debian, Raspberry Pi OS
- **Vintage hardware**: Runs on 15-year-old hardware (PowerPC G5, vintage Macs) — aligned with RustChain's Proof-of-Antiquity mission
- **Lightweight**: ~50MB Python install vs ~400MB Node.js runtime
- **Fast startup**: ~0.3s cold start vs ~2s for Node.js

### LLM Ecosystem
- Python's AI/ML ecosystem is unmatched: `openai`, `anthropic`, `litellm`, `transformers`
- Direct integration with `gh` CLI via subprocess — zero abstraction overhead
- No npm dependency tree — deterministic builds with `requirements.txt`

### Bounty-Specific Benefits
- GitHub CLI (`gh`) is a Python-friendly tool — direct subprocess calls
- `dataclass` models for BountyIssue, BountyPlan, etc. — clean and testable
- `pytest` ecosystem: 116 tests with fixtures, mocking, parametrization out of the box
- Single-file deployment: `pip install -r requirements.txt && python -m bounty_agent`

### When TypeScript Makes Sense
TypeScript excels in frontend/web contexts (React Dashboard, web UIs). We use it there — but for the core agent runtime, Python's simplicity, reliability, and cross-platform reach are decisive.

## Configuration

See `config.bounty-agent.yaml` for platform settings and agent configuration.
---

## Architecture Diagrams

### System Overview

```mermaid
graph TB
    subgraph "Agent Cluster"
        GW1["GW-1<br/>Orchestrator<br/>:18789"]
        GW2["GW-2<br/>Research<br/>:18790"]
        GW3["GW-3<br/>Security<br/>:18791"]
        GW4["GW-4<br/>Monitor<br/>:18792"]
        GW5["GW-5<br/>Scheduler<br/>:18793"]
        GW6["GW-6<br/>Code<br/>:18794"]
        GW7["GW-7<br/>Decision<br/>:18795"]
    end

    subgraph "Core Services"
        SCHED["Agent Scheduler<br/>S/A/B/C Tier Dispatch"]
        ECON["Economic System<br/>ClawTasks → Token → MoltsPay"]
        RELAY["Bot-to-Bot Relay<br/>Triple Anti-Loop"]
        LLM["LLM Client<br/>5-Tier Fallback"]
        MEM["Memory Manager<br/>4-Layer Persistence"]
    end

    subgraph "Safety Layers"
        AH["Anti-Hallucination<br/>5-Layer Defense"]
        FT["Fault Tolerance<br/>4-Layer Recovery"]
    end

    subgraph "External"
        GH["GitHub API"]
        SF["SolFoundry"]
        RC["RustChain"]
        SOL["Solana Wallet"]
    end

    GW1 & GW2 & GW3 & GW4 & GW5 & GW6 & GW7 --> RELAY
    RELAY --> SCHED
    SCHED --> LLM
    LLM --> MEM
    SCHED --> ECON
    ECON --> SOL
    LLM --> AH
    SCHED --> FT
    GW1 --> GH
    GW1 --> SF
    GW2 --> RC
```

### Bounty Pipeline Flow

```mermaid
flowchart LR
    DISC[1. Discover] --> ANALYZE[2. Analyze]
    ANALYZE --> PLAN[3. Plan]
    PLAN --> IMPL[4. Implement]
    IMPL --> TEST[5. Test]
    TEST --> SUBMIT[6. Submit PR]
    SUBMIT --> COMPLETE[7. Complete]

    DISC -->|BountyHunterAgent| SCHED{Scheduler}
    ANALYZE -->|SolutionBuilder| SCHED
    IMPL -->|CoderAgent| SCHED
    TEST -->|TestRunner| SCHED
    SUBMIT -->|PRSubmitter| SCHED
    SCHED -->|S-tier for hard| GW_S[GW S-tier]
    SCHED -->|B/C for easy| GW_BC[GW B/C-tier]
```

### Economic System Flow

```mermaid
flowchart TB
    BOUNTY["Bounty Reward<br/>(RTC/FNDRY/USDC)"] --> CT["ClawTasks<br/>Register & Distribute"]
    CT --> |Per-agent share| AT["AgentTokenSystem<br/>Internal Currency"]
    AT --> |Micro-payments| AGENTS["Agent Wallets"]
    AT --> |Settlement| MP["MoltsPay<br/>Payment Settlement"]
    MP --> |Payout| WALLET["Solana Wallet<br/>Lt9nERv6..."]
    MP --> |Failed| DLQ["Dead Letter Queue<br/>+ Retry"]
```

### LLM Fallback Chain

```mermaid
flowchart TD
    T1["Tier 1: DeepSeek<br/>Primary"] -->|Error/Timeout| T2["Tier 2: Qwen<br/>Secondary"]
    T2 -->|Error/Timeout| T3["Tier 3: Kimi<br/>Tertiary"]
    T3 -->|Error/Timeout| T4["Tier 4: Reasoner<br/>Quaternary"]
    T4 -->|Error/Timeout| T5["Tier 5: Qwen Max<br/>Last Resort"]
    T5 -->|All Failed| ERR["Raise Error<br/>+ Dead Letter"]
```

### Scheduler S/A/B/C Grading
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

### Disaster Recovery (4-Layer)
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

### React Dashboard Components
```mermaid
graph TB
    subgraph Dashboard["BountyAgentDashboard.tsx (1060 lines)"]
        MissionCtrl["Mission Control<br/>Start/Stop/Reset"]
        Pipeline["Pipeline Progress<br/>Discover→Analyze→Implement→Submit"]
        AgentGrid["Agent Status Grid<br/>Multi-agent, 5 departments"]
        EconPanel["💰 Economic Panel<br/>ClawTasks → agent-token → MoltsPay"]
        Confidence["🎯 Confidence Dashboard<br/>5 gauges + anti-hallucination"]
        SchedQueue["⚙️ Scheduler Queue<br/>S/A/B/C ratings + memory bar"]
        Disaster["🛡️ Disaster Recovery<br/>4-layer status"]
        WSBar["WebSocket Status<br/>Latency + reconnect count"]
    end

    subgraph Hooks["useBountyAgent.ts (542 lines)"]
        QHooks["Query Hooks<br/>8 auto-refresh endpoints"]
        MutHooks["Mutation Hooks<br/>Start/Stop/Reset/Stage/Select"]
        WSHook["WebSocket Hook<br/>Exponential backoff reconnect"]
        SchedHook["Scheduler Hook<br/>Queue + ratings + memory"]
    end

    Hooks -->|data| Dashboard
```

### 4-Phase Pipeline Sequence
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
