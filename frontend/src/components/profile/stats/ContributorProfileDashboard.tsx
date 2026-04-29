import React from 'react';
import { useContributorStats, ContributorStats } from './useContributorStats';
import { ActivityGraph } from './ActivityGraph';
import { EarningsChart } from './EarningsChart';
import { StatCard } from './StatCard';

export interface ContributorProfileDashboardProps {
  /** GitHub username to display stats for */
  username: string;
  /** Auto-refresh interval in ms (default: 5 minutes) */
  refreshInterval?: number;
  /** Custom className */
  className?: string;
}

export function ContributorProfileDashboard({
  username,
  refreshInterval = 300000,
  className = '',
}: ContributorProfileDashboardProps) {
  const { data, loading, error, refresh } = useContributorStats(
    username,
    refreshInterval
  );

  if (error && !data) {
    return (
      <div className={`profile-dashboard profile-dashboard--error ${className}`}>
        <div className="profile-dashboard__error">
          <span className="profile-dashboard__error-icon">⚠️</span>
          <span className="profile-dashboard__error-text">
            Failed to load profile data for @{username}
          </span>
          <button className="profile-dashboard__retry" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`profile-dashboard ${className}`}>
      <style>{dashboardStyles}</style>

      {/* Profile Header */}
      <div className="profile-dashboard__header">
        {loading && !data ? (
          <div className="profile-dashboard__skeleton-header">
            <div className="profile-dashboard__skeleton-avatar" />
            <div className="profile-dashboard__skeleton-info">
              <div className="profile-dashboard__skeleton-name" />
              <div className="profile-dashboard__skeleton-rank" />
            </div>
          </div>
        ) : data ? (
          <>
            <img
              src={data.avatarUrl}
              alt={data.username}
              className="profile-dashboard__avatar"
            />
            <div className="profile-dashboard__info">
              <h2 className="profile-dashboard__name">{data.username}</h2>
              <span className="profile-dashboard__rank">
                Rank #{data.rank} of {data.totalContributors}
              </span>
            </div>
            <button
              className="profile-dashboard__refresh"
              onClick={refresh}
              aria-label="Refresh stats"
            >
              🔄
            </button>
          </>
        ) : null}
      </div>

      {/* Key Stats */}
      <div className="profile-dashboard__stats">
        {loading && !data ? (
          <>
            <StatCard label="Total Earned" value="..." />
            <StatCard label="Bounties" value="..." />
            <StatCard label="Streak" value="..." />
          </>
        ) : data ? (
          <>
            <StatCard
              label="Total Earned"
              value={`${formatCompact(data.totalEarned)} FNDRY`}
              icon="💰"
              trend="up"
              trendValue="+12%"
            />
            <StatCard
              label="Bounties Completed"
              value={data.bountiesCompleted}
              icon="🏆"
            />
            <StatCard
              label="Contribution Streak"
              value={`${data.contributionStreak} days`}
              icon="🔥"
              trend={data.contributionStreak > 7 ? 'up' : 'neutral'}
              trendValue={
                data.contributionStreak > 7 ? 'Hot streak!' : 'Keep going!'
              }
            />
          </>
        ) : null}
      </div>

      {/* GitHub Activity */}
      <div className="profile-dashboard__section">
        <h3 className="profile-dashboard__section-title">GitHub Activity</h3>
        <div className="profile-dashboard__github-stats">
          {loading && !data ? (
            <>
              <StatCard label="Commits" value="..." />
              <StatCard label="PRs" value="..." />
              <StatCard label="Issues" value="..." />
              <StatCard label="Reviews" value="..." />
            </>
          ) : data ? (
            <>
              <StatCard
                label="Commits"
                value={data.githubStats.commits}
                icon="📝"
              />
              <StatCard
                label="Pull Requests"
                value={data.githubStats.pullRequests}
                icon="🔀"
              />
              <StatCard
                label="Issues"
                value={data.githubStats.issues}
                icon="🐛"
              />
              <StatCard
                label="Reviews"
                value={data.githubStats.reviews}
                icon="👀"
              />
            </>
          ) : null}
        </div>
        {!loading && data && (
          <div className="profile-dashboard__activity">
            <ActivityGraph data={data.activityData} />
          </div>
        )}
      </div>

      {/* Earnings History */}
      <div className="profile-dashboard__section">
        <h3 className="profile-dashboard__section-title">Earnings History</h3>
        {!loading && data && (
          <EarningsChart data={data.earningsHistory} />
        )}
        {!loading && data && data.earningsHistory.length > 0 && (
          <div className="profile-dashboard__earnings-list">
            {data.earningsHistory.slice(0, 5).map((earning, index) => (
              <div key={index} className="profile-dashboard__earning-item">
                <div className="profile-dashboard__earning-info">
                  <span className="profile-dashboard__earning-title">
                    {earning.bountyTitle}
                  </span>
                  <span className="profile-dashboard__earning-date">
                    {earning.date}
                  </span>
                </div>
                <span className="profile-dashboard__earning-amount">
                  +{formatCompact(earning.amount)} FNDRY
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toFixed(0);
}

/* ─── Styles ─── */

const dashboardStyles = `
.profile-dashboard {
  background: #0f0f23;
  border-radius: 16px;
  padding: 24px;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 700px;
  border: 1px solid #2d2d44;
}

.profile-dashboard__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.profile-dashboard__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid #fbbf24;
}

.profile-dashboard__info {
  flex: 1;
}

.profile-dashboard__name {
  margin: 0;
  font-size: 22px;
  color: #f8fafc;
}

.profile-dashboard__rank {
  font-size: 13px;
  color: #fbbf24;
  font-weight: 500;
}

.profile-dashboard__refresh {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.profile-dashboard__refresh:hover {
  opacity: 1;
}

.profile-dashboard__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.profile-dashboard__github-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.profile-dashboard__section {
  margin-bottom: 24px;
}

.profile-dashboard__section-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d2d44;
}

.profile-dashboard__activity {
  margin-top: 12px;
}

.profile-dashboard__earnings-list {
  margin-top: 12px;
}

.profile-dashboard__earning-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: #1a1a2e;
  margin-bottom: 6px;
}

.profile-dashboard__earning-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-dashboard__earning-title {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
}

.profile-dashboard__earning-date {
  font-size: 11px;
  color: #6b7280;
}

.profile-dashboard__earning-amount {
  font-size: 14px;
  font-weight: 600;
  color: #fbbf24;
}

.profile-dashboard__error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 10px;
}

.profile-dashboard__error-text {
  font-size: 14px;
  color: #ef4444;
}

.profile-dashboard__retry {
  margin-left: auto;
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.profile-dashboard__skeleton-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-dashboard__skeleton-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(90deg, #2d2d44 25%, #3d3d54 50%, #2d2d44 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.profile-dashboard__skeleton-info {
  flex: 1;
}

.profile-dashboard__skeleton-name {
  width: 120px;
  height: 22px;
  background: linear-gradient(90deg, #2d2d44 25%, #3d3d54 50%, #2d2d44 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 8px;
}

.profile-dashboard__skeleton-rank {
  width: 80px;
  height: 14px;
  background: linear-gradient(90deg, #2d2d44 25%, #3d3d54 50%, #2d2d44 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Responsive */
@media (max-width: 600px) {
  .profile-dashboard {
    padding: 16px;
  }

  .profile-dashboard__stats {
    grid-template-columns: 1fr;
  }

  .profile-dashboard__github-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;
