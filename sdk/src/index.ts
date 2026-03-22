/**
 * @solfoundry/sdk — Official TypeScript SDK for SolFoundry
 *
 * @example
 * ```ts
 * import { SolFoundryClient } from '@solfoundry/sdk';
 *
 * const client = new SolFoundryClient({ apiKey: 'your-api-key' });
 * const bounties = await client.getBounties({ status: 'open' });
 * console.log(bounties.data);
 * ```
 */

export { SolFoundryClient, SolFoundryError } from './client.js';
export type {
  Bounty,
  BountyFilter,
  BountyStatus,
  BountyTier,
  Contributor,
  ContributorFilter,
  PaginatedResponse,
  SolFoundryClientConfig,
  SubmitWorkParams,
  WorkSubmission,
  ApiError,
} from './types.js';
