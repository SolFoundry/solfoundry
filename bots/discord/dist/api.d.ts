/**
 * SolFoundry API client for the Discord bot.
 */
export interface Bounty {
    id: string;
    title: string;
    description: string;
    reward_amount: number;
    reward_token: string;
    tier: string;
    status: string;
    skills: string[];
    created_at: string;
    deadline: string | null;
    github_repo_url: string | null;
    github_issue_url: string | null;
}
export interface LeaderboardEntry {
    username: string;
    avatar_url: string | null;
    bounties_completed: number;
    total_earned: number;
    rank: number;
}
export declare function fetchLatestBounties(since: string): Promise<Bounty[]>;
export declare function fetchOpenBounties(limit?: number): Promise<Bounty[]>;
export declare function fetchLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
