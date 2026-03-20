export type BountyTier = 'T1' | 'T2' | 'T3';
export type BountyStatus = 'open' | 'in-progress' | 'completed';
export type BountySortBy = 'newest' | 'reward' | 'deadline';
export interface Bounty { id: string; title: string; description: string; tier: BountyTier; skills: string[]; rewardAmount: number; currency: string; deadline: string; status: BountyStatus; submissionCount: number; createdAt: string; projectName: string; }
export interface BountyBoardFilters { tier: BountyTier | 'all'; status: BountyStatus | 'all'; skills: string[]; searchQuery: string; }
export const DEFAULT_FILTERS: BountyBoardFilters = { tier: 'all', status: 'all', skills: [], searchQuery: '' };
export const SKILL_OPTIONS = ['React', 'TypeScript', 'Rust', 'Anchor', 'Solana', 'Node.js'];
export const TIER_OPTIONS: { value: BountyTier | 'all'; label: string }[] = [{ value: 'all', label: 'All Tiers' }, { value: 'T1', label: 'T1' }, { value: 'T2', label: 'T2' }, { value: 'T3', label: 'T3' }];
export const STATUS_OPTIONS: { value: BountyStatus | 'all'; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in-progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }];
export const SORT_OPTIONS: { value: BountySortBy; label: string }[] = [{ value: 'newest', label: 'Newest' }, { value: 'reward', label: 'Reward' }, { value: 'deadline', label: 'Deadline' }];
