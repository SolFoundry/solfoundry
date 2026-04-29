/**
 * Tier Detector - Determines bounty tier from issue labels.
 *
 * Tier mapping:
 * - T1 (Tier 1): Simple tasks, documentation, bug fixes
 * - T2 (Tier 2): Medium complexity, integrations, features
 * - T3 (Tier 3): Complex features, full applications, creative work
 *
 * Detection priority:
 * 1. Explicit tier labels (tier-1, tier-2, tier-3, T1, T2, T3)
 * 2. Complexity labels (simple, medium, complex, hard)
 * 3. Default tier from configuration
 */

const TIER_LABELS: Record<string, number> = {
  'tier-1': 1,
  'tier-2': 2,
  'tier-3': 3,
  't1': 1,
  't2': 2,
  't3': 3,
  'tier1': 1,
  'tier2': 2,
  'tier3': 3,
};

const COMPLEXITY_MAP: Record<string, number> = {
  'simple': 1,
  'easy': 1,
  'good-first-issue': 1,
  'medium': 2,
  'moderate': 2,
  'complex': 3,
  'hard': 3,
  'advanced': 3,
};

export class TierDetector {
  /**
   * Detect the bounty tier from issue labels.
   *
   * @param labels - Array of lowercase label strings
   * @param defaultTier - Fallback tier if no labels match
   * @returns Detected tier (1, 2, or 3)
   */
  static detect(labels: string[], defaultTier: number = 2): number {
    const normalizedLabels = labels.map(l => l.toLowerCase());

    // Priority 1: Explicit tier labels
    for (const label of normalizedLabels) {
      if (TIER_LABELS[label] !== undefined) {
        return TIER_LABELS[label];
      }
    }

    // Priority 2: Complexity labels
    for (const label of normalizedLabels) {
      if (COMPLEXITY_MAP[label] !== undefined) {
        return COMPLEXITY_MAP[label];
      }
    }

    // Priority 3: Default tier
    return defaultTier;
  }

  /**
   * Get the reward multiplier for a given tier.
   *
   * @param tier - Bounty tier (1, 2, or 3)
   * @returns Multiplier (T1: 0.2x, T2: 1x, T3: 2x)
   */
  static getRewardMultiplier(tier: number): number {
    const multipliers: Record<number, number> = {
      1: 0.2,
      2: 1.0,
      3: 2.0,
    };
    return multipliers[tier] || 1.0;
  }

  /**
   * Calculate the final reward amount based on tier and base amount.
   *
   * @param baseAmount - Base reward amount
   * @param tier - Detected tier
   * @returns Calculated reward amount
   */
  static calculateReward(baseAmount: number, tier: number): number {
    return Math.round(baseAmount * this.getRewardMultiplier(tier));
  }
}
