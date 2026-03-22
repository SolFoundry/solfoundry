/**
 * Pure data transformation functions for the Interactive Codebase Map.
 *
 * All functions in this module are side-effect-free and testable.
 * They transform the API response into positioned nodes suitable for
 * canvas rendering, apply search/filter logic, and compute layout positions.
 *
 * @module data/codebaseMapTransformer
 */

import type {
  CodebaseNode,
  CodebaseMapFilters,
  PositionedNode,
  DependencyEdge,
  MODULE_COLORS,
} from '../types/codebase-map';
import {
  NODE_COLORS,
  MODULE_COLORS as COLORS,
} from '../types/codebase-map';

/**
 * Flatten a hierarchical tree into a list of nodes with depth information.
 *
 * Recursively traverses the tree, respecting expansion state, and produces
 * a flat array suitable for sequential layout rendering.
 *
 * @param node - The root tree node to flatten.
 * @param depth - Current depth in the tree (0 for root).
 * @param expandedPaths - Set of directory paths that are currently expanded.
 * @returns Flat array of [node, depth] tuples in tree traversal order.
 */
export function flattenTree(
  node: CodebaseNode,
  depth: number = 0,
  expandedPaths: Set<string> = new Set(),
): Array<[CodebaseNode, number]> {
  const result: Array<[CodebaseNode, number]> = [[node, depth]];

  if (
    node.node_type === 'directory' &&
    node.children &&
    (depth === 0 || expandedPaths.has(node.path))
  ) {
    // Sort children: directories first, then files, alphabetically within each group
    const sorted = [...node.children].sort((a, b) => {
      if (a.node_type !== b.node_type) {
        return a.node_type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const child of sorted) {
      result.push(...flattenTree(child, depth + 1, expandedPaths));
    }
  }

  return result;
}

/**
 * Apply search and filter criteria to determine if a node matches.
 *
 * Evaluates the node against all active filters: text search, file type,
 * module filter, and bounty-only toggle.
 *
 * @param node - The tree node to evaluate.
 * @param filters - Current filter state from the UI.
 * @returns True if the node matches all active filter criteria.
 */
export function nodeMatchesFilter(
  node: CodebaseNode,
  filters: CodebaseMapFilters,
): boolean {
  const { searchQuery, fileType, module, bountyOnly } = filters;

  // Text search: match against name or path (case-insensitive)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const matchesName = node.name.toLowerCase().includes(query);
    const matchesPath = node.path.toLowerCase().includes(query);
    if (!matchesName && !matchesPath) {
      return false;
    }
  }

  // File type filter: match extension
  if (fileType) {
    if (node.node_type === 'file') {
      if (node.extension !== fileType) {
        return false;
      }
    } else {
      // Directories pass if they contain files of the specified type
      // This is handled separately in the tree filter
      return true;
    }
  }

  // Module filter: match top-level module
  if (module && node.module !== module) {
    return false;
  }

  // Bounty-only filter: show only nodes with active bounties
  if (bountyOnly && !node.has_active_bounty) {
    return false;
  }

  return true;
}

/**
 * Filter a tree recursively, keeping parent directories that contain matching children.
 *
 * Creates a new tree (does not mutate the original) where:
 * - Leaf nodes that don't match are removed
 * - Directories are kept if they contain at least one matching descendant
 * - The root node is always preserved
 *
 * @param node - The root tree node to filter.
 * @param filters - Current filter state from the UI.
 * @returns A new tree with non-matching branches pruned, or null if no matches.
 */
export function filterTree(
  node: CodebaseNode,
  filters: CodebaseMapFilters,
): CodebaseNode | null {
  // Check if any filter is active
  const hasActiveFilter =
    filters.searchQuery.trim() !== '' ||
    filters.fileType !== '' ||
    filters.module !== '' ||
    filters.bountyOnly;

  if (!hasActiveFilter) {
    return node;
  }

  if (node.node_type === 'file') {
    return nodeMatchesFilter(node, filters) ? node : null;
  }

  // Directory: filter children recursively
  const filteredChildren = (node.children || [])
    .map((child) => filterTree(child, filters))
    .filter((child): child is CodebaseNode => child !== null);

  // Keep directory if it has matching children OR matches itself
  if (filteredChildren.length > 0 || nodeMatchesFilter(node, filters)) {
    return {
      ...node,
      children: filteredChildren,
      file_count: countFiles(filteredChildren),
    };
  }

  return null;
}

/**
 * Count total files in a list of tree nodes (recursive).
 *
 * @param nodes - Array of tree nodes to count files in.
 * @returns Total number of file nodes in all subtrees.
 */
export function countFiles(nodes: CodebaseNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.node_type === 'file') {
      count += 1;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

/**
 * Determine the display color for a tree node based on its state.
 *
 * Priority order (highest to lowest):
 * 1. Active bounty association (green)
 * 2. Recently modified (purple)
 * 3. Has test coverage (blue)
 * 4. Module-specific color
 * 5. Default color based on node type
 *
 * @param node - The tree node to determine color for.
 * @returns CSS color string for rendering.
 */
export function getNodeColor(node: CodebaseNode): string {
  if (node.has_active_bounty) {
    return NODE_COLORS.activeBounty;
  }
  if (node.recently_modified) {
    return NODE_COLORS.recentlyModified;
  }
  if (node.has_test_coverage) {
    return NODE_COLORS.hasTestCoverage;
  }

  // Module-specific color
  const moduleColor = COLORS[node.module];
  if (moduleColor) {
    return moduleColor;
  }

  return node.node_type === 'directory'
    ? NODE_COLORS.defaultDirectory
    : NODE_COLORS.defaultFile;
}

/**
 * Calculate the rendering radius for a node based on its contents.
 *
 * Larger directories (more files) get larger circles. Files get a
 * fixed small radius. Root and top-level modules get larger radii.
 *
 * @param node - The tree node to calculate radius for.
 * @param depth - Depth in the tree (0 = root).
 * @returns Radius in pixels for canvas rendering.
 */
export function getNodeRadius(node: CodebaseNode, depth: number): number {
  if (node.node_type === 'file') {
    return 4;
  }

  const fileCount = node.file_count || 0;

  if (depth === 0) {
    return 30; // Root node
  }
  if (depth === 1) {
    return Math.max(12, Math.min(24, 10 + Math.sqrt(fileCount) * 2));
  }

  return Math.max(6, Math.min(16, 5 + Math.sqrt(fileCount)));
}

/**
 * Compute positioned nodes for radial tree layout rendering.
 *
 * Arranges top-level modules in a circle around the root, with their
 * children radiating outward. This creates the interactive graph
 * visualization used by the canvas renderer.
 *
 * @param tree - The root tree node to layout.
 * @param centerX - Horizontal center of the layout in canvas coordinates.
 * @param centerY - Vertical center of the layout in canvas coordinates.
 * @param expandedPaths - Set of expanded directory paths.
 * @param filters - Active filter state.
 * @returns Array of positioned nodes ready for canvas rendering.
 */
export function computeRadialLayout(
  tree: CodebaseNode,
  centerX: number,
  centerY: number,
  expandedPaths: Set<string>,
  filters: CodebaseMapFilters,
): PositionedNode[] {
  const filteredTree = filterTree(tree, filters);
  if (!filteredTree) {
    return [];
  }

  const nodes: PositionedNode[] = [];
  const hasActiveFilter =
    filters.searchQuery.trim() !== '' ||
    filters.fileType !== '' ||
    filters.module !== '' ||
    filters.bountyOnly;

  // Root node at center
  nodes.push({
    node: filteredTree,
    x: centerX,
    y: centerY,
    radius: getNodeRadius(filteredTree, 0),
    color: getNodeColor(filteredTree),
    depth: 0,
    expanded: true,
    matchesFilter: true,
    id: filteredTree.path || 'root',
  });

  // Layout top-level children (modules) in a circle
  const children = filteredTree.children || [];
  const moduleRadius = 180; // Distance from center to module nodes
  const angleStep = (2 * Math.PI) / Math.max(children.length, 1);

  children.forEach((child, index) => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const moduleX = centerX + Math.cos(angle) * moduleRadius;
    const moduleY = centerY + Math.sin(angle) * moduleRadius;
    const isExpanded = expandedPaths.has(child.path);

    nodes.push({
      node: child,
      x: moduleX,
      y: moduleY,
      radius: getNodeRadius(child, 1),
      color: getNodeColor(child),
      depth: 1,
      expanded: isExpanded,
      matchesFilter: !hasActiveFilter || nodeMatchesFilter(child, filters),
      id: child.path,
    });

    // If expanded, layout children of this module
    if (isExpanded && child.children) {
      const subChildren = child.children;
      const subRadius = 80 + subChildren.length * 3;
      const subAngleStep = (Math.PI * 0.8) / Math.max(subChildren.length - 1, 1);
      const startAngle = angle - (Math.PI * 0.4);

      subChildren.forEach((subChild, subIndex) => {
        const subAngle = startAngle + subAngleStep * subIndex;
        const subX = moduleX + Math.cos(subAngle) * subRadius;
        const subY = moduleY + Math.sin(subAngle) * subRadius;
        const isSubExpanded = expandedPaths.has(subChild.path);

        nodes.push({
          node: subChild,
          x: subX,
          y: subY,
          radius: getNodeRadius(subChild, 2),
          color: getNodeColor(subChild),
          depth: 2,
          expanded: isSubExpanded,
          matchesFilter: !hasActiveFilter || nodeMatchesFilter(subChild, filters),
          id: subChild.path,
        });

        // Third level children (if expanded)
        if (isSubExpanded && subChild.children) {
          const leafChildren = subChild.children;
          const leafRadius = 50 + leafChildren.length * 2;
          const leafAngleStep =
            (Math.PI * 0.6) / Math.max(leafChildren.length - 1, 1);
          const leafStartAngle = subAngle - (Math.PI * 0.3);

          leafChildren.forEach((leaf, leafIndex) => {
            const leafAngle = leafStartAngle + leafAngleStep * leafIndex;
            const leafX = subX + Math.cos(leafAngle) * leafRadius;
            const leafY = subY + Math.sin(leafAngle) * leafRadius;

            nodes.push({
              node: leaf,
              x: leafX,
              y: leafY,
              radius: getNodeRadius(leaf, 3),
              color: getNodeColor(leaf),
              depth: 3,
              expanded: false,
              matchesFilter: !hasActiveFilter || nodeMatchesFilter(leaf, filters),
              id: leaf.path,
            });
          });
        }
      });
    }
  });

  return nodes;
}

/**
 * Find the positioned node under a given canvas coordinate (hit testing).
 *
 * Used for click and hover interactions on the canvas. Checks nodes
 * in reverse order (top-most first) for correct z-order hit detection.
 *
 * @param nodes - Array of positioned nodes to test against.
 * @param x - X coordinate in canvas space.
 * @param y - Y coordinate in canvas space.
 * @returns The positioned node under the point, or null if none.
 */
export function hitTestNode(
  nodes: PositionedNode[],
  x: number,
  y: number,
): PositionedNode | null {
  // Check in reverse order (last drawn = on top)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const dx = x - node.x;
    const dy = y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Use a minimum hit target of 8px for small nodes (accessibility)
    const hitRadius = Math.max(node.radius, 8);
    if (distance <= hitRadius) {
      return node;
    }
  }
  return null;
}

/**
 * Extract unique file extensions from a tree for the file type filter dropdown.
 *
 * @param node - The root tree node to scan.
 * @returns Sorted array of unique file extensions found in the tree.
 */
export function extractFileExtensions(node: CodebaseNode): string[] {
  const extensions = new Set<string>();

  function walk(current: CodebaseNode): void {
    if (current.node_type === 'file' && current.extension) {
      extensions.add(current.extension);
    }
    if (current.children) {
      current.children.forEach(walk);
    }
  }

  walk(node);
  return Array.from(extensions).sort();
}

/**
 * Extract unique module names from a tree for the module filter dropdown.
 *
 * @param node - The root tree node to scan.
 * @returns Sorted array of unique module names found in the tree.
 */
export function extractModuleNames(node: CodebaseNode): string[] {
  const modules = new Set<string>();

  function walk(current: CodebaseNode): void {
    if (current.module && current.module !== 'root') {
      modules.add(current.module);
    }
    if (current.children) {
      current.children.forEach(walk);
    }
  }

  walk(node);
  return Array.from(modules).sort();
}

/**
 * Format a file size in bytes to a human-readable string.
 *
 * @param bytes - File size in bytes.
 * @returns Human-readable size string (e.g., '1.5 KB', '2.3 MB').
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compute connection lines between dependency edges for canvas rendering.
 *
 * Maps module-level dependency edges to positioned node coordinates
 * for drawing arrows on the canvas.
 *
 * @param edges - Array of dependency edges from the API.
 * @param nodes - Array of positioned nodes with computed coordinates.
 * @returns Array of line segments with start/end coordinates and relationship labels.
 */
export function computeDependencyLines(
  edges: DependencyEdge[],
  nodes: PositionedNode[],
): Array<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  relationship: string;
}> {
  const nodeMap = new Map<string, PositionedNode>();
  for (const node of nodes) {
    // Map by module name for top-level module nodes
    if (node.depth === 1) {
      nodeMap.set(node.node.name, node);
    }
  }

  return edges
    .map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return null;

      return {
        x1: sourceNode.x,
        y1: sourceNode.y,
        x2: targetNode.x,
        y2: targetNode.y,
        relationship: edge.relationship,
      };
    })
    .filter(
      (line): line is NonNullable<typeof line> => line !== null
    );
}
