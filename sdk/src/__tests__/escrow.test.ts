/**
 * Tests for the EscrowClient resource module.
 *
 * Verifies that each escrow lifecycle method constructs the correct
 * HTTP request and properly delegates to the HttpClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EscrowClient } from '../escrow.js';
import type { HttpClient } from '../client.js';
import type { EscrowResponse, EscrowStatusResponse } from '../types.js';
import { EscrowState, LedgerAction } from '../types.js';

/** Create a mock HttpClient. */
function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

/** Create a minimal escrow response fixture. */
function createEscrowFixture(overrides?: Partial<EscrowResponse>): EscrowResponse {
  return {
    id: 'escrow-1',
    bounty_id: 'bounty-1',
    creator_wallet: 'CreatorWallet1234567890abcdefghij',
    winner_wallet: null,
    amount: 500,
    state: EscrowState.ACTIVE,
    fund_tx_hash: 'tx-hash-fund',
    release_tx_hash: null,
    expires_at: null,
    created_at: '2026-03-22T00:00:00Z',
    updated_at: '2026-03-22T00:00:00Z',
    ...overrides,
  };
}

describe('EscrowClient', () => {
  let http: HttpClient;
  let client: EscrowClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new EscrowClient(http);
  });

  describe('fund', () => {
    it('should call POST /api/escrow/fund with body and requiresAuth', async () => {
      const fixture = createEscrowFixture({ state: EscrowState.ACTIVE });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.fund({
        bounty_id: 'bounty-1',
        creator_wallet: 'CreatorWallet1234567890abcdefghij',
        amount: 500,
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/escrow/fund',
        method: 'POST',
        body: {
          bounty_id: 'bounty-1',
          creator_wallet: 'CreatorWallet1234567890abcdefghij',
          amount: 500,
        },
        requiresAuth: true,
      });
      expect(result.state).toBe(EscrowState.ACTIVE);
    });

    it('should pass optional expires_at', async () => {
      const fixture = createEscrowFixture({ expires_at: '2026-04-22T00:00:00Z' });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      await client.fund({
        bounty_id: 'bounty-1',
        creator_wallet: 'CreatorWallet1234567890abcdefghij',
        amount: 500,
        expires_at: '2026-04-22T00:00:00Z',
      });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.body.expires_at).toBe('2026-04-22T00:00:00Z');
    });
  });

  describe('release', () => {
    it('should call POST /api/escrow/release with body and requiresAuth', async () => {
      const fixture = createEscrowFixture({
        state: EscrowState.COMPLETED,
        winner_wallet: 'WinnerWallet1234567890abcdefghijk',
        release_tx_hash: 'tx-hash-release',
      });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.release({
        bounty_id: 'bounty-1',
        winner_wallet: 'WinnerWallet1234567890abcdefghijk',
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/escrow/release',
        method: 'POST',
        body: {
          bounty_id: 'bounty-1',
          winner_wallet: 'WinnerWallet1234567890abcdefghijk',
        },
        requiresAuth: true,
      });
      expect(result.state).toBe(EscrowState.COMPLETED);
      expect(result.release_tx_hash).toBe('tx-hash-release');
    });
  });

  describe('refund', () => {
    it('should call POST /api/escrow/refund with body and requiresAuth', async () => {
      const fixture = createEscrowFixture({ state: EscrowState.REFUNDED });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.refund({ bounty_id: 'bounty-1' });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/escrow/refund',
        method: 'POST',
        body: { bounty_id: 'bounty-1' },
        requiresAuth: true,
      });
      expect(result.state).toBe(EscrowState.REFUNDED);
    });
  });

  describe('getStatus', () => {
    it('should call GET /api/escrow/{bountyId}', async () => {
      const statusFixture: EscrowStatusResponse = {
        escrow: createEscrowFixture(),
        ledger: [
          {
            id: 'ledger-1',
            escrow_id: 'escrow-1',
            action: LedgerAction.DEPOSIT,
            from_state: 'pending',
            to_state: 'funded',
            amount: 500,
            wallet: 'CreatorWallet1234567890abcdefghij',
            tx_hash: 'tx-hash-fund',
            note: null,
            created_at: '2026-03-22T00:00:00Z',
          },
          {
            id: 'ledger-2',
            escrow_id: 'escrow-1',
            action: LedgerAction.STATE_CHANGE,
            from_state: 'funded',
            to_state: 'active',
            amount: 0,
            wallet: 'CreatorWallet1234567890abcdefghij',
            tx_hash: null,
            note: 'Auto-activated after funding',
            created_at: '2026-03-22T00:00:01Z',
          },
        ],
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(statusFixture);

      const result = await client.getStatus('bounty-1');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/escrow/bounty-1',
        method: 'GET',
      });
      expect(result.escrow.state).toBe(EscrowState.ACTIVE);
      expect(result.ledger).toHaveLength(2);
      expect(result.ledger[0].action).toBe(LedgerAction.DEPOSIT);
    });
  });
});
