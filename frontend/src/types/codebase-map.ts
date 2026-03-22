/**
 * Type definitions for the Interactive Codebase Map feature.
 *
 * Defines the shape of data returned by the /api/codebase/map endpoint
 * and the internal structures used for tree visualization, dependency
 * arrows, search/filter state, and node detail panels.
 *
 * @module types/codebase-map
 */

/** Classification of a file based on its path and extension. */
export type FileCategory =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'asset'
  | 'workflow'
  | 'other';

/** Top-level module within the SolFoundry repository. */
export type ModuleName =
  | 'backend'
  | 'frontend'
  | 'contracts'
  | 'automaton'
  | 'router'
  | 'scripts'
  | '.github'
  | 'docs'
  | 'assets'
  | 'root';

/** Summary of a bounty associated with a file or directory. */
export interface BountySummary {
  /** Bounty identifier (e.g., 'gh-512'). */
  id: string;
  /** Human-readable bounty title. */
  title: string;
  /** Bounty tier: T1, T2, or T3. */
  tier: string;
  /** Current bounty status: open, in_progress, or completed. */
  status: string;
  /** Reward amount in $FNDRY tokens. */
  reward_amount: number;
}

/** A node in the codebase tree — either a file or directory. */
export interface CodebaseNode {
  /** Display name (file or directory name, not full path). */
  name: string;
  /** Full path from repository root. */
  path: string;
  /** Whether this node is a file or directory. */
  node_type: 'file' | 'directory';
  /** Child nodes (only present for directories). */
  children?: CodebaseNode[];
  /** File extension without leading dot (files only). */
  extension?: string;
  /** File size in bytes (files only). */
  size?: number;
  /** File classification category. */
  category: FileCategory;
  /** Top-level module this file belongs to. */
  module: ModuleName | string;
  /** Whether this node has an active (open) bounty associated. */
  has_active_bounty: boolean;
  /** List of bounties associated with this node's module. */
  bounties: BountySummary[];
  /** Whether this file was modified in recent commits. */
  recently_modified: boolean;
  /** Whether this source file has an associated test file. */
  has_test_coverage: boolean;
  /** Total number of files in the subtree (directories only). */
  file_count?: number;
}

/** A dependency relationship between two modules. */
export interface DependencyEdge {
  /** Source module name. */
  source: string;
  /** Target module name. */
  target: string;
  /** Human-readable description of the dependency. */
  relationship: string;
}

/** A simplified pull request for display in node detail panel. */
export interface PullRequestSummary {
  /** PR number. */
  number: number;
  /** PR title. */
  title: string;
  /** PR state: open or closed. */
  state: string;
  /** Author GitHub username. */
  author: string;
  /** ISO timestamp of PR creation. */
  created_at: string;
  /** ISO timestamp of merge (null if not merged). */
  merged_at: string | null;
  /** URL to the PR on GitHub. */
  html_url: string;
}

/** Aggregate statistics about the codebase. */
export interface CodebaseSummary {
  /** Total number of files in the repository. */
  total_files: number;
  /** Total number of directories. */
  total_directories: number;
  /** Number of top-level modules. */
  total_modules: number;
  /** List of top-level module names. */
  modules: string[];
  /** Number of currently open bounties. */
  active_bounties: number;
  /** Number of commits in the recent period. */
  recent_commits: number;
  /** Number of recent pull requests. */
  recent_prs: number;
}

/** Complete response from the /api/codebase/map endpoint. */
export interface CodebaseMapResponse {
  /** Hierarchical tree structure of the repository. */
  tree: CodebaseNode;
  /** Module-level dependency edges. */
  dependencies: DependencyEdge[];
  /** Aggregate repository statistics. */
  summary: CodebaseSummary;
  /** Recent pull request activity. */
  pull_requests: PullRequestSummary[];
  /** ISO timestamp of when this data was generated. */
  generated_at: string;
}

/** Filter state for the codebase map search/filter functionality. */
export interface CodebaseMapFilters {
  /** Text search query for file/directory names. */
  searchQuery: string;
  /** Filter by file type extension (e.g., 'ts', 'py', 'rs'). */
  fileType: string;
  /** Filter by top-level module name. */
  module: string;
  /** Show only files/directories with active bounty associations. */
  bountyOnly: boolean;
}

/** Default filter values for initial map state. */
export const DEFAULT_CODEBASE_MAP_FILTERS: CodebaseMapFilters = {
  searchQuery: '',
  fileType: '',
  module: '',
  bountyOnly: false,
};

/** Color scheme for node visualization based on state. */
export const NODE_COLORS = {
  /** Active bounty — Solana green highlight. */
  activeBounty: '#14F195',
  /** Recently modified — Solana purple highlight. */
  recentlyModified: '#9945FF',
  /** Has test coverage — calm blue. */
  hasTestCoverage: '#4DA8FF',
  /** Default file node color. */
  defaultFile: '#666666',
  /** Default directory node color. */
  defaultDirectory: '#888888',
  /** Selected/hovered node highlight. */
  selected: '#FFD700',
} as const;

/** Color scheme for module identification. */
export const MODULE_COLORS: Record<string, string> = {
  frontend: '#61DAFB',
  backend: '#3776AB',
  contracts: '#DEA584',
  automaton: '#9945FF',
  router: '#14F195',
  scripts: '#F7DF1E',
  '.github': '#FF6B6B',
  docs: '#4DA8FF',
  assets: '#FFD700',
  root: '#888888',
};

/**
 * Positioned node for canvas rendering — extends CodebaseNode with
 * x/y coordinates and rendering metadata computed by the layout algorithm.
 */
export interface PositionedNode {
  /** Reference to the original tree node data. */
  node: CodebaseNode;
  /** Horizontal position in canvas coordinates. */
  x: number;
  /** Vertical position in canvas coordinates. */
  y: number;
  /** Rendering radius based on file count or size. */
  radius: number;
  /** Display color based on node state (bounty, modified, etc.). */
  color: string;
  /** Depth in the tree (0 = root). */
  depth: number;
  /** Whether this node is currently expanded (directories only). */
  expanded: boolean;
  /** Whether this node matches the current search/filter. */
  matchesFilter: boolean;
  /** Unique identifier for canvas hit detection. */
  id: string;
}
