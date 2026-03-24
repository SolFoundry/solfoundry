/**
 * CodebaseMapPage — Route entry point for /codebase-map.
 *
 * Renders the full Interactive Codebase Map feature including the canvas
 * visualization, filter controls, summary statistics, and node detail panel.
 * Integrates with the useCodebaseMap hook for state management.
 *
 * This page is integrated into the main SolFoundry navigation (SiteLayout)
 * and accessible from the header nav bar.
 *
 * @module pages/CodebaseMapPage
 */

import { useState, useCallback } from 'react';
import {
  CodebaseMapVisualization,
  CodebaseMapFilters,
  CodebaseSummaryBar,
  NodeDetailPanel,
} from '../components/codebase-map';
import { useCodebaseMap } from '../hooks/useCodebaseMap';

/**
 * Main page component for the Interactive Codebase Map.
 *
 * Orchestrates the visualization canvas, filter toolbar, summary bar,
 * and detail panel. Manages the showDependencies toggle and coordinates
 * node selection between the canvas and detail panel.
 *
 * Mobile-friendly: On small screens, the detail panel overlays the canvas
 * and the visualization renders with a simplified layout.
 */
export default function CodebaseMapPage(): JSX.Element {
  const [showDependencies, setShowDependencies] = useState<boolean>(true);

  const {
    mapData,
    loading,
    error,
    filters,
    viewport,
    selectedNode,
    positionedNodes,
    fileExtensions,
    moduleNames,
    setFilter,
    resetFilters,
    toggleExpanded,
    selectNode,
    setViewport,
    retry,
  } = useCodebaseMap(800, 600);

  /** Handle node click — select file, expand directory. */
  const handleNodeClick = useCallback(
    (node: Parameters<typeof selectNode>[0]) => {
      if (!node) return;
      selectNode(node);
      if (node.node_type === 'directory') {
        toggleExpanded(node.path);
      }
    },
    [selectNode, toggleExpanded],
  );

  /** Handle double-click — toggle directory expansion only. */
  const handleNodeDoubleClick = useCallback(
    (path: string) => {
      toggleExpanded(path);
    },
    [toggleExpanded],
  );

  // Loading state with animated spinner
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh]"
        data-testid="codebase-map-loading"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-mono">
            Loading codebase map...
          </p>
          <p className="text-xs text-gray-600">
            Fetching repository structure from GitHub
          </p>
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh]"
        data-testid="codebase-map-error"
      >
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">
            Failed to Load Codebase Map
          </h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={retry}
            className="px-4 py-2 rounded-lg bg-[#9945FF]/20 border border-[#9945FF]/30
                       text-[#9945FF] text-sm font-medium hover:bg-[#9945FF]/30
                       transition-colors"
            data-testid="codebase-map-retry"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-surface p-4 sm:p-6 lg:p-8"
      data-testid="codebase-map-page"
    >
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Codebase Map</h1>
        <p className="text-sm text-gray-500">
          Interactive visualization of the SolFoundry repository structure,
          dependencies, and bounty associations.
        </p>
      </div>

      {/* Summary Statistics */}
      {mapData && (
        <div className="mb-3">
          <CodebaseSummaryBar
            summary={mapData.summary}
            generatedAt={mapData.generated_at}
          />
        </div>
      )}

      {/* Filter Controls */}
      <div className="mb-3">
        <CodebaseMapFilters
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          fileExtensions={fileExtensions}
          moduleNames={moduleNames}
          showDependencies={showDependencies}
          onToggleDependencies={() => setShowDependencies((prev) => !prev)}
        />
      </div>

      {/* Main Content: Visualization + Detail Panel */}
      <div
        className="flex rounded-lg border border-white/10 overflow-hidden bg-surface-50"
        style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}
      >
        {/* Canvas Visualization */}
        <div className="flex-grow relative">
          <CodebaseMapVisualization
            nodes={positionedNodes}
            dependencies={mapData?.dependencies || []}
            viewport={viewport}
            onViewportChange={setViewport}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            selectedNode={selectedNode}
            showDependencies={showDependencies}
          />

          {/* Zoom Controls (bottom-left overlay) */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1">
            <button
              onClick={() =>
                setViewport({
                  ...viewport,
                  scale: Math.min(4.0, viewport.scale * 1.2),
                })
              }
              className="w-8 h-8 rounded-lg bg-surface-200/80 border border-white/10
                         text-gray-300 hover:text-white hover:bg-surface-300
                         flex items-center justify-center transition-colors"
              aria-label="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              onClick={() =>
                setViewport({
                  ...viewport,
                  scale: Math.max(0.2, viewport.scale * 0.8),
                })
              }
              className="w-8 h-8 rounded-lg bg-surface-200/80 border border-white/10
                         text-gray-300 hover:text-white hover:bg-surface-300
                         flex items-center justify-center transition-colors"
              aria-label="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
            <button
              onClick={() =>
                setViewport({ offsetX: 0, offsetY: 0, scale: 1.0 })
              }
              className="w-8 h-8 rounded-lg bg-surface-200/80 border border-white/10
                         text-gray-300 hover:text-white hover:bg-surface-300
                         flex items-center justify-center transition-colors text-xs font-mono"
              aria-label="Reset zoom"
            >
              1:1
            </button>
          </div>

          {/* Help text (visible on first load) */}
          {positionedNodes.length > 0 && !selectedNode && (
            <div className="absolute top-4 left-4 text-xs text-gray-600 pointer-events-none">
              Click a node to inspect. Double-click directories to expand.
              Scroll to zoom. Drag to pan.
            </div>
          )}
        </div>

        {/* Detail Panel — slides in on node selection */}
        {/* On mobile, this overlays the canvas */}
        <div
          className={`transition-all duration-200 ${
            selectedNode
              ? 'w-80 opacity-100 max-md:absolute max-md:right-0 max-md:top-0 max-md:h-full max-md:z-10'
              : 'w-0 opacity-0 overflow-hidden'
          }`}
        >
          <NodeDetailPanel
            node={selectedNode}
            pullRequests={mapData?.pull_requests || []}
            onClose={() => selectNode(null)}
          />
        </div>
      </div>
    </div>
  );
}
