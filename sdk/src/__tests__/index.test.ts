/**
 * Tests for the SolFoundry facade class and barrel exports.
 *
 * Validates that the factory method creates a properly configured
 * instance with all sub-clients accessible, and that the auth
 * token can be updated through the facade.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolFoundry } from '../index.js';
import { BountyClient } from '../bounties.js';
import { EscrowClient } from '../escrow.js';
import { ContributorClient } from '../contributors.js';
import { HttpClient } from '../client.js';

describe('SolFoundry', () => {
  describe('create', () => {
    it('should create an instance with all sub-clients', () => {
      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
      });

      expect(client).toBeDefined();
      expect(client.bounties).toBeInstanceOf(BountyClient);
      expect(client.escrow).toBeInstanceOf(EscrowClient);
      expect(client.contributors).toBeInstanceOf(ContributorClient);
      expect(client.http).toBeInstanceOf(HttpClient);
    });

    it('should pass auth token to the HTTP client', () => {
      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
        authToken: 'my-token',
      });

      expect(client.http.getAuthToken()).toBe('my-token');
    });

    it('should create without auth token', () => {
      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
      });

      expect(client.http.getAuthToken()).toBeUndefined();
    });
  });

  describe('setAuthToken', () => {
    it('should update the token on the underlying HTTP client', () => {
      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
      });

      client.setAuthToken('new-jwt');
      expect(client.http.getAuthToken()).toBe('new-jwt');
    });

    it('should clear the token when set to undefined', () => {
      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
        authToken: 'initial-token',
      });

      client.setAuthToken(undefined);
      expect(client.http.getAuthToken()).toBeUndefined();
    });
  });

  describe('end-to-end request flow', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should make requests through the bounty client', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            items: [],
            total: 0,
            skip: 0,
            limit: 20,
          }),
      });

      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
        maxRetries: 0,
        maxRequestsPerSecond: 100,
      });

      const result = await client.bounties.list();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it('should make requests through the escrow client', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            escrow: {
              id: 'e-1',
              bounty_id: 'b-1',
              creator_wallet: 'wallet',
              winner_wallet: null,
              amount: 500,
              state: 'active',
              fund_tx_hash: 'tx',
              release_tx_hash: null,
              expires_at: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            ledger: [],
          }),
      });

      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
        maxRetries: 0,
        maxRequestsPerSecond: 100,
      });

      const result = await client.escrow.getStatus('b-1');
      expect(result.escrow.state).toBe('active');
    });

    it('should make requests through the contributor client', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total_bounties_created: 10,
            total_bounties_completed: 5,
            total_bounties_open: 3,
            total_contributors: 20,
            total_fndry_paid: 50000,
            total_prs_reviewed: 30,
            bounties_by_tier: {},
            top_contributor: null,
          }),
      });

      const client = SolFoundry.create({
        baseUrl: 'https://api.test.com',
        maxRetries: 0,
        maxRequestsPerSecond: 100,
      });

      const stats = await client.contributors.getStats();
      expect(stats.total_bounties_created).toBe(10);
    });
  });
});

describe('Barrel exports', () => {
  it('should export all error classes', async () => {
    const exports = await import('../index.js');
    expect(exports.SolFoundryError).toBeDefined();
    expect(exports.ValidationError).toBeDefined();
    expect(exports.AuthenticationError).toBeDefined();
    expect(exports.AuthorizationError).toBeDefined();
    expect(exports.NotFoundError).toBeDefined();
    expect(exports.ConflictError).toBeDefined();
    expect(exports.LockError).toBeDefined();
    expect(exports.RateLimitError).toBeDefined();
    expect(exports.UpstreamError).toBeDefined();
    expect(exports.ServerError).toBeDefined();
    expect(exports.NetworkError).toBeDefined();
    expect(exports.RetryExhaustedError).toBeDefined();
  });

  it('should export all client classes', async () => {
    const exports = await import('../index.js');
    expect(exports.HttpClient).toBeDefined();
    expect(exports.BountyClient).toBeDefined();
    expect(exports.EscrowClient).toBeDefined();
    expect(exports.ContributorClient).toBeDefined();
    expect(exports.GitHubClient).toBeDefined();
    expect(exports.EventSubscriber).toBeDefined();
    expect(exports.SolFoundry).toBeDefined();
  });

  it('should export all Solana helpers', async () => {
    const exports = await import('../index.js');
    expect(exports.FNDRY_TOKEN_MINT).toBeDefined();
    expect(exports.TOKEN_PROGRAM_ID).toBeDefined();
    expect(exports.ASSOCIATED_TOKEN_PROGRAM_ID).toBeDefined();
    expect(exports.TREASURY_WALLET).toBeDefined();
    expect(exports.DEFAULT_RPC_ENDPOINT).toBeDefined();
    expect(exports.FNDRY_DECIMALS).toBeDefined();
    expect(exports.findAssociatedTokenAddress).toBeDefined();
    expect(exports.findProgramAddress).toBeDefined();
    expect(exports.findEscrowAddress).toBeDefined();
    expect(exports.findReputationAddress).toBeDefined();
    expect(exports.getSolBalance).toBeDefined();
    expect(exports.getTokenBalance).toBeDefined();
    expect(exports.buildTokenTransferInstruction).toBeDefined();
    expect(exports.buildTokenTransferTransaction).toBeDefined();
    expect(exports.createConnection).toBeDefined();
    expect(exports.isValidSolanaAddress).toBeDefined();
    expect(exports.toRawAmount).toBeDefined();
    expect(exports.toUiAmount).toBeDefined();
  });

  it('should export utility functions', async () => {
    const exports = await import('../index.js');
    expect(exports.buildUrl).toBeDefined();
    expect(exports.calculateBackoff).toBeDefined();
    expect(exports.isRetryable).toBeDefined();
    expect(exports.RateLimiter).toBeDefined();
  });
});
