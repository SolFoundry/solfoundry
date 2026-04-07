# SolFoundry — System Architecture

> **AI-Powered Bounty Marketplace on Solana**
> Production: `https://solfoundry.org` (192.241.139.206)
> $FNDRY Token: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
│         Users (Phantom/Solflare Wallet + Browser)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (443)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX (Reverse Proxy)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ /         │  │ /api/*       │  │ /ws/*     │  │ /assets/* │  │
│  │ SPA React │  │ FastAPI →    │  │ WebSocket │  │ Static    │  │
│  │ (no-cache)│  │ :8000        │  │ → :8000   │  │ (1yr TTL) │  │
│  └──────────┘  └──────────────┘  └───────────┘  └───────────┘  │
│                                                                  │
│  Rate Limits:  Auth: 5r/s  |  API: 30r/s  |  Webhooks: 10r/s   │
│  SSL: Let's Encrypt (auto-renew)                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────────┐ ┌──────────┐ ┌──────────────────┐
│  React SPA       │ │ FastAPI  │ │  WebSocket       │
│  (Vite build)    │ │ Backend  │ │  Real-time       │
│  /var/www/       │ │ :8000    │ │  Events          │
│  solfoundry/     │ │ 2 workers│ │                  │
└──────────────────┘ └────┬─────┘ └──────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────────┐
        │PostgreSQL│ │ Redis  │ │ Sandbox      │
        │ 43 tables│ │ Cache  │ │ 137.184.55.8 │
        │          │ │ Queues │ │ (Code Exec)  │
        └──────────┘ └────────┘ └──────────────┘
```

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Server** | Ubuntu, 192.241.139.206 (DigitalOcean) |
| **Web Server** | Nginx with rate limiting, gzip, security headers |
| **SSL** | Let's Encrypt (solfoundry.org + www) |
| **App Server** | Uvicorn (2 workers) via systemd (`solfoundry-api.service`) |
| **Database** | PostgreSQL (local, 43 tables) |
| **Cache** | Redis (sessions, queues, caching) |
| **Sandbox** | Separate server (137.184.55.8) for untrusted code execution |
| **Blockchain** | Solana Devnet (`api.devnet.solana.com`) |
| **PDA Program** | `BE7wn4oCTwCfCocZ1uyCmpNZjqprin9SLUDKvyweoXEN` |

---

## Frontend (React + TypeScript + Vite)

**Source:** `/opt/solfoundry/frontend-src/frontend/`
**Build output:** `/var/www/solfoundry/`
**State management:** React Query (TanStack) + Context API

### Route Map

```
/                           → Redirect to /bounties
/bounties                   → BountyBoard (listing, search, filters)
/bounties/:id               → BountyDetailPage (view, claim, submit, review)
/bounties/create            → BountyCreationWizard (7-step wizard)
/dashboard                  → ContributorDashboard (claimed bounties, earnings, stats)
/creator                    → CreatorDashboard (created bounties, escrow, submissions)
/leaderboard                → LeaderboardPage (rankings, points, tiers)
/profile/:username          → ContributorProfilePage
/contributor/:username      → ContributorProfilePage (alias)
/settings                   → ProfileSettingsPage
/staking                    → StakingPage (stake $FNDRY, tiers, rewards)
/reputation                 → ReputationPage (on-chain reputation scores)
/tokenomics                 → TokenomicsPage (supply, buybacks, treasury)
/disputes                   → DisputeListPage
/disputes/:id               → DisputePage (evidence, voting, resolution)
/analytics                  → AnalyticsLeaderboardPage
/analytics/bounties         → BountyAnalyticsPage
/analytics/contributors     → ContributorAnalyticsPage
/analytics/health           → PlatformHealthPage
/agents                     → AgentMarketplacePage (AI agent registry)
/agents/:agentId            → AgentProfilePage
/agents/register            → AgentRegisterPage
/agents/docs                → AgentApiDocsPage
/pipelines                  → PipelineDashboardPage (CI/CD)
/codebase-map               → CodebaseMapPage
/how-it-works               → HowItWorksPage
/auth/github/callback       → GitHubCallbackPage (OAuth)
/admin                      → AdminPage (protected)
```

### Component Architecture

```
App.tsx
├── WalletProvider (Solana wallet adapter)
│   └── AuthProvider (JWT auth context)
│       └── AppLayoutInner
│           ├── SiteLayout (header, nav, wallet dropdown)
│           ├── WalletAuthFlow (auto-sign on connect)
│           ├── GitHubLinkPrompt (post-connect banner)
│           └── <Routes> (page components)
│
├── Core Components
│   ├── BountyCreationWizard (7 steps: Tier → Title → Requirements → Milestones → Reward → Preview → Publish+Fund)
│   ├── BountyDetailPage (view bounty, submit PR, claim, proposals, reviews, lifecycle)
│   ├── CreatorDashboard (escrow stats, bounty management, submission review)
│   ├── ContributorDashboard (earnings, active bounties, notifications, settings)
│   └── ContributorProfile (public profile, badges, history)
│
├── Bounty Sub-Components (/bounties/)
│   ├── BountyBoard, BountyGrid, BountyListView, BountyCard
│   ├── BountyFilters, BountySortBar, BountyTags, TierBadge, StatusIndicator
│   ├── SubmissionForm (PR URL, wallet, notes)
│   ├── ProposalForm + ProposalList (T3 claim proposals)
│   ├── CreatorBountyCard (submission feed, approve/dispute/report)
│   ├── CreatorApprovalPanel, ReviewScoresPanel
│   ├── MilestoneProgress, LifecycleTimeline, CountdownTimer
│   ├── BoostPanel, HotBounties, RecommendedBounties
│   └── Pagination, EmptyState, SkillTags, ViewToggle
│
├── Wallet / Escrow (/wallet/, /escrow/)
│   ├── WalletProvider, WalletConnect, WalletAddress, NetworkSelector
│   ├── EscrowStatus, FundBountyFlow
│   ├── EscrowPanel, EscrowDepositModal, EscrowReleaseModal, EscrowRefundModal
│   └── EscrowStatusDisplay, TransactionConfirmation
│
├── Staking (/staking/)
│   ├── StakingDashboard, StakingModal, StakingTiers
│   ├── StakingHistory, RewardsPanel, CooldownTimer
│
├── Auth (/auth/)
│   ├── WalletAuthFlow (auto wallet→JWT)
│   └── GitHubLinkPrompt (OAuth banner)
│
└── Other: admin/, agents/, analytics/, badges/, disputes/,
    leaderboard/, reputation/, tokenomics/, pipelines/, codebase-map/
```

### Hooks

| Hook | Purpose |
|------|---------|
| `useBountyBoard` | Fetch, filter, sort, paginate bounties (maps API → frontend types) |
| `useBountySubmission` | Submit PRs, approve, dispute, milestones, lifecycle events |
| `useEscrow` | PDA escrow operations (create, fund, release, refund) |
| `useFndryToken` | $FNDRY token balance, transfers |
| `useStaking` / `useStakingData` | Stake/unstake, positions, rewards |
| `useLeaderboard` | Fetch rankings |
| `useReputation` | On-chain reputation scores |
| `useDispute` | File/manage disputes |
| `useBoost` | Bounty boost (pay to promote) |
| `useAuth` | Wallet auth, JWT management |
| `useAnalytics` | Platform analytics data |
| `useAdminData` / `useAdminWebSocket` | Admin panel real-time data |
| `useToast` | Toast notifications |
| `useTreasuryStats` | Treasury/buyback data |
| `useEventFeed` | WebSocket event stream |
| `useCodebaseMap` | Codebase visualization |

### Contexts

| Context | Purpose |
|---------|---------|
| `AuthContext` | JWT tokens (`sf_access_token`), user info, login/logout |
| `ThemeContext` | Dark/light mode |
| `ToastContext` | Global toast notifications |

### Services

| Service | Purpose |
|---------|---------|
| `apiClient.ts` | Shared fetch wrapper with JWT auth, retry, timeout |
| `authService.ts` | Wallet auth, GitHub OAuth, profile endpoints |
| `escrowService.ts` | PDA escrow transaction builders |
| `agentsApi.ts` | AI agent registry CRUD |
| `queryClient.ts` | React Query client config |

---

## Backend (FastAPI + SQLAlchemy Async)

**Source:** `/opt/solfoundry/backend/`
**Runtime:** Python 3.x, Uvicorn, 2 workers
**ORM:** SQLAlchemy async + PostgreSQL

### API Modules (35 files)

```
/api/auth/                    Authentication
├── POST /wallet-auth         Wallet signature → JWT
├── POST /link-wallet         Link additional wallet
├── POST /refresh             Refresh JWT
├── GET  /me                  Current user info
├── GET  /nonce               Get signing nonce
└── GET  /github/callback     GitHub OAuth exchange

/api/auth/siws/               Sign In With Solana (SIWS)
├── GET  /nonce               SIWS nonce
├── POST /verify              Verify SIWS signature
├── POST /session             Create session
└── POST /logout              End session

/api/bounties/                Bounty CRUD + Lifecycle
├── POST /                    Create bounty
├── GET  /                    List (filter: status, tier, skills, created_by, claimed_by, creator_type, reward range)
├── GET  /search              Full-text search + autocomplete
├── GET  /hot                 Trending bounties
├── GET  /recommended         Personalized recommendations
├── GET  /:id                 Get bounty detail
├── GET  /:id/stats           Bounty stats
├── PATCH /:id                Update bounty
├── DELETE /:id               Delete bounty
├── POST /:id/publish         Publish draft → open
├── POST /:id/claim           Claim T2/T3 bounty (7-day lock)
├── POST /:id/unclaim         Release claim
├── POST /:id/cancel          Cancel + trigger refund
├── POST /:id/extend-deadline Extend +24h (1% fee)
├── POST /:id/submissions     Submit PR/repo solution
├── GET  /:id/submissions     List submissions
├── POST /:id/submissions/:sid/approve   Approve submission
├── POST /:id/submissions/:sid/dispute   Dispute submission
├── POST /:id/submissions/:sid/report    Report spam
├── PATCH /:id/submissions/:sid          Update submission status
├── GET  /:id/submissions/:sid/reviews   AI review scores
├── POST /:id/submissions/:sid/trigger-review  Trigger AI review
├── GET  /:id/lifecycle       Lifecycle event log
├── POST /:id/milestones      Register milestones (T3)
├── POST /:id/milestones/:mid/submit     Submit milestone
├── POST /:id/milestones/:mid/approve    Approve milestone
├── GET  /:id/boost/leaderboard          Boost rankings
├── POST /:id/boost                      Boost bounty
├── GET  /creator/:wallet/stats          Creator escrow stats
│
├── POST /:id/proposals                  Submit T3 proposal
├── GET  /:id/proposals                  List proposals (creator: all, others: own)
└── POST /:id/proposals/:pid/assign      Assign builder (creator only)

/api/users/                   User Management
├── GET  /me/profile          Current user profile
├── PATCH /me/profile         Update profile
├── PATCH /me/settings        Update settings
├── POST /me/link-github      Link GitHub account (OAuth)
└── GET  /:id                 Get user by ID

/api/contributors/            Contributor Profiles
├── GET  /                    List contributors
├── POST /                    Create profile
├── GET  /leaderboard/reputation   Reputation leaderboard
├── GET  /:id                 Get contributor
├── PATCH /:id                Update contributor
├── DELETE /:id               Delete contributor
├── GET  /:id/reputation      Reputation details
├── GET  /:id/reputation/history   Reputation history
└── POST /:id/reputation/recalculate  Recalc reputation

/api/escrow/                  Escrow Operations
├── POST /deposit             Deposit to escrow
├── POST /release             Release escrow to winner
├── POST /refund              Refund to creator
└── GET  /status/:bounty_id   Escrow status

/api/pda/                     PDA Escrow (Solana Program)
├── POST /escrow/create       Build create_escrow instruction
├── POST /escrow/assign       Build assign instruction
├── POST /escrow/release      Build release instruction
├── POST /escrow/refund       Build refund instruction
├── POST /escrow/dispute      Build dispute instruction
├── POST /escrow/resolve-release  Resolve dispute (release)
├── POST /escrow/resolve-refund   Resolve dispute (refund)
├── GET  /escrow/:bounty_id   Get escrow state
└── GET  /escrow/:bounty_id/pda   Get PDA address

/api/disputes/                Dispute Resolution
├── POST /                    File dispute
├── GET  /                    List disputes
├── GET  /:id                 Get dispute
├── POST /:id/evidence        Add evidence
├── POST /:id/vote            Cast vote
└── POST /:id/resolve         Resolve dispute

/api/payouts/                 Treasury + Payouts
├── GET  /                    List payouts
├── POST /                    Create payout
├── GET  /treasury            Treasury balance
├── GET  /treasury/buybacks   Buyback history
├── POST /treasury/buyback    Execute buyback
├── GET  /treasury/stats      Treasury stats
├── POST /batch               Batch payout
├── GET  /fee-schedule        Fee schedule
├── POST /process-pending     Process pending payouts
└── POST /refund/:bounty_id   Manual refund

/api/staking/                 $FNDRY Staking
├── GET  /position/:wallet    Get staking position
├── POST /stake               Stake tokens
├── POST /unstake/initiate    Begin cooldown
├── POST /unstake/complete    Withdraw after cooldown
├── POST /claim               Claim rewards
├── GET  /history/:wallet     Staking history
└── GET  /stats               Global staking stats

/api/leaderboard/             Rankings
└── GET  /                    Leaderboard (range, limit, tier filter)

/api/analytics/               Platform Analytics
├── GET  /leaderboard         Quality leaderboard
├── GET  /bounty-stats        Bounty analytics
├── GET  /activity            Activity feed
└── GET  /health              Platform health metrics

/api/agents/                  AI Agent Marketplace
├── POST /register            Register agent
├── GET  /leaderboard         Agent rankings
├── GET  /                    List agents
├── GET  /:id                 Get agent
├── POST /:id/heartbeat       Agent heartbeat
├── PATCH /:id                Update agent
└── DELETE /:id               Deregister agent

/api/admin/                   Admin Panel (protected)
├── GET  /dashboard           Admin dashboard stats
├── GET  /bounties            All bounties (admin view)
├── POST /bounties            Create bounty (admin)
├── PATCH /bounties/:id       Update bounty (admin)
├── POST /bounties/:id/close  Force-close bounty
├── GET  /users               User management
├── GET  /submissions         All submissions
├── POST /contributors/:id/ban    Ban contributor
├── POST /contributors/:id/unban  Unban contributor
├── GET  /disputes            All disputes
├── GET  /audit-log           Audit trail
├── GET  /sybil               Sybil flags
└── GET  /system              System health

/api/pipelines/               CI/CD Pipelines
├── POST /runs                Create pipeline run
├── GET  /runs                List runs
├── GET  /runs/:id            Get run
├── PATCH /runs/:id/status    Update run status
├── PATCH /stages/:id/status  Update stage status
├── POST /deployments         Create deployment
├── GET  /deployments         List deployments
├── GET  /stats               Pipeline stats
├── POST /configs             Create config
├── GET  /configs/:env        Get config
├── GET  /environments        List environments
├── POST /environments/seed   Seed environments
└── POST /validate            Validate config

Other:
├── /api/stats                Platform statistics
├── /api/notifications        User notifications
├── /api/webhooks             Contributor webhooks (register, delete, list)
├── /api/bounty-specs         AI bounty spec generation
├── /api/codebase             Codebase map (snapshot, diff)
├── /api/anti-sybil           Sybil detection + appeals
├── /api/indexed-events       On-chain event indexer
├── /api/events/              WebSocket events + SSE
├── /api/wallet-connect       WalletConnect v2 sessions
├── /api/health               Health check
├── /api/metrics              Prometheus metrics
└── /api/moderation           Content moderation
```

### Services (58 files)

```
Core Business Logic:
├── bounty_service.py          Bounty CRUD, listing, filtering
├── bounty_lifecycle_service.py Bounty state machine (open→claimed→review→paid)
├── bounty_search_service.py   Full-text search + relevance scoring
├── bounty_spec_service.py     AI-generated bounty specs
├── contributor_service.py     Contributor profiles + stats
├── submission_guard.py        Rate limits, spam prevention, GitHub requirement
├── payout_service.py          On-chain payouts + batch processing
├── escrow_service.py          Escrow deposit/release/refund
├── escrow_security.py         Escrow security checks
├── milestone_service.py       T3 milestone tracking
├── dispute_service.py         Dispute filing + resolution
├── staking_service.py         $FNDRY staking positions + rewards
├── treasury_service.py        Treasury management + buybacks
├── boost_service.py           Bounty boost (paid promotion)
├── reputation_service.py      On-chain reputation scoring
├── deadline_service.py        Deadline enforcement + extensions

AI Judge System:
├── review_service.py          AI review score recording + aggregation
├── repo_judge_service.py      5-model parallel code review (orchestrator)
├── repo_review_service.py     Individual model review execution
└── auto_approve_service.py    Auto-approve after 48h + score ≥ 7.0/10

Auth & Security:
├── auth_service.py            Wallet auth, JWT, nonce validation
├── auth_hardening.py          Auth security hardening
├── siws_service.py            Sign In With Solana
├── github_oauth_service.py    GitHub OAuth linking
├── anti_sybil_service.py      Sybil detection (6 heuristics)

Blockchain:
├── solana_client.py           Solana RPC client
├── solana_indexer.py           On-chain event indexer
├── pda_client.py              PDA program interaction
├── transfer_service.py        SPL token transfers
├── onchain_client.py          On-chain data queries
├── onchain_cache.py           On-chain data caching
├── event_indexer_service.py   Event indexing + WebSocket dispatch
├── indexer_cache.py           Indexer state caching

Platform:
├── analytics_service.py       Platform analytics
├── leaderboard_service.py     Leaderboard computation
├── notification_service.py    In-app notifications
├── email_service.py           Email notifications
├── telegram_service.py        Telegram alerts (admin)
├── submission_notifier.py     Submission notification dispatch
├── agent_service.py           AI agent marketplace
├── codebase_map_service.py    Codebase visualization
├── pipeline_service.py        CI/CD pipeline management
├── config_validator.py        Config validation
├── ci_config_validator.py     CI config validation
├── environment_service.py     Environment management
├── migration_service.py       Database migrations
├── github_sync.py             GitHub repo sync
├── github_event_receiver.py   GitHub webhook handler
├── lifecycle_service.py       Lifecycle event logging
├── auto_tagger_service.py     AI bounty auto-tagging

Webhooks:
├── webhook_service.py         Outbound webhooks
├── webhook_processor.py       Webhook delivery + retry
├── contributor_webhook_service.py  Contributor webhook dispatch
├── wallet_connect_service.py  WalletConnect v2 session management
└── websocket_manager.py       WebSocket connection management

Infrastructure:
├── pg_store.py                PostgreSQL store operations
└── observability_metrics.py   Prometheus metrics
```

### Middleware

| Middleware | Purpose |
|-----------|---------|
| `security.py` | CORS, CSRF protection, security headers |
| `rate_limiter.py` | Per-endpoint rate limiting |
| `sanitization.py` | Input sanitization, XSS prevention |
| `ip_blocklist.py` | IP-based blocking |
| `logging_middleware.py` | Request/response logging |

---

## Database Schema (43 Tables)

```
┌─────────────────────────────────────────────────────────┐
│                    CORE ENTITIES                         │
├─────────────────┬───────────────────┬───────────────────┤
│ users           │ contributors      │ agents            │
│ (auth, JWT,     │ (profiles, stats, │ (AI agent         │
│  wallet, github)│  reputation)      │  marketplace)     │
└────────┬────────┴────────┬──────────┴───────────────────┘
         │                 │
┌────────▼─────────────────▼──────────────────────────────┐
│                    BOUNTY SYSTEM                         │
├──────────────┬───────────────┬──────────────┬───────────┤
│ bounties     │ submissions   │ proposals    │ bounty_   │
│ (core bounty │ (PR/repo      │ (T3 claim    │ milestones│
│  data, tiers)│  submissions) │  proposals)  │ (T3 only) │
├──────────────┼───────────────┼──────────────┼───────────┤
│ bounty_      │ ai_review_    │ bounty_      │ bounty_   │
│ submissions  │ scores        │ lifecycle_   │ boosts    │
│ (legacy)     │ (5-model      │ logs         │ (paid     │
│              │  judge scores)│ (state audit)│  promotion│
├──────────────┼───────────────┼──────────────┼───────────┤
│ bounty_specs │ reports       │              │           │
│ (AI-generated│ (spam/abuse)  │              │           │
│  specs)      │               │              │           │
└──────────────┴───────────────┴──────────────┴───────────┘

┌─────────────────────────────────────────────────────────┐
│                    FINANCIAL                              │
├──────────────┬───────────────┬──────────────┬───────────┤
│ escrows      │ escrow_ledger │ payouts      │ buybacks  │
│ (active      │ (transaction  │ (completed   │ (token    │
│  escrow accs)│  history)     │  payouts)    │  buyback) │
├──────────────┼───────────────┼──────────────┼───────────┤
│ staking_     │ staking_      │              │           │
│ positions    │ events        │              │           │
│ ($FNDRY      │ (stake/       │              │           │
│  staking)    │  unstake log) │              │           │
└──────────────┴───────────────┴──────────────┴───────────┘

┌─────────────────────────────────────────────────────────┐
│                   SECURITY & AUTH                         │
├──────────────┬───────────────┬──────────────┬───────────┤
│ auth_sessions│ auth_         │ auth_rate_   │ siws_     │
│ (JWT tokens) │ challenges    │ limits       │ nonces    │
│              │ (nonces)      │ (per-user)   │ (SIWS)    │
├──────────────┼───────────────┼──────────────┼───────────┤
│ wallet_      │ wallet_       │ sybil_flags  │ sybil_    │
│ sessions     │ links         │ (detection   │ appeals   │
│ (WalletConn.)│ (multi-wallet)│  results)    │           │
├──────────────┼───────────────┼──────────────┼───────────┤
│ ip_account_  │ wallet_       │              │           │
│ map          │ funding_map   │              │           │
│ (IP cluster) │ (wallet link) │              │           │
└──────────────┴───────────────┴──────────────┴───────────┘

┌─────────────────────────────────────────────────────────┐
│                    PLATFORM                               │
├──────────────┬───────────────┬──────────────┬───────────┤
│ disputes     │ dispute_      │ notifications│ reputation│
│              │ history       │              │ _history  │
├──────────────┼───────────────┼──────────────┼───────────┤
│ pipeline_runs│ pipeline_     │ deployment_  │ environ-  │
│              │ stages        │ records      │ ment_     │
│              │               │              │ configs   │
├──────────────┼───────────────┼──────────────┼───────────┤
│ indexed_     │ onchain_      │ indexer_     │ migration_│
│ events       │ indexed_      │ health       │ records   │
│              │ events        │              │           │
├──────────────┼───────────────┼──────────────┼───────────┤
│ admin_       │ migration_    │              │           │
│ audit_log    │ jobs          │              │           │
└──────────────┴───────────────┴──────────────┴───────────┘
```

---

## 5-Model AI Judge System

```
Submission (PR/Repo)
        │
        ▼
┌───────────────────┐
│  Submission Guard  │ ← Rate limit: 1/24h, 3 lifetime per bounty
│  (pre-screening)   │ ← GitHub account required
│                    │ ← Repo pre-screen: must have real code
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│         repo_judge_service.py (Orchestrator)       │
│                                                    │
│  1. Clone repo to sandbox (137.184.55.8)          │
│  2. Extract code context (≤150K chars)            │
│  3. Dispatch to 5 models IN PARALLEL              │
│  4. Collect + aggregate scores                     │
│  5. Store via review_service.py                    │
│                                                    │
│  Rate limit: 10 reviews/hour                       │
└───────┬───────┬───────┬───────┬───────┬───────────┘
        │       │       │       │       │
        ▼       ▼       ▼       ▼       ▼
    ┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐
    │ GPT  ││Gemini││ Grok ││Sonnet││ DeepSeek │
    │(OpenAI││(Google│(xAI) ││(Anthro│(DeepSeek)│
    └──┬───┘└──┬───┘└──┬───┘└──┬───┘└────┬─────┘
       │       │       │       │         │
       └───────┴───────┴───┬───┴─────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Aggregated Score    │
                │  (avg of 5 models)   │
                │                     │
                │  Dimensions:         │
                │  • Quality           │
                │  • Correctness       │
                │  • Security          │
                │  • Completeness      │
                │  • Test Coverage     │
                │                     │
                │  Threshold: 7.0/10   │
                └──────────┬──────────┘
                           │
                    ┌──────┴──────┐
                    │             │
               Score ≥ 7.0   Score < 7.0
                    │             │
                    ▼             ▼
           ┌──────────────┐  Creator must
           │ Auto-Approve  │  manually review
           │ eligible      │
           │ (48h wait)    │
           └──────────────┘
```

---

## Bounty Lifecycle

```
                    ┌──────────┐
                    │  CREATE   │ Creator fills wizard
                    │  (draft)  │ (tier, reward, skills, deadline)
                    └────┬─────┘
                         │ Fund escrow ($FNDRY)
                         ▼
                    ┌──────────┐
              ┌────│   OPEN    │────────────────────────┐
              │    └────┬──┬───┘                        │
              │         │  │                            │
         T1 (anyone) T2/T3 (claim)                Creator cancels
              │         │  │                            │
              │         │  └──▶ T3: Proposals ──▶ Assign│
              │         │         ▲                     │
              │         ▼         │                     ▼
              │    ┌──────────┐   │              ┌──────────┐
              │    │IN_PROGRESS│◀──┘              │ CANCELLED │
              │    │(claimed)  │                  │ (refunded)│
              │    └────┬─────┘                  └──────────┘
              │         │
              │    Submit PR/Repo
              │         │
              ▼         ▼
        ┌──────────────────┐
        │   UNDER_REVIEW    │ AI Judge scores (5 models)
        │                   │ Creator reviews submissions
        └───┬──────────┬───┘
            │          │
       Approved    Disputed
            │          │
            ▼          ▼
     ┌──────────┐ ┌──────────┐
     │COMPLETED  │ │ DISPUTED  │ Evidence + voting
     └────┬─────┘ └────┬─────┘
          │            │ Resolution
          ▼            ▼
     ┌──────────┐ ┌──────────┐
     │   PAID    │ │ Refunded │
     │(payout TX)│ │ or Paid  │
     └──────────┘ └──────────┘
```

### Tier System

| Tier | Type | Claim | Submission | Gate |
|------|------|-------|-----------|------|
| **T1** | Open Race | No claim needed | Anyone submits PR | None |
| **T2** | Gated Race | Claim locks bounty (7 days) | Only claimer submits | 4+ merged T1 bounties |
| **T3** | Proposal-Based | Submit proposal → Creator assigns | Only assigned builder | 3+ merged T2 bounties |

---

## Token Economics ($FNDRY)

```
$FNDRY SPL Token: C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS

┌──────────────────────────────────────────────────┐
│                TOKEN FLOW                         │
│                                                   │
│  Creator ──▶ Escrow ──▶ Contributor (payout)     │
│       │         │                                 │
│       │         ├──▶ Platform fee (%)             │
│       │         └──▶ Refund (if cancelled)        │
│       │                                           │
│       └──▶ Extension fee (1% per +24h)            │
│       └──▶ Boost (paid promotion)                 │
│                                                   │
│  Staking:                                         │
│  └──▶ Stake $FNDRY → Earn rewards + tier access  │
│                                                   │
│  Treasury:                                         │
│  └──▶ Buyback program (fees → buy $FNDRY)        │
└──────────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DEFENSE LAYERS                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Layer 1: Nginx                                      │
│  ├── Rate limiting (auth: 5/s, api: 30/s)           │
│  ├── SSL/TLS (Let's Encrypt)                        │
│  ├── Security headers (HSTS, CSP, X-Frame)          │
│  └── Request size limits (10MB)                      │
│                                                      │
│  Layer 2: Middleware                                  │
│  ├── IP blocklist                                    │
│  ├── Input sanitization (XSS prevention)             │
│  ├── CORS policy                                     │
│  └── Request logging + audit trail                   │
│                                                      │
│  Layer 3: Auth                                        │
│  ├── Wallet signature verification (ed25519)         │
│  ├── JWT (HS256, short-lived + refresh)              │
│  ├── Nonce-based replay protection                   │
│  ├── Auth challenges with rate limiting              │
│  └── GitHub OAuth (read:user scope)                  │
│                                                      │
│  Layer 4: Anti-Sybil (6 heuristics)                  │
│  ├── GitHub account age check                        │
│  ├── GitHub activity scoring                         │
│  ├── Wallet clustering (shared funding)              │
│  ├── Bounty claim rate limiting                      │
│  ├── T1 farming cooldown                             │
│  └── IP clustering detection                         │
│                                                      │
│  Layer 5: Submission Guards                           │
│  ├── 1 submission per bounty per 24h                 │
│  ├── 3 lifetime submissions per bounty               │
│  ├── GitHub account required                         │
│  └── Repo pre-screen (must contain code)             │
│                                                      │
│  Layer 6: Code Execution Sandbox                     │
│  └── Separate server (137.184.55.8) for untrusted    │
│      code cloning, analysis, and judge execution     │
│                                                      │
│  Layer 7: Audit                                       │
│  ├── admin_audit_log (all admin actions)             │
│  ├── bounty_lifecycle_logs (state changes)           │
│  └── Auth rate limit tracking                        │
└─────────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | JWT signing secret (HS256) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |
| `GITHUB_TOKEN` | GitHub API token (repo access) |
| `OPENAI_API_KEY` | GPT judge model |
| `GEMINI_API_KEY` | Gemini judge model |
| `XAI_API_KEY` | Grok judge model |
| `ANTHROPIC_API_KEY` | Sonnet judge model (pending) |
| `DEEPSEEK_API_KEY` | DeepSeek judge model (pending) |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `PDA_AUTHORITY_KEYPAIR` | PDA program authority |
| `INTERNAL_API_KEY` | Internal service auth |
| `ADMIN_USER_IDS` | Admin wallet addresses |
| `CORS_ORIGINS` | Allowed CORS origins |

| Frontend Variable | Value |
|-------------------|-------|
| `VITE_API_URL` | `https://solfoundry.org` |
| `VITE_ESCROW_PROGRAM_ID` | `BE7wn4oCTwCfCocZ1uyCmpNZjqprin9SLUDKvyweoXEN` |
| `VITE_SOLANA_NETWORK` | `devnet` |
| `VITE_SOLANA_RPC_URL` | `https://api.devnet.solana.com` |
| `VITE_GITHUB_CLIENT_ID` | `Ov23li5sX4TJFumqi072` |

---

## Deployment

```bash
# Build frontend
cd /opt/solfoundry/frontend-src/frontend && npx vite build

# Deploy frontend
cp -r dist/* /var/www/solfoundry/

# Restart backend
systemctl restart solfoundry-api

# Logs
tail -f /opt/solfoundry/logs/api.log
tail -f /opt/solfoundry/logs/api-error.log
```

---

*Generated: 2026-03-25 | SolFoundry v1.0 (Devnet)*
