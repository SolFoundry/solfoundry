/**
 * Mock codebase map data for local development and testing.
 *
 * Provides a representative subset of the SolFoundry repository structure
 * that can be used when the backend API is unavailable. Matches the
 * CodebaseMapResponse type from the API.
 *
 * @module data/mockCodebaseMap
 */

import type { CodebaseMapResponse } from '../types/codebase-map';

/** Mock codebase map response matching the SolFoundry repo structure. */
export const mockCodebaseMapData: CodebaseMapResponse = {
  tree: {
    name: 'solfoundry',
    path: '',
    node_type: 'directory',
    category: 'source',
    module: 'root',
    has_active_bounty: true,
    bounties: [],
    recently_modified: true,
    has_test_coverage: false,
    file_count: 45,
    children: [
      {
        name: 'backend',
        path: 'backend',
        node_type: 'directory',
        category: 'source',
        module: 'backend',
        has_active_bounty: true,
        bounties: [
          { id: 'gh-500', title: 'API rate limiting', tier: 'T2', status: 'open', reward_amount: 200000 },
        ],
        recently_modified: true,
        has_test_coverage: false,
        file_count: 15,
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
            file_count: 10,
            children: [
              { name: 'main.py', path: 'backend/app/main.py', node_type: 'file', extension: 'py', size: 3200, category: 'source', module: 'backend', has_active_bounty: false, bounties: [], recently_modified: true, has_test_coverage: true },
              { name: 'auth.py', path: 'backend/app/auth.py', node_type: 'file', extension: 'py', size: 2800, category: 'source', module: 'backend', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: true },
              { name: 'database.py', path: 'backend/app/database.py', node_type: 'file', extension: 'py', size: 2400, category: 'source', module: 'backend', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
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
            file_count: 5,
            children: [
              { name: 'test_auth.py', path: 'backend/tests/test_auth.py', node_type: 'file', extension: 'py', size: 1800, category: 'test', module: 'backend', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
              { name: 'test_bounties.py', path: 'backend/tests/test_bounties.py', node_type: 'file', extension: 'py', size: 3200, category: 'test', module: 'backend', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
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
          { id: 'gh-512', title: 'Interactive codebase map', tier: 'T2', status: 'open', reward_amount: 300000 },
        ],
        recently_modified: true,
        has_test_coverage: false,
        file_count: 20,
        children: [
          {
            name: 'src',
            path: 'frontend/src',
            node_type: 'directory',
            category: 'source',
            module: 'frontend',
            has_active_bounty: true,
            bounties: [],
            recently_modified: true,
            has_test_coverage: false,
            file_count: 18,
            children: [
              { name: 'App.tsx', path: 'frontend/src/App.tsx', node_type: 'file', extension: 'tsx', size: 2100, category: 'source', module: 'frontend', has_active_bounty: false, bounties: [], recently_modified: true, has_test_coverage: false },
              { name: 'main.tsx', path: 'frontend/src/main.tsx', node_type: 'file', extension: 'tsx', size: 400, category: 'source', module: 'frontend', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
            ],
          },
        ],
      },
      {
        name: 'contracts',
        path: 'contracts',
        node_type: 'directory',
        category: 'source',
        module: 'contracts',
        has_active_bounty: false,
        bounties: [],
        recently_modified: false,
        has_test_coverage: false,
        file_count: 8,
        children: [
          { name: 'lib.rs', path: 'contracts/lib.rs', node_type: 'file', extension: 'rs', size: 5000, category: 'source', module: 'contracts', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: true },
        ],
      },
      { name: 'README.md', path: 'README.md', node_type: 'file', extension: 'md', size: 8000, category: 'documentation', module: 'root', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
      { name: 'index.html', path: 'index.html', node_type: 'file', extension: 'html', size: 12000, category: 'source', module: 'root', has_active_bounty: false, bounties: [], recently_modified: false, has_test_coverage: false },
    ],
  },
  dependencies: [
    { source: 'frontend', target: 'backend', relationship: 'API calls via /api proxy' },
    { source: 'backend', target: 'contracts', relationship: 'Solana RPC calls for on-chain operations' },
  ],
  summary: {
    total_files: 45,
    total_directories: 12,
    total_modules: 5,
    modules: ['automaton', 'backend', 'contracts', 'frontend', 'scripts'],
    active_bounties: 8,
    recent_commits: 34,
    recent_prs: 12,
  },
  pull_requests: [
    { number: 180, title: 'feat: add interactive codebase map', state: 'open', author: 'ItachiDevv', created_at: new Date().toISOString(), merged_at: null, html_url: 'https://github.com/SolFoundry/solfoundry/pull/180' },
    { number: 178, title: 'fix: escrow token transfer edge case', state: 'closed', author: 'HuiNeng6', created_at: new Date(Date.now() - 86400000).toISOString(), merged_at: new Date(Date.now() - 43200000).toISOString(), html_url: 'https://github.com/SolFoundry/solfoundry/pull/178' },
  ],
  generated_at: new Date().toISOString(),
};
