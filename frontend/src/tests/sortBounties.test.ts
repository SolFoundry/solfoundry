/**
 * Tests for sortBounties utility
 * SolFoundry Bounty #482 - Updated
 */

import { sortBounties, getSortConfig, saveSortConfig } from '../utils/sortBounties';
import { Bounty, SortConfig, SortOption } from '../types/bounty';

// Mock window and localStorage
const mockLocalStorage: Record<string, string> = {};

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockLocalStorage[key];
    }),
  },
  writable: true,
});

const mockLocation = {
  search: '',
  pathname: '/bounties',
  href: 'http://localhost/bounties',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

Object.defineProperty(window, 'history', {
  value: {
    replaceState: jest.fn(),
  },
  writable: true,
});

describe('sortBounties', () => {
  const mockBounties: Bounty[] = [
    {
      id: '1',
      title: 'Low Reward Old',
      description: 'Test',
      reward: 100,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'open',
      tier: 't1',
      category: 'test',
      tags: [],
    },
    {
      id: '2',
      title: 'High Reward New',
      description: 'Test',
      reward: 500,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
      status: 'claimed',
      tier: 't3',
      category: 'test',
      tags: [],
    },
    {
      id: '3',
      title: 'Medium Reward Middle',
      description: 'Test',
      reward: 300,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      status: 'closed',
      tier: 't2',
      category: 'test',
      tags: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
    mockLocation.search = '';
  });

  describe('sort by newest', () => {
    it('should sort by date descending (newest first)', () => {
      const config: SortConfig = { option: 'newest' };
      const result = sortBounties(mockBounties, config);
      
      expect(result.map(b => b.id)).toEqual(['2', '3', '1']);
      expect(new Date(result[0].createdAt).getTime()).toBeGreaterThan(
        new Date(result[1].createdAt).getTime()
      );
    });
  });

  describe('sort by oldest', () => {
    it('should sort by date ascending (oldest first)', () => {
      const config: SortConfig = { option: 'oldest' };
      const result = sortBounties(mockBounties, config);
      
      expect(result.map(b => b.id)).toEqual(['1', '3', '2']);
    });
  });

  describe('sort by highest-reward', () => {
    it('should sort by reward descending (highest first)', () => {
      const config: SortConfig = { option: 'highest-reward' };
      const result = sortBounties(mockBounties, config);
      
      expect(result.map(b => b.id)).toEqual(['2', '3', '1']);
      expect(result[0].reward).toBe(500);
      expect(result[2].reward).toBe(100);
    });
  });

  describe('sort by lowest-reward', () => {
    it('should sort by reward ascending (lowest first)', () => {
      const config: SortConfig = { option: 'lowest-reward' };
      const result = sortBounties(mockBounties, config);
      
      expect(result.map(b => b.id)).toEqual(['1', '3', '2']);
      expect(result[0].reward).toBe(100);
      expect(result[2].reward).toBe(500);
    });
  });

  describe('sort by tier', () => {
    it('should sort by tier descending (t3 > t2 > t1)', () => {
      const config: SortConfig = { option: 'tier' };
      const result = sortBounties(mockBounties, config);
      
      expect(result[0].tier).toBe('t3');
      expect(result[1].tier).toBe('t2');
      expect(result[2].tier).toBe('t1');
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = sortBounties([], { option: 'newest' });
      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const result = sortBounties([mockBounties[0]], { option: 'newest' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should not mutate original array', () => {
      const original = [...mockBounties];
      sortBounties(mockBounties, { option: 'newest' });
      expect(mockBounties).toEqual(original);
    });
  });

  describe('persistence', () => {
    describe('getSortConfig', () => {
      it('should return default when no storage or URL', () => {
        const result = getSortConfig();
        expect(result.option).toBe('newest');
      });

      it('should read from URL first', () => {
        mockLocation.search = '?sort=highest-reward';
        const result = getSortConfig();
        expect(result.option).toBe('highest-reward');
      });

      it('should read from localStorage if no URL', () => {
        mockLocalStorage['solfoundry-sort-config'] = JSON.stringify({ option: 'oldest' });
        const result = getSortConfig();
        expect(result.option).toBe('oldest');
      });
    });

    describe('saveSortConfig', () => {
      it('should save to localStorage', () => {
        const config: SortConfig = { option: 'tier' };
        saveSortConfig(config);
        
        expect(window.localStorage.setItem).toHaveBeenCalledWith(
          'solfoundry-sort-config',
          JSON.stringify(config)
        );
      });

      it('should update URL', () => {
        const config: SortConfig = { option: 'lowest-reward' };
        saveSortConfig(config);
        
        expect(window.history.replaceState).toHaveBeenCalled();
      });
    });
  });
});
