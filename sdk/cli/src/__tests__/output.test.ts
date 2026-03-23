import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusBadge, printBountiesTable, printKeyValue, printError, printSuccess, printSection, c } from '../utils/output.js';

describe('output utils', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('statusBadge', () => {
    it('returns a string containing the status', () => {
      expect(statusBadge('open')).toContain('OPEN');
      expect(statusBadge('completed')).toContain('COMPLETED');
      expect(statusBadge('cancelled')).toContain('CANCELLED');
      expect(statusBadge('unknown_status')).toContain('UNKNOWN_STATUS');
    });
  });

  describe('c helpers', () => {
    it('each helper returns a non-empty string', () => {
      expect(c.success('ok')).toBeTruthy();
      expect(c.error('err')).toBeTruthy();
      expect(c.warn('warn')).toBeTruthy();
      expect(c.info('info')).toBeTruthy();
      expect(c.dim('dim')).toBeTruthy();
      expect(c.bold('bold')).toBeTruthy();
      expect(c.header('head')).toBeTruthy();
    });
  });

  describe('printBountiesTable', () => {
    it('prints to stdout without throwing', () => {
      expect(() =>
        printBountiesTable([
          { id: 'abc123', title: 'Fix login', tier: 1, reward: 500, status: 'open', deadline: null },
          { id: 'def456', title: 'Add dark mode', tier: 2, reward: 1000, status: 'in_progress', deadline: '2025-12-31' },
        ]),
      ).not.toThrow();
      expect(console.log).toHaveBeenCalled();
    });

    it('handles empty array', () => {
      expect(() => printBountiesTable([])).not.toThrow();
    });
  });

  describe('printKeyValue', () => {
    it('prints each pair', () => {
      printKeyValue([['Key', 'Value'], ['Another', 'Pair']]);
      expect(console.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('printError', () => {
    it('prints to stderr', () => {
      printError('Something went wrong', 'Try again');
      expect(console.error).toHaveBeenCalled();
    });

    it('works without hint', () => {
      expect(() => printError('error only')).not.toThrow();
    });
  });

  describe('printSuccess', () => {
    it('prints to stdout', () => {
      printSuccess('All good!');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('printSection', () => {
    it('prints a section header', () => {
      printSection('My Section');
      expect(console.log).toHaveBeenCalled();
    });
  });
});
