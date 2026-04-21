import { EventEmitter } from 'events';

export interface BountyPollerConfig {
  apiBaseUrl: string;
  pollIntervalMs?: number;
}

export interface Bounty {
  id: string;
  title: string;
  description?: string;
  tier?: number;
  domain?: string;
  status?: string;
  reward_amount?: number;
  currency?: string;
  created_at?: string;
  url?: string;
  labels?: string[];
}

export class BountyPoller extends EventEmitter {
  private readonly apiBaseUrl: string;
  private readonly pollIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seenIds: Set<string> = new Set();
  private lastPollAt: number = 0;

  constructor(config: BountyPollerConfig) {
    super();
    this.apiBaseUrl = config.apiBaseUrl;
    this.pollIntervalMs = config.pollIntervalMs ?? 300_000;
  }

  async start(): Promise<void> {
    if (this.timer) return;
    console.log(`🔍 Starting bounty poller (every ${this.pollIntervalMs / 1000}s)`);
    await this.poll();
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    console.log('🛑 Bounty poller stopped');
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/bounties?status=open&limit=50&sort=created_at:desc`);
      if (!response.ok) { console.error(`Poll failed: ${response.status}`); return; }
      const data = await response.json() as { bounties?: Bounty[]; items?: Bounty[] };
      const bounties: Bounty[] = data.bounties ?? data.items ?? [];
      for (const bounty of bounties) {
        if (!this.seenIds.has(bounty.id)) {
          this.seenIds.add(bounty.id);
          this.emit('newBounty', bounty);
        }
      }
      this.lastPollAt = Date.now();
      console.log(`📋 Polled ${bounties.length} bounties, ${this.seenIds.size} tracked`);
    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  getLastPollAt(): number { return this.lastPollAt; }
  getSeenCount(): number { return this.seenIds.size; }
  isRunning(): boolean { return this.timer !== null; }
  reset(): void { this.seenIds.clear(); }
}
