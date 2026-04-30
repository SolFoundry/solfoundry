/**
 * BountyHunterAgent — Discovers and analyzes bounties for autonomous pursuit.
 *
 * The planner agent scans the SolFoundry bounty marketplace, evaluates
 * each open bounty against the agent team's skill profile, and produces
 * a ranked list of suitable targets with analysis scores.
 *
 * @module agents/BountyHunterAgent
 */

import type {
  AgentMessage,
  BountyAnalysis,
  AgentEvent,
  AgentOrchestratorConfig,
} from './types.js';
import {
  AgentRole,
  AgentState,
  MessageType,
  AgentEventType,
  TaskType,
} from './types.js';

/** Event handler callback for bounty hunter events. */
export type BountyHunterEventHandler = (event: AgentEvent) => void;

/**
 * Core bounty hunter agent that discovers and analyzes bounties.
 *
 * This agent acts as the "planner" in the multi-agent pipeline.
 * It queries the SolFoundry API for open bounties, scores each one
 * based on skill matching and value-to-effort ratio, and selects
 * the best target for the team to pursue.
 */
export class BountyHunterAgent {
  private state: AgentState = AgentState.IDLE;
  private eventHandlers: BountyHunterEventHandler[] = [];
  private readonly config: AgentOrchestratorConfig;
  private readonly apiBaseUrl: string;
  private readonly authToken?: string;

  /** Currently analyzed bounties. */
  private analyses: BountyAnalysis[] = [];

  /** Currently selected bounty ID. */
  private selectedBountyId: string | null = null;

  /**
   * Create a new BountyHunterAgent.
   *
   * @param config - Orchestrator configuration (extracted for agent use).
   */
  constructor(config: AgentOrchestratorConfig) {
    this.config = config;
    this.apiBaseUrl = config.apiBaseUrl;
    this.authToken = config.authToken;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Get the current agent state. */
  getState(): AgentState {
    return this.state;
  }

  /** Get the role of this agent. */
  getRole(): AgentRole {
    return AgentRole.PLANNER;
  }

  /**
   * Register an event handler for real-time monitoring.
   *
   * @param handler - Callback invoked on each agent event.
   */
  onEvent(handler: BountyHunterEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Remove a previously registered event handler. */
  offEvent(handler: BountyHunterEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
  }

  /** Emit an event to all registered handlers. */
  private emit(type: AgentEventType, message: string, data?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      agent: AgentRole.PLANNER,
      message,
      data,
    };
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Silently ignore handler errors to avoid disrupting the pipeline.
      }
    }
  }

  // -----------------------------------------------------------------------
  // Bounty Discovery
  // -----------------------------------------------------------------------

  /**
   * Discover open bounties from the SolFoundry API.
   *
   * Fetches all open bounties, filters by minimum reward and other
   * criteria, and returns raw bounty data for analysis.
   *
   * @returns Array of raw bounty objects.
   */
  async discoverBounties(): Promise<Record<string, unknown>[]> {
    this.state = AgentState.RUNNING;
    this.emit(AgentEventType.AGENT_STARTED, 'Discovering open bounties');

    try {
      const url = `${this.apiBaseUrl}/api/bounties?status=open&limit=100`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch bounties: HTTP ${response.status}`);
      }

      const data = await response.json();
      const bounties: Record<string, unknown>[] = data.items ?? data;

      this.emit(AgentEventType.BOUNTY_DISCOVERED, `Discovered ${bounties.length} open bounties`, {
        count: bounties.length,
      });

      this.state = AgentState.COMPLETED;
      return bounties;
    } catch (error) {
      this.state = AgentState.FAILED;
      this.emit(AgentEventType.AGENT_ERROR, `Discovery failed: ${(error as Error).message}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Bounty Analysis
  // -----------------------------------------------------------------------

  /**
   * Analyze a single bounty for suitability.
   *
   * Evaluates the bounty against the agent team's skills, estimates
   * difficulty and effort, and computes a value-to-effort ratio.
   *
   * @param bounty - Raw bounty data from the API.
   * @returns Analysis result with scoring and recommendations.
   */
  analyzeBounty(bounty: Record<string, unknown>): BountyAnalysis {
    const id = String(bounty.id ?? '');
    const title = String(bounty.title ?? 'Untitled');
    const description = String(bounty.description ?? '');
    const tier = Number(bounty.tier ?? 1);
    const rewardAmount = Number(bounty.reward_amount ?? 0);
    const category = String(bounty.category ?? '');
    const requiredSkills: string[] = (bounty.required_skills as string[]) ?? [];
    const deadline = bounty.deadline ? String(bounty.deadline) : null;

    // Calculate skill match score
    const agentSkills = this.config.agentSkills.map((s) => s.toLowerCase());
    const bountySkills = requiredSkills.map((s) => s.toLowerCase());
    const matchedSkills = bountySkills.filter((s) => agentSkills.includes(s));
    const skillMatchScore =
      bountySkills.length > 0 ? matchedSkills.length / bountySkills.length : 0.5;

    // Estimate difficulty based on tier and description complexity
    const estimatedDifficulty = this.estimateDifficulty(tier, description);

    // Estimate effort in hours based on tier
    const estimatedEffortHours = this.estimateEffort(tier, description);

    // Calculate value-to-effort ratio
    const valueRatio = estimatedEffortHours > 0 ? rewardAmount / estimatedEffortHours : 0;

    // Extract key requirements
    const requirements = this.extractRequirements(description, requiredSkills);

    // Determine if the bounty should be pursued
    const shouldPursue =
      skillMatchScore >= 0.3 &&
      rewardAmount >= this.config.minRewardAmount &&
      estimatedEffortHours <= this.config.maxEffortHours;

    // Generate recommended approach
    const recommendedApproach = this.generateApproach(title, description, matchedSkills);

    // Confidence based on available information
    const confidence = this.calculateConfidence(description, requiredSkills, deadline);

    const analysis: BountyAnalysis = {
      bountyId: id,
      title,
      skillMatchScore: Math.round(skillMatchScore * 100) / 100,
      estimatedDifficulty,
      estimatedEffortHours,
      rewardAmount,
      valueRatio: Math.round(valueRatio * 100) / 100,
      requirements,
      recommendedApproach,
      shouldPursue,
      confidence: Math.round(confidence * 100) / 100,
    };

    this.analyses.push(analysis);
    return analysis;
  }

  /**
   * Analyze multiple bounties and return ranked results.
   *
   * @param bounties - Array of raw bounty data.
   * @returns Sorted array of analyses (highest value ratio first).
   */
  analyzeBounties(bounties: Record<string, unknown>[]): BountyAnalysis[] {
    this.state = AgentState.RUNNING;
    this.emit(AgentEventType.AGENT_STARTED, `Analyzing ${bounties.length} bounties`, {
      count: bounties.length,
    });

    const analyses = bounties.map((b) => this.analyzeBounty(b));

    // Sort by value ratio descending, then by skill match descending
    analyses.sort((a, b) => {
      if (b.valueRatio !== a.valueRatio) return b.valueRatio - a.valueRatio;
      return b.skillMatchScore - a.skillMatchScore;
    });

    this.state = AgentState.COMPLETED;
    this.emit(AgentEventType.AGENT_COMPLETED, 'Analysis complete', {
      analyzed: analyses.length,
      pursueable: analyses.filter((a) => a.shouldPursue).length,
    });

    return analyses;
  }

  /**
   * Select the best bounty to pursue.
   *
   * Returns the highest-scoring bounty that meets all criteria.
   * If auto-select is disabled, returns the top candidate without
   * marking it as selected.
   *
   * @param analyses - Pre-computed analyses (uses internal if not provided).
   * @returns The selected analysis or null if none qualify.
   */
  selectBounty(analyses?: BountyAnalysis[]): BountyAnalysis | null {
    const candidates = analyses ?? this.analyses;
    const pursueable = candidates.filter((a) => a.shouldPursue);

    if (pursueable.length === 0) {
      this.emit(AgentEventType.AGENT_COMPLETED, 'No suitable bounties found');
      return null;
    }

    // Pick the highest value-to-effort ratio
    const selected = pursueable[0];
    this.selectedBountyId = selected.bountyId;

    this.emit(AgentEventType.BOUNTY_SELECTED, `Selected bounty: ${selected.title}`, {
      bountyId: selected.bountyId,
      valueRatio: selected.valueRatio,
      rewardAmount: selected.rewardAmount,
    });

    return selected;
  }

  /** Get the currently selected bounty ID. */
  getSelectedBountyId(): string | null {
    return this.selectedBountyId;
  }

  /** Get all analyses computed so far. */
  getAnalyses(): BountyAnalysis[] {
    return [...this.analyses];
  }

  // -----------------------------------------------------------------------
  // Task execution (implements the discover + analyze pipeline stage)
  // -----------------------------------------------------------------------

  /**
   * Run the full discovery and analysis pipeline.
   *
   * Discovers open bounties, analyzes them, and selects the best one.
   * Returns a task response message for the orchestrator.
   *
   * @returns Agent message with analysis results.
   */
  async execute(): Promise<AgentMessage> {
    this.state = AgentState.RUNNING;

    try {
      const bounties = await this.discoverBounties();
      const analyses = this.analyzeBounties(bounties);
      const selected = this.selectBounty(analyses);

      this.state = AgentState.COMPLETED;

      return {
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        from: AgentRole.PLANNER,
        to: AgentRole.ORCHESTRATOR,
        type: MessageType.TASK_RESPONSE,
        payload: {
          taskType: TaskType.ANALYZE,
          bountiesDiscovered: bounties.length,
          analyses: analyses.map((a) => ({
            bountyId: a.bountyId,
            title: a.title,
            valueRatio: a.valueRatio,
            skillMatchScore: a.skillMatchScore,
            shouldPursue: a.shouldPursue,
          })),
          selectedBounty: selected
            ? {
                bountyId: selected.bountyId,
                title: selected.title,
                recommendedApproach: selected.recommendedApproach,
                requirements: selected.requirements,
                estimatedDifficulty: selected.estimatedDifficulty,
                estimatedEffortHours: selected.estimatedEffortHours,
              }
            : null,
        },
      };
    } catch (error) {
      this.state = AgentState.FAILED;
      return {
        id: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        from: AgentRole.PLANNER,
        to: AgentRole.ORCHESTRATOR,
        type: MessageType.ERROR,
        payload: { taskType: TaskType.ANALYZE },
        error: (error as Error).message,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Estimate difficulty from tier and description length/complexity. */
  private estimateDifficulty(tier: number, description: string): number {
    // Base difficulty from tier
    let difficulty = tier * 3;

    // Adjust for description complexity (longer = more complex)
    const descLength = description.length;
    if (descLength > 2000) difficulty += 2;
    else if (descLength > 1000) difficulty += 1;

    // Check for complexity indicators
    const complexityKeywords = [
      'architecture', 'refactor', 'migrate', 'optimize', 'scale',
      'security', 'audit', 'performance', 'distributed', 'consensus',
    ];
    const descLower = description.toLowerCase();
    for (const keyword of complexityKeywords) {
      if (descLower.includes(keyword)) {
        difficulty += 1;
        break; // Only count once
      }
    }

    return Math.min(difficulty, 10);
  }

  /** Estimate effort in hours based on tier and description. */
  private estimateEffort(tier: number, description: string): number {
    // Base effort from tier
    const baseEffort: Record<number, number> = { 1: 4, 2: 16, 3: 40 };
    let effort = baseEffort[tier] ?? 16;

    // Adjust for description length
    const descLength = description.length;
    if (descLength > 3000) effort *= 1.5;
    else if (descLength > 1500) effort *= 1.25;

    return Math.round(effort);
  }

  /** Extract key requirements from bounty description. */
  private extractRequirements(description: string, skills: string[]): string[] {
    const requirements: string[] = [];

    // Add required skills as requirements
    for (const skill of skills) {
      requirements.push(`Requires ${skill} expertise`);
    }

    // Look for explicit requirements in the description
    const lines = description.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)) &&
        trimmed.length > 10 &&
        trimmed.length < 200
      ) {
        requirements.push(trimmed.replace(/^[-*\d.]+\s*/, ''));
      }
    }

    // Limit to top 5 requirements
    return requirements.slice(0, 5);
  }

  /** Generate a recommended approach based on bounty details. */
  private generateApproach(
    title: string,
    description: string,
    matchedSkills: string[],
  ): string {
    const approachParts: string[] = [];

    approachParts.push(`1. Review bounty requirements for "${title}"`);
    approachParts.push(`2. Set up development environment with ${matchedSkills.join(', ') || 'appropriate tools'}`);

    // Check for common patterns
    const descLower = description.toLowerCase();
    if (descLower.includes('smart contract') || descLower.includes('anchor') || descLower.includes('solana')) {
      approachParts.push('3. Implement on-chain program changes');
      approachParts.push('4. Write integration tests');
    } else if (descLower.includes('frontend') || descLower.includes('react') || descLower.includes('ui')) {
      approachParts.push('3. Implement UI components');
      approachParts.push('4. Add unit and integration tests');
    } else if (descLower.includes('api') || descLower.includes('backend')) {
      approachParts.push('3. Implement API endpoints');
      approachParts.push('4. Add unit and integration tests');
    } else {
      approachParts.push('3. Implement the solution');
      approachParts.push('4. Write comprehensive tests');
    }

    approachParts.push('5. Submit PR with detailed description');

    return approachParts.join('\n');
  }

  /** Calculate analysis confidence based on available information. */
  private calculateConfidence(
    description: string,
    skills: string[],
    deadline: string | null,
  ): number {
    let confidence = 0.5; // Base confidence

    // More description = higher confidence
    if (description.length > 1000) confidence += 0.2;
    else if (description.length > 500) confidence += 0.1;

    // Having skills listed increases confidence
    if (skills.length > 0) confidence += 0.15;

    // Having a deadline adds clarity
    if (deadline) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /** Generate a unique message ID. */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
