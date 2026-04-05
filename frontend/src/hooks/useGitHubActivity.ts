import { useState, useEffect } from 'react';
import { githubApi, earningsApi, type GitHubActivity, type ContributorStats, type EarningRecord } from '../api/github';

export function useGitHubActivity(username: string | undefined, days: number = 30) {
  const [data, setData] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    setLoading(true);
    githubApi.getUserActivity(username, days)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [username, days]);

  return { data, loading, error };
}

export function useContributorStats(username: string | undefined) {
  const [data, setData] = useState<ContributorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    setLoading(true);
    githubApi.getContributorStats(username)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [username]);

  return { data, loading, error };
}

export function useEarningsHistory(userId: string | undefined) {
  const [data, setData] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    earningsApi.getEarningsHistory(userId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { data, loading, error };
}