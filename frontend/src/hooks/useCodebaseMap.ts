/**
 * Custom hook for fetching and managing Interactive Codebase Map state.
 *
 * Handles API data fetching with loading/error states, filter management,
 * node expansion/selection, and canvas viewport (zoom/pan) state. Integrates
 * with the existing fetch pattern used throughout the SolFoundry frontend.
 *
 * @module hooks/useCodebaseMap
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  CodebaseMapResponse,
  CodebaseMapFilters,
  CodebaseNode,
  PositionedNode,
} from '../types/codebase-map';
import { DEFAULT_CODEBASE_MAP_FILTERS } from '../types/codebase-map';
import {
  computeRadialLayout,
  hitTestNode,
  extractFileExtensions,
  extractModuleNames,
} from '../data/codebaseMapTransformer';

/** Viewport state for zoom/pan navigation on the canvas. */
export interface ViewportState {
  /** Horizontal offset of the viewport in canvas coordinates. */
  offsetX: number;
  /** Vertical offset of the viewport in canvas coordinates. */
  offsetY: number;
  /** Zoom scale factor (1.0 = no zoom). */
  scale: number;
}

/** Return type of the useCodebaseMap hook. */
export interface UseCodebaseMapReturn {
  /** Raw API response data (null until loaded). */
  mapData: CodebaseMapResponse | null;
  /** Whether the initial data fetch is in progress. */
  loading: boolean;
  /** Error message if the data fetch failed (null on success). */
  error: string | null;
  /** Current filter state for search and filtering. */
  filters: CodebaseMapFilters;
  /** Current viewport state for zoom/pan. */
  viewport: ViewportState;
  /** Set of expanded directory paths. */
  expandedPaths: Set<string>;
  /** Currently selected node for the detail panel (null if none). */
  selectedNode: CodebaseNode | null;
  /** Positioned nodes computed for canvas rendering. */
  positionedNodes: PositionedNode[];
  /** Available file extensions for the filter dropdown. */
  fileExtensions: string[];
  /** Available module names for the filter dropdown. */
  moduleNames: string[];
  /** Update a single filter field. */
  setFilter: <K extends keyof CodebaseMapFilters>(
    key: K,
    value: CodebaseMapFilters[K]
  ) => void;
  /** Reset all filters to defaults. */
  resetFilters: () => void;
  /** Toggle directory expansion. */
  toggleExpanded: (path: string) => void;
  /** Set the selected node for the detail panel. */
  selectNode: (node: CodebaseNode | null) => void;
  /** Update the viewport state (zoom/pan). */
  setViewport: (viewport: ViewportState) => void;
  /** Perform hit testing at canvas coordinates. */
  hitTest: (x: number, y: number) => PositionedNode | null;
  /** Retry fetching data after an error. */
  retry: () => void;
}

/**
 * Hook for managing the Interactive Codebase Map state and data.
 *
 * Fetches codebase map data from the backend API, manages UI state
 * (filters, viewport, selection, expansion), and computes the positioned
 * node layout for canvas rendering.
 *
 * @param canvasWidth - Width of the canvas element in pixels.
 * @param canvasHeight - Height of the canvas element in pixels.
 * @returns Complete codebase map state and action handlers.
 */
export function useCodebaseMap(
  canvasWidth: number = 800,
  canvasHeight: number = 600,
): UseCodebaseMapReturn {
  const [mapData, setMapData] = useState<CodebaseMapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CodebaseMapFilters>(
    DEFAULT_CODEBASE_MAP_FILTERS
  );
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<CodebaseNode | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch codebase map data from the API
  useEffect(() => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function fetchMapData(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/codebase/map', {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch codebase map: ${response.status} ${response.statusText}`
          );
        }

        const data: CodebaseMapResponse = await response.json();
        setMapData(data);

        // Auto-expand top-level modules on initial load
        if (data.tree.children) {
          const topLevelPaths = new Set(
            data.tree.children.map((child) => child.path)
          );
          setExpandedPaths(topLevelPaths);
        }
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return; // Ignore aborted requests
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unknown error loading codebase map';
        setError(message);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchMapData();

    return () => {
      abortController.abort();
    };
  }, [fetchTrigger]);

  // Compute positioned nodes for the current state
  const positionedNodes = useMemo(() => {
    if (!mapData?.tree) return [];

    return computeRadialLayout(
      mapData.tree,
      canvasWidth / 2,
      canvasHeight / 2,
      expandedPaths,
      filters,
    );
  }, [mapData, canvasWidth, canvasHeight, expandedPaths, filters]);

  // Extract filter options from tree data
  const fileExtensions = useMemo(() => {
    if (!mapData?.tree) return [];
    return extractFileExtensions(mapData.tree);
  }, [mapData]);

  const moduleNames = useMemo(() => {
    if (!mapData?.tree) return [];
    return extractModuleNames(mapData.tree);
  }, [mapData]);

  // Filter management
  const setFilter = useCallback(
    <K extends keyof CodebaseMapFilters>(
      key: K,
      value: CodebaseMapFilters[K]
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_CODEBASE_MAP_FILTERS);
  }, []);

  // Node expansion management
  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Node selection
  const selectNode = useCallback((node: CodebaseNode | null) => {
    setSelectedNode(node);
  }, []);

  // Hit testing for canvas interactions
  const hitTest = useCallback(
    (x: number, y: number): PositionedNode | null => {
      return hitTestNode(positionedNodes, x, y);
    },
    [positionedNodes]
  );

  // Retry mechanism
  const retry = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  return {
    mapData,
    loading,
    error,
    filters,
    viewport,
    expandedPaths,
    selectedNode,
    positionedNodes,
    fileExtensions,
    moduleNames,
    setFilter,
    resetFilters,
    toggleExpanded,
    selectNode,
    setViewport,
    hitTest,
    retry,
  };
}
