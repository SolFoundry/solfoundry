# Three-Layer Economic System Design

## Overview

The Bounty Agent implements a three-layer economic system inspired by real-world agent economies. Each layer serves a distinct purpose in the value chain from task discovery to payment settlement.

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  ClawTasks   │ ──→ │  agent-token    │ ──→ │   MoltsPay   │
│  (Task Layer)│     │  (Agent Layer)  │     │ (Pay Layer)  │
│              │     │                 │     │              │
│ Bounties are │     │ Agents earn     │     │ Tokens are   │
│ posted as    │     │ internal tokens │     │ settled as   │
│ tasks with   │     │ for completed   │     │ real payments│
│ $FNDRY/RTC   │     │ subtasks        │     │ to wallets   │
└──────────────┘     └─────────────────┘     └──────────────┘
```

## Layer 1: ClawTasks (Task Discovery & Bounties)

**Purpose:** External bounty platforms become internal tasks.

| Platform | Reward Token | Integration |
|----------|-------------|-------------|
| SolFoundry | $FNDRY | GitHub Issues API |
| RustChain | RTC | GitHub Issues API |
| Expensify | USD | Helpwise API |
| Immunefi | USDC | Dashboard API |

**How it works:**
1. `BountyScanner` discovers bounties via GitHub search
2. Bounties are normalized into internal `BountyIssue` format
3. `BountyPlanner` decomposes into subtasks with estimated effort
4. Each subtask is assigned a credit value in agent-token

## Layer 2: agent-token (Internal Currency)

**Purpose:** Incentivize agents and track contributions within the team.

**Tokenomics:**
- **Earning:** Agents earn tokens per completed subtask
  - Research subtask: 10 tokens
  - Code subtask: 25 tokens
  - Security review: 30 tokens
  - Documentation: 15 tokens
  - Ops/Infrastructure: 20 tokens
- **Spending:** Tokens can be used for:
  - Priority task assignment (higher priority = more tokens)
  - Model upgrade requests (e.g., switch from GLM-5.1 to DeepSeek-V4-Pro)
  - Gateway slot reservation during peak hours

**Ledger:**
```python
@dataclass
class AgentTransaction:
    agent_id: str
    amount: int          # positive = credit, negative = debit
    reason: str          # "subtask_complete", "priority_boost", etc.
    bounty_id: str       # linked bounty
    timestamp: float
    
class AgentTokenSystem:
    def credit(self, agent_id, amount, reason, bounty_id):
        """Credit tokens to an agent for completing work."""
        
    def debit(self, agent_id, amount, reason):
        """Debit tokens when an agent requests priority/resources."""
        
    def get_balance(self, agent_id) -> int:
        """Get current token balance for an agent."""
        
    def get_leaderboard(self) -> List[Tuple[str, int]]:
        """Return agents sorted by token balance."""
```

**Properties:**
- Double-entry bookkeeping (every credit has a corresponding debit)
- Transactional outbox pattern for consistency
- Exponential backoff on ledger write failures
- Dead letter queue for failed transactions

## Layer 3: MoltsPay (Payment Settlement)

**Purpose:** Convert earned tokens into real-world payments.

**Settlement Flow:**
1. Agent accumulates agent-tokens from completed bounties
2. When a bounty PR is merged, the external reward is confirmed
3. MoltsPay initiates settlement to the team wallet
4. Funds are distributed proportionally to contributing agents

**Supported Payment Rails:**
| Rail | Currency | Min Amount | Settlement Time |
|------|----------|-----------|----------------|
| Solana | $FNDRY, RTC, USDC | 1 unit | ~2s |
| Ethereum | ETH, USDC | $5 equiv | ~2min |
| Fiat (Future) | USD | $50 | 3-5 days |

**Wallet Configuration:**
```yaml
moltspay:
  wallet_address: "${WALLET_ADDRESS}"
  settlement_threshold: 100  # minimum agent-token to settle
  auto_settle: true
  settlement_interval: "0 0 * * *"  # daily at midnight
```

## Economic Flow Example

**Scenario:** Team completes SolFoundry Bounty #855 (500K $FNDRY)

```
1. Discovery:    BountyScanner finds #855 → creates ClawTask
2. Planning:     BountyPlanner decomposes into 4 subtasks
3. Execution:    4 agents complete their subtasks
   → agent-014 (天机) earns 10 tokens (research)
   → agent-031 (玄码) earns 25 tokens (code)  
   → agent-001 (铁卫) earns 30 tokens (security)
   → agent-044 (博典) earns 15 tokens (docs)
4. Submission:   PR #1109 created, reviewed by 铁卫
5. Merge:        PR merged → 500K $FNDRY confirmed
6. Settlement:   MoltsPay distributes:
   → 天机: 10/80 × 500K = 62.5K $FNDRY
   → 玄码: 25/80 × 500K = 156.25K $FNDRY
   → 铁卫: 30/80 × 500K = 187.5K $FNDRY
   → 博典: 15/80 × 500K = 93.75K $FNDRY
```

## Why Three Layers?

| Concern | Single Layer | Three Layers |
|---------|-------------|--------------|
| Agent motivation | Hard to attribute | Clear per-agent tracking |
| Cross-platform | One token per platform | Unified internal currency |
| Payment timing | Immediate or never | Buffer for confirmation |
| Error recovery | All-or-nothing | Each layer has own retry |
| Scalability | Bottleneck at payment | Async settlement |

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| BountyScanner | ✅ Implemented | GitHub search with label detection |
| BountyPlanner | ✅ Implemented | Department-based decomposition |
| AgentTokenSystem | 🔄 Design | Ledger + outbox pattern |
| MoltsPay | 📋 Planned | Awaiting Solana wallet integration |

## Security Considerations

- **No direct wallet access from agents** — Agents interact only with the agent-token layer
- **Double-signing required** — Settlement needs both system + human approval for amounts > 1000 $FNDRY
- **Rate limiting** — Max 10 settlements per hour per wallet
- **Audit trail** — All transactions logged with ≥90 day retention
