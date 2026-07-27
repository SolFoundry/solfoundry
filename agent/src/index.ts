/**
 * Entry point — {@link runAgent} is the single command that discovers T1
 * bounties, classifies them against the agent's capabilities, implements the
 * best match, and (when configured) opens a PR + registers the submission.
 *
 * @module @solfoundry/auto-submit-agent
 */

import type { AgentConfig } from './config.js';
import type { LLMProvider } from './llm.js';
import type { ClassifiedBounty } from './classifier.js';
import type { ImplementationPlan, ChatMessage } from './prompts.js';

// Re-export public surface
export {
  loadAgentConfig,
  validateConfig,
  type AgentConfig,
} from './config.js';
export {
  classifyBounties,
  DEFAULT_CAPABILITIES,
  type ClassifiedBounty,
} from './classifier.js';
export { createProvider, type LLMProvider, type ChatMessage } from './llm.js';
export { planBounty, buildFileMessages, type ImplementationPlan } from './prompts.js';
export {
  fetchBounties,
  discoverT1Bounties,
  type RawBounty,
} from './discoverer.js';
export { runBounty, openPullRequest, registerSubmission } from './executor.js';

/** Log helper (no deps). */
function log(level: string, msg: string) {
  console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} ${msg}`);
}

/** A single result emitted by one run cycle. */
export interface AgentRunResult {
  /** How many bounties were discovered. */
  discovered: number;
  /** How many were feasible per the classifier. */
  feasible: number;
  /** The single best bounty the agent worked on (if any). */
  worked: {
    bountyId: string;
    title: string;
    filesGenerated: number;
    prUrl?: string;
    error?: string;
  } | null;
  /** Dry-run mode. */
  dryRun: boolean;
}

/**
 * Main agent loop:
 * 1. Discover open T1 bounties from the SolFoundry API.
 * 2. Classify them against the agent's capabilities.
 * 3. Pick the best-match bounty.
 * 4. Have the LLM plan + implement it into the local workspace.
 * 5. Optionally push a branch + open a PR (wallet address appended to title).
 * 6. Optionally register the PR as a submission on SolFoundry.
 */
export async function runAgent(
  cfg: AgentConfig,
  provider: LLMProvider,
  workspace: string,
): Promise<AgentRunResult> {
  log('info', `Agent run starting — backend: ${provider.name}, dryRun: ${cfg.dryRun}`);

  // 1. Discover
  const raw = await import('./discoverer.js').then((m) => m.discoverT1Bounties(cfg));
  const discovered = raw.length;
  log('info', `Discovered ${discovered} open T1 bounties`);
  if (discovered === 0) return { discovered: 0, feasible: 0, worked: null, dryRun: cfg.dryRun };

  // 2. Classify
  const classify = await import('./classifier.js').then((m) => m.classifyBounties);
  const feasible = classify(raw).filter((b) => b.feasibilityScore > 0);
  log('info', `Classified ${feasible.length} feasible bounties`);
  if (feasible.length === 0) {
    log('info', 'No bounties matched the agent capabilities — skipping.');
    return { discovered, feasible: 0, worked: null, dryRun: cfg.dryRun };
  }

  const best = feasible[0]!;
  log('info', `Selected best bounty: ${best.title} (${best.id}) score=${best.feasibilityScore}`);

  if (cfg.dryRun) {
    log('info', 'DRY RUN — stopping after discovery + classification.');
    return { discovered, feasible: feasible.length, worked: null, dryRun: true };
  }

  // 3. Plan
  const plan = await import('./prompts.js').then((m) => m.planBounty(best, provider, cfg.payoutWallet));
  log('info', `LLM plan for "${best.title}": ${plan.steps.length} steps, ${plan.files.length} files`);

  // 4. Implement (LLM generates each planned file into the workspace)
  const impl = await import('./executor.js').then((m) =>
    m.runBounty(best, plan, provider, cfg, workspace),
  );
  const filesGenerated = plan.files.length;
  log('info', `Implementation result: ${impl.status}`);

  // 5. Open PR (if configured and implementation succeeded)
  const worked = {
    bountyId: best.id,
    title: best.title,
    filesGenerated,
  };

  if (impl.status === 'implemented' && cfg.submitPrs && cfg.githubToken && impl.branch) {
    try {
      const prUrl = await import('./executor.js').then((m) =>
        m.openPullRequest(cfg, plan, impl.branch!, cfg.payoutWallet),
      );
      worked.prUrl = prUrl;
      log('info', `PR opened: ${prUrl}`);
      // 6. Register submission on SolFoundry
      try {
        await import('./executor.js').then((m) =>
          m.registerSubmission(best.id, prUrl, cfg),
        );
        log('info', `Submission registered for bounty ${best.id}`);
      } catch (regErr) {
        log('warn', `Submission registration failed: ${regErr}`);
      }
    } catch (err) {
      worked.error = String(err);
      log('error', `PR step failed: ${err}`);
    }
  } else if (!cfg.submitPrs) {
    log('info', 'SUBMIT_PRS=false — files written to workspace only, no PR opened.');
  }

  return { discovered, feasible: feasible.length, worked, dryRun: cfg.dryRun };
}
