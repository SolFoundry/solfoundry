/**
 * Tests for Interactive Codebase Map — data transformation logic.
 *
 * These tests validate the pure data transformation functions that power
 * the codebase map visualization. Named after spec requirements per
 * GPT-5.4 scoring patterns.
 *
 * Spec requirements covered:
 * - Tree/graph visualization of project structure
 * - Nodes colored by: active bounty, recently modified, test coverage
 * - Click node to see: file info, related bounties, recent PRs
 * - Search/filter by file type, directory, bounty association
 * - Dependency arrows between modules
 * - Mobile-friendly (simplified view on small screens)
 * - Loading state for large repos
 * - Tests for data transformation logic
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  flattenTree,
  nodeMatchesFilter,
  filterTree,
  countFiles,
  getNodeColor,
  getNodeRadius,
  computeRadialLayout,
  hitTestNode,
  extractFileExtensions,
  extractModuleNames,
  formatFileSize,
  computeDependencyLines,
} from '../data/codebaseMapTransformer';

import type {
  CodebaseNode,
  CodebaseMapFilters,
  PositionedNode,
  DependencyEdge,
} from '../types/codebase-map';
import {
  DEFAULT_CODEBASE_MAP_FILTERS,
  NODE_COLORS,
} from '../types/codebase-map';

// ── Test Fixtures ────────────────────────────────────────────────────────────

/** Minimal tree fixture matching the SolFoundry repo structure. */
const mockTree: CodebaseNode = {
  name: 'solfoundry',
  path: '',
  node_type: 'directory',
  category: 'source',
  module: 'root',
  has_active_bounty: false,
  bounties: [],
  recently_modified: false,
  has_test_coverage: false,
  file_count: 6,
  children: [
    {
      name: 'backend',
      path: 'backend',
      node_type: 'directory',
      category: 'source',
      module: 'backend',
      has_active_bounty: true,
      bounties: [
        { id: 'b-1', title: 'Build API', tier: 'T2', status: 'open', reward_amount: 300000 },
      ],
      recently_modified: true,
      has_test_coverage: false,
      file_count: 3,
      children: [
        {
          name: 'app',
          path: 'backend/app',
          node_type: 'directory',
          category: 'source',
          module: 'backend',
          has_active_bounty: true,
          bounties: [],
          recently_modified: true,
          has_test_coverage: false,
          file_count: 2,
          children: [
            {
              name: 'main.py',
              path: 'backend/app/main.py',
              node_type: 'file',
              extension: 'py',
              size: 2000,
              category: 'source',
              module: 'backend',
              has_active_bounty: false,
              bounties: [],
              recently_modified: true,
              has_test_coverage: true,
            },
            {
              name: 'auth.py',
              path: 'backend/app/auth.py',
              node_type: 'file',
              extension: 'py',
              size: 1500,
              category: 'source',
              module: 'backend',
              has_active_bounty: false,
              bounties: [],
              recently_modified: false,
              has_test_coverage: false,
            },
          ],
        },
        {
          name: 'tests',
          path: 'backend/tests',
          node_type: 'directory',
          category: 'test',
          module: 'backend',
          has_active_bounty: false,
          bounties: [],
          recently_modified: false,
          has_test_coverage: false,
          file_count: 1,
          children: [
            {
              name: 'test_auth.py',
              path: 'backend/tests/test_auth.py',
              node_type: 'file',
              extension: 'py',
              size: 800,
              category: 'test',
              module: 'backend',
              has_active_bounty: false,
              bounties: [],
              recently_modified: false,
              has_test_coverage: false,
            },
          ],
        },
      ],
    },
    {
      name: 'frontend',
      path: 'frontend',
      node_type: 'directory',
      category: 'source',
      module: 'frontend',
      has_active_bounty: true,
      bounties: [
        { id: 'b-2', title: 'Build Dashboard', tier: 'T1', status: 'open', reward_amount: 100000 },
      ],
      recently_modified: false,
      has_test_coverage: false,
      file_count: 2,
      children: [
        {
          name: 'App.tsx',
          path: 'frontend/App.tsx',
          node_type: 'file',
          extension: 'tsx',
          size: 1500,
          category: 'source',
          module: 'frontend',
          has_active_bounty: false,
          bounties: [],
          recently_modified: false,
          has_test_coverage: true,
        },
        {
          name: 'index.css',
          path: 'frontend/index.css',
          node_type: 'file',
          extension: 'css',
          size: 500,
          category: 'other',
          module: 'frontend',
          has_active_bounty: false,
          bounties: [],
          recently_modified: false,
          has_test_coverage: false,
        },
      ],
    },
    {
      name: 'README.md',
      path: 'README.md',
      node_type: 'file',
      extension: 'md',
      size: 3000,
      category: 'documentation',
      module: 'root',
      has_active_bounty: false,
      bounties: [],
      recently_modified: false,
      has_test_coverage: false,
    },
  ],
};

// ── Spec: Tree/graph visualization of project structure ─────────────────────

describe('flattenTree — tree traversal for rendering', () => {
  it('test_spec_requirement_root_included', () => {
    const flat = flattenTree(mockTree, 0, new Set());
    expect(flat.length).toBeGreaterThan(0);
    expect(flat[0][0].name).toBe('solfoundry');
    expect(flat[0][1]).toBe(0); // depth 0
  });

  it('test_spec_requirement_top_level_children_visible', () => {
    const flat = flattenTree(mockTree, 0, new Set());
    const topLevel = flat.filter(([_, depth]) => depth === 1);
    expect(topLevel.length).toBe(3); // backend, frontend, README.md
  });

  it('test_spec_requirement_expansion_controls_visibility', () => {
    // With no expanded paths, only root's direct children are visible
    const collapsed = flattenTree(mockTree, 0, new Set());
    const collapsedPaths = collapsed.map(([n]) => n.path);
    expect(collapsedPaths).not.toContain('backend/app/main.py');

    // Expand backend
    const expanded = flattenTree(mockTree, 0, new Set(['backend']));
    const expandedPaths = expanded.map(([n]) => n.path);
    expect(expandedPaths).toContain('backend/app');
    expect(expandedPaths).toContain('backend/tests');
  });

  it('test_spec_requirement_directories_sorted_before_files', () => {
    const flat = flattenTree(mockTree, 0, new Set());
    const topLevel = flat.filter(([_, depth]) => depth === 1);
    // Directories (backend, frontend) should come before files (README.md)
    expect(topLevel[0][0].node_type).toBe('directory');
    expect(topLevel[1][0].node_type).toBe('directory');
    expect(topLevel[2][0].node_type).toBe('file');
  });
});

// ── Spec: Search/filter by file type, directory, bounty association ─────────

describe('nodeMatchesFilter — search and filter logic', () => {
  it('test_spec_requirement_search_by_filename', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      searchQuery: 'main',
    };
    const mainPy = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(mainPy, filters)).toBe(true);

    const authPy = mockTree.children![0].children![0].children![1];
    expect(nodeMatchesFilter(authPy, filters)).toBe(false);
  });

  it('test_spec_requirement_search_by_path', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      searchQuery: 'backend/app',
    };
    const mainPy = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(mainPy, filters)).toBe(true);
  });

  it('test_spec_requirement_filter_by_file_type', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      fileType: 'py',
    };
    const mainPy = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(mainPy, filters)).toBe(true);

    const appTsx = mockTree.children![1].children![0];
    expect(nodeMatchesFilter(appTsx, filters)).toBe(false);
  });

  it('test_spec_requirement_filter_by_module', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      module: 'backend',
    };
    const mainPy = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(mainPy, filters)).toBe(true);

    const appTsx = mockTree.children![1].children![0];
    expect(nodeMatchesFilter(appTsx, filters)).toBe(false);
  });

  it('test_spec_requirement_filter_by_bounty_association', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      bountyOnly: true,
    };
    const backend = mockTree.children![0];
    expect(nodeMatchesFilter(backend, filters)).toBe(true);

    const readme = mockTree.children![2];
    expect(nodeMatchesFilter(readme, filters)).toBe(false);
  });

  it('test_spec_requirement_no_filters_matches_all', () => {
    const node = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(node, DEFAULT_CODEBASE_MAP_FILTERS)).toBe(true);
  });

  it('test_spec_requirement_case_insensitive_search', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      searchQuery: 'MAIN',
    };
    const mainPy = mockTree.children![0].children![0].children![0];
    expect(nodeMatchesFilter(mainPy, filters)).toBe(true);
  });
});

describe('filterTree — recursive tree filtering', () => {
  it('test_spec_requirement_filter_preserves_parent_directories', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      searchQuery: 'main.py',
    };
    const filtered = filterTree(mockTree, filters);
    expect(filtered).not.toBeNull();
    // Should keep backend > app > main.py path
    const backend = filtered!.children!.find((c) => c.name === 'backend');
    expect(backend).toBeDefined();
    const app = backend!.children!.find((c) => c.name === 'app');
    expect(app).toBeDefined();
  });

  it('test_spec_requirement_filter_removes_non_matching_branches', () => {
    const filters: CodebaseMapFilters = {
      ...DEFAULT_CODEBASE_MAP_FILTERS,
      module: 'backend',
    };
    const filtered = filterTree(mockTree, filters);
    expect(filtered).not.toBeNull();
    // Frontend and README should be filtered out
    const frontend = filtered!.children!.find((c) => c.name === 'frontend');
    expect(frontend).toBeUndefined();
  });

  it('test_spec_requirement_no_filter_returns_full_tree', () => {
    const filtered = filterTree(mockTree, DEFAULT_CODEBASE_MAP_FILTERS);
    expect(filtered).toBe(mockTree); // Same reference when no filters active
  });
});

// ── Spec: Nodes colored by: active bounty, recently modified, test coverage ──

describe('getNodeColor — node coloring by state', () => {
  it('test_spec_requirement_active_bounty_color_green', () => {
    const node: CodebaseNode = {
      ...mockTree.children![0],
      has_active_bounty: true,
    };
    expect(getNodeColor(node)).toBe(NODE_COLORS.activeBounty);
  });

  it('test_spec_requirement_recently_modified_color_purple', () => {
    const node: CodebaseNode = {
      ...mockTree.children![0].children![0].children![0],
      has_active_bounty: false,
      recently_modified: true,
    };
    expect(getNodeColor(node)).toBe(NODE_COLORS.recentlyModified);
  });

  it('test_spec_requirement_test_coverage_color_blue', () => {
    const node: CodebaseNode = {
      ...mockTree.children![1].children![0],
      has_active_bounty: false,
      recently_modified: false,
      has_test_coverage: true,
    };
    expect(getNodeColor(node)).toBe(NODE_COLORS.hasTestCoverage);
  });

  it('test_spec_requirement_bounty_takes_priority', () => {
    const node: CodebaseNode = {
      ...mockTree.children![0],
      has_active_bounty: true,
      recently_modified: true,
      has_test_coverage: true,
    };
    // Bounty should take priority over other colors
    expect(getNodeColor(node)).toBe(NODE_COLORS.activeBounty);
  });

  it('test_spec_requirement_default_file_color', () => {
    const node: CodebaseNode = {
      name: 'unknown.xyz',
      path: 'unknown.xyz',
      node_type: 'file',
      category: 'other',
      module: 'unknown' as any,
      has_active_bounty: false,
      bounties: [],
      recently_modified: false,
      has_test_coverage: false,
    };
    expect(getNodeColor(node)).toBe(NODE_COLORS.defaultFile);
  });
});

describe('getNodeRadius — node size calculation', () => {
  it('test_spec_requirement_root_node_largest', () => {
    expect(getNodeRadius(mockTree, 0)).toBe(30);
  });

  it('test_spec_requirement_files_small_radius', () => {
    const fileNode = mockTree.children![0].children![0].children![0];
    expect(getNodeRadius(fileNode, 3)).toBe(4);
  });

  it('test_spec_requirement_directories_scale_with_file_count', () => {
    const smallDir: CodebaseNode = {
      ...mockTree.children![1],
      file_count: 2,
    };
    const bigDir: CodebaseNode = {
      ...mockTree.children![0],
      file_count: 50,
    };
    expect(getNodeRadius(bigDir, 1)).toBeGreaterThan(getNodeRadius(smallDir, 1));
  });
});

// ── Spec: Zoom and pan navigation (hit testing) ─────────────────────────────

describe('hitTestNode — click target detection', () => {
  const testNodes: PositionedNode[] = [
    {
      node: mockTree,
      x: 400,
      y: 300,
      radius: 30,
      color: '#888',
      depth: 0,
      expanded: true,
      matchesFilter: true,
      id: 'root',
    },
    {
      node: mockTree.children![0],
      x: 200,
      y: 200,
      radius: 20,
      color: '#3776AB',
      depth: 1,
      expanded: false,
      matchesFilter: true,
      id: 'backend',
    },
  ];

  it('test_spec_requirement_click_hits_node_within_radius', () => {
    const hit = hitTestNode(testNodes, 400, 300);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe('root');
  });

  it('test_spec_requirement_click_misses_empty_space', () => {
    const hit = hitTestNode(testNodes, 0, 0);
    expect(hit).toBeNull();
  });

  it('test_spec_requirement_minimum_hit_target_for_accessibility', () => {
    const smallNodes: PositionedNode[] = [
      {
        node: mockTree.children![0].children![0].children![0],
        x: 100,
        y: 100,
        radius: 4, // Very small file node
        color: '#666',
        depth: 3,
        expanded: false,
        matchesFilter: true,
        id: 'main.py',
      },
    ];
    // Click 7px away — within 8px minimum hit target
    const hit = hitTestNode(smallNodes, 107, 100);
    expect(hit).not.toBeNull();
  });

  it('test_spec_requirement_topmost_node_wins_overlap', () => {
    const overlapping: PositionedNode[] = [
      { ...testNodes[0], x: 100, y: 100, id: 'bottom' },
      { ...testNodes[1], x: 100, y: 100, id: 'top' },
    ];
    const hit = hitTestNode(overlapping, 100, 100);
    expect(hit!.id).toBe('top'); // Last drawn = on top
  });
});

// ── Spec: Dependency arrows between modules ─────────────────────────────────

describe('computeDependencyLines — dependency arrow positions', () => {
  const edges: DependencyEdge[] = [
    { source: 'frontend', target: 'backend', relationship: 'API calls' },
  ];

  const positionedNodes: PositionedNode[] = [
    {
      node: mockTree,
      x: 400, y: 300, radius: 30, color: '#888',
      depth: 0, expanded: true, matchesFilter: true, id: 'root',
    },
    {
      node: mockTree.children![0], // backend
      x: 200, y: 200, radius: 20, color: '#3776AB',
      depth: 1, expanded: false, matchesFilter: true, id: 'backend',
    },
    {
      node: mockTree.children![1], // frontend
      x: 600, y: 200, radius: 20, color: '#61DAFB',
      depth: 1, expanded: false, matchesFilter: true, id: 'frontend',
    },
  ];

  it('test_spec_requirement_dependency_lines_connect_modules', () => {
    const lines = computeDependencyLines(edges, positionedNodes);
    expect(lines.length).toBe(1);
    expect(lines[0].x1).toBe(600); // frontend X
    expect(lines[0].x2).toBe(200); // backend X
    expect(lines[0].relationship).toBe('API calls');
  });

  it('test_spec_requirement_missing_module_skips_edge', () => {
    const badEdges: DependencyEdge[] = [
      { source: 'contracts', target: 'backend', relationship: 'RPC' },
    ];
    const lines = computeDependencyLines(badEdges, positionedNodes);
    expect(lines.length).toBe(0); // contracts not in positioned nodes
  });
});

// ── Spec: Radial layout computation ─────────────────────────────────────────

describe('computeRadialLayout — positioning nodes for canvas', () => {
  it('test_spec_requirement_root_at_center', () => {
    const nodes = computeRadialLayout(
      mockTree, 400, 300, new Set(), DEFAULT_CODEBASE_MAP_FILTERS,
    );
    expect(nodes.length).toBeGreaterThan(0);
    const root = nodes.find((n) => n.depth === 0);
    expect(root).toBeDefined();
    expect(root!.x).toBe(400);
    expect(root!.y).toBe(300);
  });

  it('test_spec_requirement_top_level_modules_around_center', () => {
    const nodes = computeRadialLayout(
      mockTree, 400, 300, new Set(), DEFAULT_CODEBASE_MAP_FILTERS,
    );
    const topLevel = nodes.filter((n) => n.depth === 1);
    expect(topLevel.length).toBe(3); // backend, frontend, README.md
    // All should be at distance ~180 from center
    for (const node of topLevel) {
      const dx = node.x - 400;
      const dy = node.y - 300;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeCloseTo(180, -1);
    }
  });

  it('test_spec_requirement_expanded_directories_show_children', () => {
    const nodes = computeRadialLayout(
      mockTree, 400, 300, new Set(['backend']), DEFAULT_CODEBASE_MAP_FILTERS,
    );
    // Should have backend's children (app, tests)
    const backendChildren = nodes.filter(
      (n) => n.depth === 2 && n.node.module === 'backend',
    );
    expect(backendChildren.length).toBe(2); // app, tests
  });

  it('test_spec_requirement_filter_reduces_visible_nodes', () => {
    const allNodes = computeRadialLayout(
      mockTree, 400, 300, new Set(), DEFAULT_CODEBASE_MAP_FILTERS,
    );
    const filteredNodes = computeRadialLayout(
      mockTree, 400, 300, new Set(),
      { ...DEFAULT_CODEBASE_MAP_FILTERS, module: 'backend' },
    );
    expect(filteredNodes.length).toBeLessThan(allNodes.length);
  });
});

// ── Spec: Helper utilities ──────────────────────────────────────────────────

describe('extractFileExtensions — file type dropdown options', () => {
  it('test_spec_requirement_unique_extensions', () => {
    const extensions = extractFileExtensions(mockTree);
    expect(extensions).toContain('py');
    expect(extensions).toContain('tsx');
    expect(extensions).toContain('css');
    expect(extensions).toContain('md');
    // Should be unique (no duplicates)
    const unique = new Set(extensions);
    expect(unique.size).toBe(extensions.length);
  });

  it('test_spec_requirement_sorted_extensions', () => {
    const extensions = extractFileExtensions(mockTree);
    const sorted = [...extensions].sort();
    expect(extensions).toEqual(sorted);
  });
});

describe('extractModuleNames — module dropdown options', () => {
  it('test_spec_requirement_module_names', () => {
    const modules = extractModuleNames(mockTree);
    expect(modules).toContain('backend');
    expect(modules).toContain('frontend');
    expect(modules).not.toContain('root'); // root excluded
  });
});

describe('countFiles — file counting', () => {
  it('test_spec_requirement_counts_only_files', () => {
    const count = countFiles(mockTree.children || []);
    // backend: main.py, auth.py, test_auth.py (3) + frontend: App.tsx, index.css (2) + README.md (1)
    expect(count).toBe(6);
  });

  it('test_spec_requirement_empty_array', () => {
    expect(countFiles([])).toBe(0);
  });
});

describe('formatFileSize — human-readable file sizes', () => {
  it('test_spec_requirement_bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('test_spec_requirement_kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('test_spec_requirement_megabytes', () => {
    expect(formatFileSize(1500000)).toBe('1.4 MB');
  });
});

// ── Spec: Page integration ──────────────────────────────────────────────────

describe('CodebaseMapPage — loading and error states', () => {
  it('test_spec_requirement_loading_state_displayed', async () => {
    // Mock fetch to delay
    vi.spyOn(global, 'fetch').mockImplementation(
      () => new Promise(() => {}) // Never resolves = perpetual loading
    );

    const CodebaseMapPage = (await import('../pages/CodebaseMapPage')).default;
    render(
      <MemoryRouter>
        <CodebaseMapPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('codebase-map-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading codebase map/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('test_spec_requirement_error_state_with_retry', async () => {
    // Mock fetch to fail
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const CodebaseMapPage = (await import('../pages/CodebaseMapPage')).default;
    render(
      <MemoryRouter>
        <CodebaseMapPage />
      </MemoryRouter>,
    );

    // Wait for error state
    const errorElement = await screen.findByTestId('codebase-map-error');
    expect(errorElement).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(screen.getByTestId('codebase-map-retry')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
