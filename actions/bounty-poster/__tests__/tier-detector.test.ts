/**
 * Tier Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { TierDetector } from '../src/tier-detector';

describe('TierDetector', () => {
  describe('detect', () => {
    it('should detect tier-1 from explicit label', () => {
      expect(TierDetector.detect(['tier-1', 'bounty'])).toBe(1);
      expect(TierDetector.detect(['T1', 'bug'])).toBe(1);
      expect(TierDetector.detect(['tier1', 'documentation'])).toBe(1);
    });

    it('should detect tier-2 from explicit label', () => {
      expect(TierDetector.detect(['tier-2', 'bounty'])).toBe(2);
      expect(TierDetector.detect(['T2', 'integration'])).toBe(2);
      expect(TierDetector.detect(['tier2', 'feature'])).toBe(2);
    });

    it('should detect tier-3 from explicit label', () => {
      expect(TierDetector.detect(['tier-3', 'bounty'])).toBe(3);
      expect(TierDetector.detect(['T3', 'agent'])).toBe(3);
      expect(TierDetector.detect(['tier3', 'creative'])).toBe(3);
    });

    it('should detect tier from complexity labels', () => {
      expect(TierDetector.detect(['simple', 'bounty'])).toBe(1);
      expect(TierDetector.detect(['easy', 'good-first-issue'])).toBe(1);
      expect(TierDetector.detect(['medium', 'feature'])).toBe(2);
      expect(TierDetector.detect(['complex', 'integration'])).toBe(3);
      expect(TierDetector.detect(['hard', 'agent'])).toBe(3);
    });

    it('should return default tier when no labels match', () => {
      expect(TierDetector.detect(['bug', 'help-wanted'])).toBe(2);
      expect(TierDetector.detect(['enhancement'])).toBe(2);
      expect(TierDetector.detect([])).toBe(2);
    });

    it('should use custom default tier', () => {
      expect(TierDetector.detect(['bug'], 3)).toBe(3);
      expect(TierDetector.detect([], 1)).toBe(1);
    });

    it('should prioritize explicit tier over complexity', () => {
      // tier-2 should override 'simple'
      expect(TierDetector.detect(['tier-2', 'simple'])).toBe(2);
      // tier-3 should override 'medium'
      expect(TierDetector.detect(['tier-3', 'medium'])).toBe(3);
    });

    it('should handle case-insensitive labels', () => {
      expect(TierDetector.detect(['TIER-1', 'BOUNTY'])).toBe(1);
      expect(TierDetector.detect(['Tier-2', 'Bounty'])).toBe(2);
      expect(TierDetector.detect(['T3', 'Agent'])).toBe(3);
    });
  });

  describe('getRewardMultiplier', () => {
    it('should return correct multipliers', () => {
      expect(TierDetector.getRewardMultiplier(1)).toBe(0.2);
      expect(TierDetector.getRewardMultiplier(2)).toBe(1.0);
      expect(TierDetector.getRewardMultiplier(3)).toBe(2.0);
    });

    it('should return 1.0 for unknown tiers', () => {
      expect(TierDetector.getRewardMultiplier(0)).toBe(1.0);
      expect(TierDetector.getRewardMultiplier(4)).toBe(1.0);
    });
  });

  describe('calculateReward', () => {
    it('should calculate correct rewards', () => {
      expect(TierDetector.calculateReward(500000, 1)).toBe(100000);
      expect(TierDetector.calculateReward(500000, 2)).toBe(500000);
      expect(TierDetector.calculateReward(500000, 3)).toBe(1000000);
    });

    it('should handle custom base amounts', () => {
      expect(TierDetector.calculateReward(1000000, 1)).toBe(200000);
      expect(TierDetector.calculateReward(1000000, 2)).toBe(1000000);
      expect(TierDetector.calculateReward(1000000, 3)).toBe(2000000);
    });
  });
});
