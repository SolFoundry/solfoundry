/**
 * WebSocket Activity Feed - Tests
 * SolFoundry Bounty Platform - T3 Bounty #860
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityBroadcaster } from '../lib/activity-broadcaster';
import { ActivityType } from '../lib/websocket-types';

describe('ActivityBroadcaster', () => {
  let broadcaster: ActivityBroadcaster;

  beforeEach(() => {
    broadcaster = new ActivityBroadcaster(10);
  });

  it('should add and retrieve activities', () => {
    const activity = {
      id: '1',
      type: ActivityType.BOUNTY_POSTED,
      title: 'Test Bounty',
      description: 'Test description',
      actor: 'test-user',
      timestamp: new Date(),
    };

    broadcaster.addActivity(activity);
    const recent = broadcaster.getRecentActivities(10);

    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('1');
  });

  it('should filter activities by type', () => {
    broadcaster.addActivity({
      id: '1',
      type: ActivityType.BOUNTY_POSTED,
      title: 'Posted',
      description: '',
      actor: 'user1',
      timestamp: new Date(),
    });
    broadcaster.addActivity({
      id: '2',
      type: ActivityType.BOUNTY_SUBMITTED,
      title: 'Submitted',
      description: '',
      actor: 'user2',
      timestamp: new Date(),
    });

    const posted = broadcaster.getActivitiesByType('bounty_posted');
    expect(posted).toHaveLength(1);
    expect(posted[0].type).toBe(ActivityType.BOUNTY_POSTED);
  });

  it('should respect max size limit', () => {
    for (let i = 0; i < 15; i++) {
      broadcaster.addActivity({
        id: String(i),
        type: ActivityType.BOUNTY_POSTED,
        title: `Bounty ${i}`,
        description: '',
        actor: 'user',
        timestamp: new Date(),
      });
    }

    expect(broadcaster.size).toBe(10);
    const recent = broadcaster.getRecentActivities(10);
    expect(recent[0].id).toBe('5');
  });

  it('should filter by since date', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);

    broadcaster.addActivity({
      id: '1',
      type: ActivityType.BOUNTY_POSTED,
      title: 'Old',
      description: '',
      actor: 'user',
      timestamp: past,
    });
    broadcaster.addActivity({
      id: '2',
      type: ActivityType.BOUNTY_POSTED,
      title: 'New',
      description: '',
      actor: 'user',
      timestamp: now,
    });

    const recent = broadcaster.getRecentActivities(10, new Date(now.getTime() - 30_000));
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('2');
  });

  it('should clear all activities', () => {
    broadcaster.addActivity({
      id: '1',
      type: ActivityType.BOUNTY_POSTED,
      title: 'Test',
      description: '',
      actor: 'user',
      timestamp: new Date(),
    });
    expect(broadcaster.size).toBe(1);
    broadcaster.clear();
    expect(broadcaster.size).toBe(0);
  });
});

describe('ActivityType enum', () => {
  it('should have all expected activity types', () => {
    expect(ActivityType.BOUNTY_POSTED).toBe('bounty_posted');
    expect(ActivityType.BOUNTY_SUBMITTED).toBe('bounty_submitted');
    expect(ActivityType.BOUNTY_REVIEWED).toBe('bounty_reviewed');
    expect(ActivityType.BOUNTY_COMPLETED).toBe('bounty_completed');
    expect(ActivityType.LEADERBOARD_CHANGE).toBe('leaderboard_change');
  });
});
