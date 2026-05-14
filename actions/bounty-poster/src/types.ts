/**
 * Internal types for the bounty-poster GitHub Action.
 */

export interface IssueEvent {
  rewardAmount?: string;
  tier?: string;
  skills?: string;
  deadlineDays?: string;
}
