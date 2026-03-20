export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type SortField = 'points' | 'bounties' | 'earnings';
export interface Contributor {
  rank: number; username: string; avatarUrl: string; points: number;
  bountiesCompleted: number; earningsFndry: number; earningsSol: number;
  streak: number; topSkills: string[];
}
