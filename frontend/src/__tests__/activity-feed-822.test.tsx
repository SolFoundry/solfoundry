import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../api/activity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/activity')>();
  return {
    ...actual,
    listActivity: vi.fn(),
  };
});

vi.mock('../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiClient')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

import { listActivity } from '../api/activity';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { ActivityEvent } from '../api/activity';

const sampleEvents: ActivityEvent[] = [
  {
    id: '1',
    type: 'completed',
    username: 'devbuilder',
    detail: 'earned 150,000 FNDRY from Bounty #42',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'submitted',
    username: 'KodeSage',
    detail: 'submitted PR to Bounty #38',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

describe('Activity API and ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listActivity', () => {
    it('normalizes array responses into activity events', async () => {
      const mockListActivity = listActivity as ReturnType<typeof vi.fn>;
      mockListActivity.mockResolvedValue(sampleEvents);

      const events = await mockListActivity();
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('1');
      expect(events[0].type).toBe('completed');
      expect(events[0].username).toBe('devbuilder');
    });
  });

  describe('ActivityFeed', () => {
    it('renders real events from the activity API', () => {
      const mockListActivity = listActivity as ReturnType<typeof vi.fn>;
      mockListActivity.mockResolvedValue(sampleEvents);

      render(<ActivityFeed />);
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('devbuilder')).toBeInTheDocument();
      expect(screen.getByText('KodeSage')).toBeInTheDocument();
    });

    it('shows no recent activity when the API returns an empty list', () => {
      const mockListActivity = listActivity as ReturnType<typeof vi.fn>;
      mockListActivity.mockResolvedValue([]);

      render(<ActivityFeed />);
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('shows an unavailable fallback when the activity API fails', () => {
      const mockListActivity = listActivity as ReturnType<typeof vi.fn>;
      mockListActivity.mockRejectedValue(new Error('Network error'));

      render(<ActivityFeed />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
