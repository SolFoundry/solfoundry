/**
 * Reputation domain types shared by hook and components.
 * @module types/reputation
 */

export type Tier = 'T1' | 'T2' | 'T3';

/** A single reputation event (bounty completion, review score, etc). */
export interface ReputationEvent {
  id: string;
  date: string;     // ISO date string "2024-03-15"
  delta: number;    // signed point change, e.g. +50 or -10
  reason: string;   // human-readable, e.g. "Completed T2 bounty: Fix pagination bug"
  tier: Tier;
  bountyId?: string;
}

/** Score at a point in time (for the history chart). */
export interface ReputationSnapshot {
  date: string;   // ISO date string
  score: number;
}

/** Breakdown of how the score is composed. */
export interface ReputationBreakdown {
  t1Completions: number;
  t2Completions: number;
  t3Completions: number;
  avgReviewScore: number; // 0–5
  reviewCount: number;
  streak: number;         // active day streak
}

/** Full reputation profile for a contributor. */
export interface ReputationData {
  score: number;
  rank: number;
  totalContributors: number;
  tier: Tier;
  breakdown: ReputationBreakdown;
  history: ReputationSnapshot[];  // oldest → newest
  events: ReputationEvent[];      // newest → oldest
}
