/**
 * Label Matcher Tests
 */

import { describe, it, expect } from 'vitest';
import { LabelMatcher } from '../src/label-matcher';

describe('LabelMatcher', () => {
  describe('match', () => {
    it('should match exact labels (case-insensitive)', () => {
      expect(LabelMatcher.match(['bounty'], ['bounty', 'help-wanted'])).toEqual(['bounty']);
      expect(LabelMatcher.match(['BOUNTY'], ['bounty'])).toEqual(['bounty']);
      expect(LabelMatcher.match(['bounty'], ['BOUNTY', 'bug'])).toEqual(['bounty']);
    });

    it('should match multiple trigger labels', () => {
      const result = LabelMatcher.match(
        ['bounty', 'solfoundry'],
        ['bounty', 'solfoundry', 'tier-2']
      );
      expect(result).toContain('bounty');
      expect(result).toContain('solfoundry');
    });

    it('should match prefix labels', () => {
      expect(LabelMatcher.match(['bounty'], ['bounty-rust', 'help-wanted'])).toEqual(['bounty-rust']);
      expect(LabelMatcher.match(['bounty'], ['bounty-llm', 'tier-2'])).toEqual(['bounty-llm']);
      expect(LabelMatcher.match(['bounty'], ['bounty-frontend', 'T3'])).toEqual(['bounty-frontend']);
    });

    it('should match wildcard patterns', () => {
      expect(LabelMatcher.match(['bounty-*'], ['bounty-rust', 'help-wanted'])).toEqual(['bounty-rust']);
      expect(LabelMatcher.match(['*-integration'], ['discord-integration', 'bounty'])).toEqual(['discord-integration']);
      expect(LabelMatcher.match(['tier-*'], ['tier-2', 'bounty'])).toEqual(['tier-2']);
    });

    it('should return empty array when no match', () => {
      expect(LabelMatcher.match(['bounty'], ['bug', 'help-wanted'])).toEqual([]);
      expect(LabelMatcher.match(['solfoundry'], ['bug', 'enhancement'])).toEqual([]);
    });

    it('should handle empty inputs', () => {
      expect(LabelMatcher.match([], ['bounty'])).toEqual([]);
      expect(LabelMatcher.match(['bounty'], [])).toEqual([]);
      expect(LabelMatcher.match([], [])).toEqual([]);
    });

    it('should skip empty trigger labels', () => {
      expect(LabelMatcher.match(['', 'bounty', '  '], ['bounty'])).toEqual(['bounty']);
    });

    it('should not duplicate matched labels', () => {
      const result = LabelMatcher.match(
        ['bounty', 'bounty-*'],
        ['bounty-rust']
      );
      expect(result).toHaveLength(1);
      expect(result).toContain('bounty-rust');
    });
  });

  describe('hasMatch', () => {
    it('should return true when any label matches', () => {
      expect(LabelMatcher.hasMatch(['bounty'], ['bounty', 'help-wanted'])).toBe(true);
      expect(LabelMatcher.hasMatch(['bounty'], ['bounty-rust'])).toBe(true);
    });

    it('should return false when no label matches', () => {
      expect(LabelMatcher.hasMatch(['bounty'], ['bug', 'help-wanted'])).toBe(false);
      expect(LabelMatcher.hasMatch([], ['bounty'])).toBe(false);
    });
  });

  describe('extractBountyLabels', () => {
    it('should extract bounty-related labels', () => {
      const labels = ['bounty', 'bounty-rust', 'tier-2', 'help-wanted', 'bounty-llm'];
      const result = LabelMatcher.extractBountyLabels(labels);
      expect(result).toEqual(['bounty', 'bounty-rust', 'bounty-llm']);
    });

    it('should return empty array when no bounty labels', () => {
      const labels = ['bug', 'help-wanted', 'enhancement'];
      const result = LabelMatcher.extractBountyLabels(labels);
      expect(result).toEqual([]);
    });

    it('should handle empty input', () => {
      expect(LabelMatcher.extractBountyLabels([])).toEqual([]);
    });
  });
});
