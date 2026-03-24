/**
 * @module bounty-registry-sdk
 *
 * TypeScript SDK for reading and writing to the SolFoundry on-chain
 * bounty registry. Provides typed wrappers around the Anchor program
 * IDL for creating, querying, and managing bounty records.
 *
 * @example
 * ```typescript
 * import { BountyRegistryClient, BountyStatus } from "./sdk/src";
 *
 * const client = new BountyRegistryClient(provider);
 * const record = await client.fetchBounty(42);
 * console.log(record.title, BountyStatus[record.status]);
 * ```
 */

export { BountyRegistryClient } from "./client";
export { BountyStatus, deriveBountyPda, PROGRAM_ID } from "./types";
export type { BountyRecordData, BountyFilter } from "./types";
