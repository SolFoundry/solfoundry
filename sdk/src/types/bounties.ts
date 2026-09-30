import type { JsonObject, PaginatedResponse, ResourceId, SortOrder, Timestamps } from "./common.js";

/**
 * Lifecycle states for a bounty.
 */
export type BountyStatus = "draft" | "open" | "in_review" | "awarded" | "closed" | "archived";

/**
 * Difficulty levels used to classify bounties.
 */
export type BountyDifficulty = "beginner" | "intermediate" | "advanced" | "expert";

/**
 * Bounty payout details.
 */
export interface BountyReward {
  /**
   * Token or fiat currency symbol.
   */
  currency: string;
  /**
   * Reward amount as a decimal string to preserve precision.
   */
  amount: string;
}

/**
 * SolFoundry bounty resource.
 */
export interface Bounty extends Timestamps {
  /**
   * Unique bounty identifier.
   */
  id: ResourceId;
  /**
   * Public title shown to participants.
   */
  title: string;
  /**
   * Long-form bounty description.
   */
  description: string;
  /**
   * Bounty status.
   */
  status: BountyStatus;
  /**
   * Difficulty label.
   */
  difficulty?: BountyDifficulty;
  /**
   * Reward configuration.
   */
  reward: BountyReward;
  /**
   * Optional tags for search and categorization.
   */
  tags: string[];
  /**
   * ISO-8601 deadline timestamp.
   */
  deadline?: string;
  /**
   * User id of the bounty owner.
   */
  ownerId: ResourceId;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
}

/**
 * Payload for bounty creation.
 */
export interface CreateBountyInput {
  /**
   * Public title shown to participants.
   */
  title: string;
  /**
   * Long-form bounty description.
   */
  description: string;
  /**
   * Reward configuration.
   */
  reward: BountyReward;
  /**
   * Optional draft/open status at creation time.
   */
  status?: Extract<BountyStatus, "draft" | "open">;
  /**
   * Difficulty label.
   */
  difficulty?: BountyDifficulty;
  /**
   * Optional tags for search and categorization.
   */
  tags?: string[];
  /**
   * ISO-8601 deadline timestamp.
   */
  deadline?: string;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
}

/**
 * Payload for partial bounty updates.
 */
export interface UpdateBountyInput {
  /**
   * Updated title.
   */
  title?: string;
  /**
   * Updated description.
   */
  description?: string;
  /**
   * Updated reward configuration.
   */
  reward?: BountyReward;
  /**
   * Updated bounty status.
   */
  status?: BountyStatus;
  /**
   * Updated difficulty label.
   */
  difficulty?: BountyDifficulty;
  /**
   * Updated tags.
   */
  tags?: string[];
  /**
   * Updated deadline.
   */
  deadline?: string | null;
  /**
   * Updated custom metadata.
   */
  metadata?: JsonObject;
}

/**
 * Query options for listing bounties.
 */
export interface ListBountiesParams {
  /**
   * Pagination cursor.
   */
  cursor?: string;
  /**
   * Page size.
   */
  limit?: number;
  /**
   * Filter by status.
   */
  status?: BountyStatus;
  /**
   * Filter by owner.
   */
  ownerId?: ResourceId;
  /**
   * Filter by tag.
   */
  tag?: string;
  /**
   * Free-text search query.
   */
  search?: string;
  /**
   * Sort order for creation time.
   */
  sort?: SortOrder;
}

/**
 * Paginated bounty list.
 */
export type BountyListResponse = PaginatedResponse<Bounty>;
