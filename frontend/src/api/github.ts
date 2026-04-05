import { apiClient } from './client';

export interface GitHubActivity {
  date: string;
  commits: number;
  pullRequests: number;
  issues: number;
}

export interface ContributorStats {
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  currentStreak: number;
  longestStreak: number;
}

export interface EarningRecord {
  date: string;
  amount: number;
  token: string;
  bountyId: string;
  bountyTitle: string;
}

const GITHUB_API = 'https://api.github.com';

export const githubApi = {
  async getUserActivity(username: string, days: number = 30): Promise<GitHubActivity[]> {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch events from GitHub API
    const response = await fetch(`${GITHUB_API}/users/${username}/events/public?per_page=100`);
    
    if (!response.ok) {
      // Return mock data if API fails
      return generateMockActivity(days);
    }

    const events = await response.json();
    
    // Aggregate by date
    const activityMap = new Map<string, GitHubActivity>();
    
    // Initialize all dates
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, { date: dateStr, commits: 0, pullRequests: 0, issues: 0 });
    }

    // Count events
    for (const event of events) {
      const date = event.created_at?.split('T')[0];
      if (!date || !activityMap.has(date)) continue;

      const activity = activityMap.get(date)!;
      switch (event.type) {
        case 'PushEvent':
          activity.commits += event.payload?.commits?.length || 1;
          break;
        case 'PullRequestEvent':
          activity.pullRequests++;
          break;
        case 'IssuesEvent':
          activity.issues++;
          break;
      }
    }

    return Array.from(activityMap.values()).reverse();
  },

  async getContributorStats(username: string): Promise<ContributorStats> {
    try {
      const activity = await this.getUserActivity(username, 365);
      
      let totalCommits = 0;
      let totalPullRequests = 0;
      let totalIssues = 0;
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      const reversedActivity = [...activity].reverse();
      
      for (const day of reversedActivity) {
        totalCommits += day.commits;
        totalPullRequests += day.pullRequests;
        totalIssues += day.issues;

        const hasActivity = day.commits > 0 || day.pullRequests > 0 || day.issues > 0;
        
        if (hasActivity) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      // Calculate current streak (from today backwards)
      for (let i = reversedActivity.length - 1; i >= 0; i--) {
        const day = reversedActivity[i];
        const hasActivity = day.commits > 0 || day.pullRequests > 0 || day.issues > 0;
        if (hasActivity) {
          currentStreak++;
        } else {
          break;
        }
      }

      return { totalCommits, totalPullRequests, totalIssues, currentStreak, longestStreak };
    } catch {
      return { totalCommits: 0, totalPullRequests: 0, totalIssues: 0, currentStreak: 0, longestStreak: 0 };
    }
  },
};

export const earningsApi = {
  async getEarningsHistory(userId: string): Promise<EarningRecord[]> {
    // TODO: Replace with real API when backend supports it
    // For now, return mock data based on bounty completions
    return [
      { date: '2024-01-15', amount: 150000, token: 'FNDRY', bountyId: '1', bountyTitle: 'Toast Notification System' },
      { date: '2024-01-20', amount: 100000, token: 'FNDRY', bountyId: '2', bountyTitle: 'Loading Skeleton' },
      { date: '2024-02-01', amount: 150000, token: 'FNDRY', bountyId: '3', bountyTitle: 'Activity Feed API' },
      { date: '2024-02-15', amount: 100000, token: 'FNDRY', bountyId: '4', bountyTitle: 'Countdown Timer' },
    ];
  },

  async getTotalEarnings(userId: string): Promise<{ total: number; token: string }> {
    const history = await this.getEarningsHistory(userId);
    const total = history.reduce((sum, r) => sum + r.amount, 0);
    return { total, token: 'FNDRY' };
  },
};

function generateMockActivity(days: number): GitHubActivity[] {
  const activity: GitHubActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    activity.push({
      date: date.toISOString().split('T')[0],
      commits: Math.floor(Math.random() * 5),
      pullRequests: Math.floor(Math.random() * 2),
      issues: Math.floor(Math.random() * 1),
    });
  }
  return activity;
}