/**
 * Tests for the escrow service API functions.
 * Validates that each function calls the correct API endpoint
 * with the appropriate method and body parameters.
 *
 * @module services/__tests__/escrowService.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchEscrowAccount,
  recordDeposit,
  recordRelease,
  recordRefund,
  fetchEscrowTransactions,
} from '../escrowService';

/** Mock the apiClient so no real HTTP requests are made. */
const mockApiClient = vi.fn();

vi.mock('../apiClient', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, message: string, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

describe('escrowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.mockResolvedValue({});
  });

  describe('fetchEscrowAccount', () => {
    it('calls GET /api/bounties/:id/escrow', async () => {
      await fetchEscrowAccount('bounty-123');
      expect(mockApiClient).toHaveBeenCalledWith('/api/bounties/bounty-123/escrow');
    });

    it('returns the escrow account data', async () => {
      const mockAccount = { state: 'funded', lockedAmount: 100000 };
      mockApiClient.mockResolvedValue(mockAccount);

      const result = await fetchEscrowAccount('bounty-123');
      expect(result).toEqual(mockAccount);
    });
  });

  describe('recordDeposit', () => {
    it('calls POST /api/bounties/:id/escrow/deposit with correct body', async () => {
      await recordDeposit('bounty-123', 'sig-abc', 350000);

      expect(mockApiClient).toHaveBeenCalledWith(
        '/api/bounties/bounty-123/escrow/deposit',
        {
          method: 'POST',
          body: { signature: 'sig-abc', amount: 350000 },
        },
      );
    });
  });

  describe('recordRelease', () => {
    it('calls POST /api/bounties/:id/escrow/release with correct body', async () => {
      await recordRelease('bounty-123', 'sig-def', 'ContribWallet111');

      expect(mockApiClient).toHaveBeenCalledWith(
        '/api/bounties/bounty-123/escrow/release',
        {
          method: 'POST',
          body: { signature: 'sig-def', contributor_wallet: 'ContribWallet111' },
        },
      );
    });
  });

  describe('recordRefund', () => {
    it('calls POST /api/bounties/:id/escrow/refund with correct body', async () => {
      await recordRefund('bounty-123', 'sig-ghi');

      expect(mockApiClient).toHaveBeenCalledWith(
        '/api/bounties/bounty-123/escrow/refund',
        {
          method: 'POST',
          body: { signature: 'sig-ghi' },
        },
      );
    });
  });

  describe('fetchEscrowTransactions', () => {
    it('calls GET /api/bounties/:id/escrow/transactions', async () => {
      await fetchEscrowTransactions('bounty-123');

      expect(mockApiClient).toHaveBeenCalledWith(
        '/api/bounties/bounty-123/escrow/transactions',
      );
    });

    it('returns the transaction list', async () => {
      const mockTransactions = [
        { id: 'tx-1', type: 'deposit', amountDisplay: 100000 },
      ];
      mockApiClient.mockResolvedValue(mockTransactions);

      const result = await fetchEscrowTransactions('bounty-123');
      expect(result).toEqual(mockTransactions);
    });
  });
});
