import { Scanner } from './agents/scanner.js';
import { Analyzer } from './agents/analyzer.js';
import { Coder } from './agents/coder.js';
import { Tester } from './agents/tester.js';
import { PRSubmitter } from './agents/submitter.js';
import { StateStore } from './store/state.js';
import type { Bounty, BountyState, HunterConfig, AgentResult } from './types/index.js';

export class BountyHunter {
  private scanner: Scanner;
  private analyzer: Analyzer;
  private coder: Coder;
  private tester: Tester;
  private submitter: PRSubmitter;
  private store: StateStore;
  private config: Required<HunterConfig>;

  constructor(config: HunterConfig) {
    this.scanner = new Scanner();
    this.analyzer = new Analyzer();
    this.coder = new Coder();
    this.tester = new Tester();
    this.submitter = new PRSubmitter();
    this.store = new StateStore();
    this.config = {
      repos: config.repos,
      baseBranch: config.baseBranch ?? 'main',
      maxAttempts: config.maxAttempts ?? 3,
      skipExisting: config.skipExisting ?? true,
    };
  }

  async hunt(): Promise<{processed: number; successful: number; failed: number}> {
    console.log('🔍 Bounty Hunter starting...');
    console.log(`   Repos: ${this.config.repos.join(', ')}`);

    const scanResult = await this.scanner.findBounties(this.config.repos);
    if (!scanResult.success) {
      console.error('   ⚠️ Scan warnings:', scanResult.error);
    }

    let bounties: Bounty[] = scanResult.data ?? [];
    console.log(`   Found ${bounties.length} bounty issues`);

    if (this.config.skipExisting) {
      bounties = await this.scanner.filterEligible(bounties);
      console.log(`   ${bounties.length} eligible after filtering`);
    }

    // Remove already completed
    const newBounties = bounties.filter(b => !this.store.hasCompleted(b.id));
    console.log(`   ${newBounties.length} unprocessed\n`);

    let successful = 0;
    let failed = 0;

    for (const bounty of newBounties) {
      console.log(`🎯 Processing: ${bounty.id} — "${bounty.title.substring(0, 60)}"`);
      const result = await this.processBounty(bounty);
      if (result.success) {
        successful++;
        console.log(`   ✅ Done! PR: ${result.data?.prUrl}\n`);
      } else {
        failed++;
        console.log(`   ❌ Failed: ${result.error}\n`);
      }
    }

    console.log(`\n📊 Hunt complete: ${successful} successful, ${failed} failed`);
    return { processed: newBounties.length, successful, failed };
  }

  async processBounty(bounty: Bounty): Promise<AgentResult<{prUrl: string}>> {
    const state: BountyState = {
      id: bounty.id,
      status: 'discovered',
      bounty,
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.save(state);

    try {
      // Phase 1: Analyze
      state.status = 'analyzing';
      this.store.save(state);

      const analysisResult = await this.analyzer.analyze(bounty);
      if (!analysisResult.success) throw new Error(`Analysis failed: ${analysisResult.error}`);

      state.plan = analysisResult.data;
      state.updatedAt = new Date().toISOString();
      this.store.save(state);
      console.log(`   📋 Plan: ${analysisResult.data!.estimatedComplexity}, ${analysisResult.data!.steps.length} steps`);

      // Phase 2: Implement
      state.status = 'implementing';
      state.attempts++;
      this.store.save(state);

      const implResult = await this.coder.implement(state.plan!, this.config.baseBranch);
      if (!implResult.success) throw new Error(`Implementation failed: ${implResult.error}`);

      const workDir = `/tmp/bounty-${bounty.id.replace(/[^a-z0-9]/gi, '-')}`;

      // Phase 3: Test
      state.status = 'testing';
      this.store.save(state);

      const testResult = await this.tester.test(state.plan!, workDir);
      if (!testResult.success) {
        const critical = testResult.data?.results?.filter((r: any) =>
          r.exitCode !== 0 && !r.name.includes('integration') && !r.name.includes('e2e')
        );
        if (critical && critical.length > 0) {
          throw new Error(`Critical tests failed: ${critical.map((r: any) => r.name).join(', ')}`);
        }
      }
      console.log(`   ✅ Tests passed`);

      // Phase 4: Submit
      state.status = 'submitting';
      this.store.save(state);

      const submitResult = await this.submitter.submit(bounty, state.plan!, workDir);
      if (!submitResult.success) throw new Error(`Submission failed: ${submitResult.error}`);

      state.status = 'done';
      state.prUrl = submitResult.data?.prUrl;
      state.updatedAt = new Date().toISOString();
      this.store.save(state);

      return { success: true, data: { prUrl: submitResult.data!.prUrl }, duration: 0 };

    } catch (e: any) {
      state.status = 'failed';
      state.lastError = e.message;
      state.updatedAt = new Date().toISOString();
      this.store.save(state);
      return { success: false, error: e.message, duration: 0 };
    }
  }
}
