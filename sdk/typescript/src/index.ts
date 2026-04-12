/**
 * SolFoundry TypeScript SDK
 *
 * Comprehensive SDK for programmatic bounty management,
 * submission handling, and user authentication on SolFoundry.
 *
 * @example
 * import { SolFoundryClient } from "@solfoundry/sdk";
 *
 * const client = new SolFoundryClient({ apiKey: "your-api-key" });
 * const bounties = await client.listBounties({ status: "open", tier: 2 });
 * console.log(`Found ${bounties.total} open T2 bounties`);
 */

export { SolFoundryClient, SolFoundryError } from "./client/SolFoundryClient.js";
export { BountyService } from "./services/BountyService.js";

// Types
export type {
  SolFoundryClientOptions,
} from "./client/SolFoundryClient.js";

// Re-export all types
export type {
  BountyTier,
  BountyStatus,
  SubmissionRecord,
  SubmissionCreate,
  SubmissionResponse,
  BountyCreate,
  BountyUpdate,
  BountyResponse,
  BountyListResponse,
  ContributorResponse,
  LeaderboardEntry,
  NotificationResponse,
  PayoutResponse,
  AuthToken,
  UserResponse,
  BountyFilters,
} from "./types/index.js";
