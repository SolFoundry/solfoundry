/**
 * Tests for the button builder utilities.
 *
 * Validates button creation, action row composition,
 * and custom ID parsing for bounty interactions.
 */

import { describe, it, expect } from 'vitest';
import {
  createBountyButtons,
  createStatusUpdateButtons,
  parseButtonCustomId,
  type BountyButtonConfig,
} from '../utils/buttons.js';

// ---------------------------------------------------------------------------
// Bounty Button Tests
// ---------------------------------------------------------------------------

describe('createBountyButtons', () => {
  const baseConfig: BountyButtonConfig = {
    bountyId: 'bounty-123',
    githubIssueUrl: 'https://github.com/SolFoundry/solfoundry/issues/42',
    isClaimable: true,
  };

  it('should create an action row with buttons', () => {
    const row = createBountyButtons(baseConfig);
    expect(row.components.length).toBeGreaterThan(0);
  });

  it('should include View Details link button', () => {
    const row = createBountyButtons(baseConfig);
    const viewButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🔗 View Details',
    );
    expect(viewButton).toBeDefined();
  });

  it('should include Claim button for claimable bounties', () => {
    const row = createBountyButtons(baseConfig);
    const claimButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🎯 Claim',
    );
    expect(claimButton).toBeDefined();
  });

  it('should NOT include Claim button for non-claimable bounties', () => {
    const nonClaimableConfig = { ...baseConfig, isClaimable: false };
    const row = createBountyButtons(nonClaimableConfig);
    const claimButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🎯 Claim',
    );
    expect(claimButton).toBeUndefined();
  });

  it('should include Subscribe button', () => {
    const row = createBountyButtons(baseConfig);
    const subscribeButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🔔 Subscribe',
    );
    expect(subscribeButton).toBeDefined();
  });

  it('should set correct custom ID for Claim button', () => {
    const row = createBountyButtons(baseConfig);
    const claimButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🎯 Claim',
    );
    expect(claimButton).toBeDefined();
    const data = (claimButton as { data: { custom_id: string } }).data;
    expect(data.custom_id).toBe('sf:claim:bounty-123');
  });

  it('should set correct custom ID for Subscribe button', () => {
    const row = createBountyButtons(baseConfig);
    const subscribeButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🔔 Subscribe',
    );
    expect(subscribeButton).toBeDefined();
    const data = (subscribeButton as { data: { custom_id: string } }).data;
    expect(data.custom_id).toBe('sf:subscribe:bounty-123');
  });

  it('should use custom prefix when provided', () => {
    const configWithPrefix = { ...baseConfig, customIdPrefix: 'custom' };
    const row = createBountyButtons(configWithPrefix);

    const claimButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🎯 Claim',
    );
    const data = (claimButton as { data: { custom_id: string } }).data;
    expect(data.custom_id).toBe('custom:claim:bounty-123');
  });

  it('should fallback to web URL when no GitHub URL', () => {
    const noGithubConfig = { ...baseConfig, githubIssueUrl: null };
    const row = createBountyButtons(noGithubConfig);

    const viewButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🔗 View Details',
    );
    expect(viewButton).toBeDefined();
    const data = (viewButton as { data: { url: string } }).data;
    expect(data.url).toContain('solfoundry.org/bounties/bounty-123');
  });

  it('should have exactly 3 buttons for claimable bounty', () => {
    const row = createBountyButtons(baseConfig);
    expect(row.components.length).toBe(3);
  });

  it('should have exactly 2 buttons for non-claimable bounty', () => {
    const nonClaimableConfig = { ...baseConfig, isClaimable: false };
    const row = createBountyButtons(nonClaimableConfig);
    expect(row.components.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Status Update Button Tests
// ---------------------------------------------------------------------------

describe('createStatusUpdateButtons', () => {
  it('should create View Details and Subscribe buttons', () => {
    const row = createStatusUpdateButtons('bounty-123', 'https://github.com/example/42');
    expect(row.components.length).toBe(2);
  });

  it('should create only Subscribe button when no GitHub URL', () => {
    const row = createStatusUpdateButtons('bounty-123', null);
    expect(row.components.length).toBe(1);
  });

  it('should set correct custom ID for Subscribe button', () => {
    const row = createStatusUpdateButtons('bounty-456', null);
    const subscribeButton = row.components.find(
      (c) => 'data' in c && c.data.label === '🔔 Subscribe',
    );
    const data = (subscribeButton as { data: { custom_id: string } }).data;
    expect(data.custom_id).toBe('sf:subscribe:bounty-456');
  });
});

// ---------------------------------------------------------------------------
// Custom ID Parsing Tests
// ---------------------------------------------------------------------------

describe('parseButtonCustomId', () => {
  it('should parse valid claim custom ID', () => {
    const result = parseButtonCustomId('sf:claim:bounty-123');
    expect(result).toEqual({ action: 'claim', bountyId: 'bounty-123' });
  });

  it('should parse valid subscribe custom ID', () => {
    const result = parseButtonCustomId('sf:subscribe:bounty-456');
    expect(result).toEqual({ action: 'subscribe', bountyId: 'bounty-456' });
  });

  it('should parse valid view_details custom ID', () => {
    const result = parseButtonCustomId('sf:view_details:bounty-789');
    expect(result).toEqual({ action: 'view_details', bountyId: 'bounty-789' });
  });

  it('should return null for invalid prefix', () => {
    const result = parseButtonCustomId('other:claim:bounty-123');
    expect(result).toBeNull();
  });

  it('should return null for invalid action', () => {
    const result = parseButtonCustomId('sf:unknown:bounty-123');
    expect(result).toBeNull();
  });

  it('should return null for malformed ID', () => {
    const result = parseButtonCustomId('sf:claim');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseButtonCustomId('');
    expect(result).toBeNull();
  });

  it('should return null for random string', () => {
    const result = parseButtonCustomId('random-string');
    expect(result).toBeNull();
  });
});
