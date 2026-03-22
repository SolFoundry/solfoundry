/**
 * Escrow resource module for the SolFoundry SDK.
 *
 * Provides methods for managing the custodial $FNDRY escrow lifecycle:
 * funding bounties, releasing payments to winners, refunding creators,
 * and querying escrow state with its audit ledger.
 *
 * @module escrow
 */

import type { HttpClient } from './client.js';
import type {
  EscrowFundRequest,
  EscrowRefundRequest,
  EscrowReleaseRequest,
  EscrowResponse,
  EscrowStatusResponse,
} from './types.js';

/**
 * Client for interacting with the SolFoundry escrow API.
 *
 * Wraps all `/api/escrow` endpoints with type-safe methods.
 * The escrow lifecycle is:
 *
 * ```
 * PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED
 *              |                                 |
 *              +-> REFUNDED (timeout/cancel)     +-> (terminal)
 * ```
 *
 * @example
 * ```typescript
 * const escrow = new EscrowClient(httpClient);
 *
 * // Fund a bounty escrow
 * const funded = await escrow.fund({
 *   bounty_id: 'uuid-here',
 *   creator_wallet: 'SoLaNaWaLLeTaDDrEsS...',
 *   amount: 500,
 * });
 *
 * // Check escrow status and audit trail
 * const status = await escrow.getStatus('uuid-here');
 * console.log(status.escrow.state);  // 'active'
 * console.log(status.ledger.length); // 2 entries
 * ```
 */
export class EscrowClient {
  private readonly http: HttpClient;

  /**
   * Create a new EscrowClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Fund a bounty escrow by locking $FNDRY tokens.
   *
   * Transfers tokens from the creator's wallet to the treasury,
   * verifies the transaction on-chain, and creates the escrow.
   * The escrow is automatically activated after successful funding.
   *
   * @param data - Funding request with bounty ID, wallet, amount, and optional expiry.
   * @returns The created escrow in ACTIVE state.
   * @throws {ConflictError} If an escrow already exists for this bounty or double-spend detected.
   * @throws {UpstreamError} If the on-chain transfer fails.
   */
  async fund(data: EscrowFundRequest): Promise<EscrowResponse> {
    return this.http.request<EscrowResponse>({
      path: '/api/escrow/fund',
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Release escrowed $FNDRY to the approved bounty winner.
   *
   * Transfers tokens from the treasury to the winner's wallet and
   * moves the escrow to COMPLETED state. This is a terminal action.
   *
   * @param data - Release request with bounty ID and winner wallet address.
   * @returns The escrow in COMPLETED state with release transaction hash.
   * @throws {NotFoundError} If no escrow exists for the bounty.
   * @throws {ConflictError} If the escrow is not in a releasable state.
   * @throws {UpstreamError} If the on-chain transfer fails.
   */
  async release(data: EscrowReleaseRequest): Promise<EscrowResponse> {
    return this.http.request<EscrowResponse>({
      path: '/api/escrow/release',
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Refund escrowed $FNDRY to the bounty creator.
   *
   * Returns tokens to the creator's wallet on timeout or cancellation
   * and moves the escrow to REFUNDED state. This is a terminal action.
   *
   * @param data - Refund request with the bounty UUID.
   * @returns The escrow in REFUNDED state.
   * @throws {NotFoundError} If no escrow exists for the bounty.
   * @throws {ConflictError} If the escrow is not in a refundable state.
   * @throws {UpstreamError} If the on-chain transfer fails.
   */
  async refund(data: EscrowRefundRequest): Promise<EscrowResponse> {
    return this.http.request<EscrowResponse>({
      path: '/api/escrow/refund',
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Get the current escrow status, balance, and full audit ledger.
   *
   * Returns the escrow metadata along with a chronological log of
   * all financial events (deposits, releases, refunds, state changes).
   *
   * @param bountyId - The UUID of the bounty whose escrow to query.
   * @returns Escrow status with state, balance, and audit trail.
   * @throws {NotFoundError} If no escrow exists for the bounty.
   */
  async getStatus(bountyId: string): Promise<EscrowStatusResponse> {
    return this.http.request<EscrowStatusResponse>({
      path: `/api/escrow/${bountyId}`,
      method: 'GET',
    });
  }
}
