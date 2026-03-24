/**
 * CodebaseMapVisualization — Interactive canvas-based codebase graph.
 *
 * Renders the codebase tree as a radial graph on an HTML5 Canvas element
 * with zoom/pan navigation, click-to-expand directories, hover tooltips,
 * dependency arrows between modules, and mobile-friendly touch gestures.
 *
 * Features per spec:
 * - Tree/graph visualization of project structure
 * - Nodes colored by: active bounty, recently modified, test coverage
 * - Click node to see: file info, related bounties, recent PRs
 * - Zoom and pan navigation
 * - Dependency arrows between modules
 * - Loading state for large repos
 *
 * @module components/codebase-map/CodebaseMapVisualization
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
} from 'react';
import type {
  PositionedNode,
  DependencyEdge,
  CodebaseNode,
} from '../../types/codebase-map';
import { NODE_COLORS, MODULE_COLORS } from '../../types/codebase-map';
import {
  computeDependencyLines,
  formatFileSize,
} from '../../data/codebaseMapTransformer';
import type { ViewportState } from '../../hooks/useCodebaseMap';

/** Props for the CodebaseMapVisualization component. */
export interface CodebaseMapVisualizationProps {
  /** Positioned nodes computed by the layout algorithm. */
  nodes: PositionedNode[];
  /** Module dependency edges from the API. */
  dependencies: DependencyEdge[];
  /** Current viewport state (zoom/pan). */
  viewport: ViewportState;
  /** Callback to update viewport state. */
  onViewportChange: (viewport: ViewportState) => void;
  /** Callback when a node is clicked (for selection/expansion). */
  onNodeClick: (node: CodebaseNode) => void;
  /** Callback when a directory node is double-clicked (for expansion toggle). */
  onNodeDoubleClick: (path: string) => void;
  /** Currently selected node (highlighted). */
  selectedNode: CodebaseNode | null;
  /** Whether to show dependency arrows between modules. */
  showDependencies: boolean;
}

/** Minimum and maximum zoom scale bounds. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 4.0;

/**
 * Draw an arrow head at the end of a line.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param fromX - Line start X coordinate.
 * @param fromY - Line start Y coordinate.
 * @param toX - Line end X coordinate (arrow tip).
 * @param toY - Line end Y coordinate (arrow tip).
 * @param headLength - Length of the arrow head in pixels.
 */
function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLength: number = 8,
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Interactive canvas visualization of the codebase tree.
 *
 * Handles all rendering, mouse/touch interactions, zoom/pan gestures,
 * and tooltip display. Uses requestAnimationFrame for smooth rendering.
 */
export function CodebaseMapVisualization({
  nodes,
  dependencies,
  viewport,
  onViewportChange,
  onNodeClick,
  onNodeDoubleClick,
  selectedNode,
  showDependencies,
}: CodebaseMapVisualizationProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number; distance: number }>({
    x: 0,
    y: 0,
    distance: 0,
  });
  const animFrameRef = useRef<number>(0);

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(
      viewport.offsetX + canvasSize.width / 2,
      viewport.offsetY + canvasSize.height / 2,
    );
    ctx.scale(viewport.scale, viewport.scale);
    ctx.translate(-canvasSize.width / 2, -canvasSize.height / 2);

    // Draw dependency arrows first (behind nodes)
    if (showDependencies) {
      const lines = computeDependencyLines(dependencies, nodes);
      ctx.strokeStyle = 'rgba(153, 69, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      for (const line of lines) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = 'rgba(153, 69, 255, 0.3)';
        drawArrowHead(ctx, line.x1, line.y1, line.x2, line.y2, 6);
      }
      ctx.setLineDash([]);
    }

    // Draw connections from parent to child nodes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (const node of nodes) {
      if (node.depth === 0) continue;
      // Find parent node
      const parentPath =
        node.node.path.split('/').slice(0, -1).join('/') || '';
      const parent = nodes.find(
        (n) =>
          n.id === parentPath ||
          (node.depth === 1 && n.depth === 0),
      );
      if (parent) {
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = selectedNode?.path === node.node.path;
      const isHovered = hoveredNode?.id === node.id;
      const opacity = node.matchesFilter ? 1.0 : 0.25;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.globalAlpha = opacity;

      // Fill
      if (isSelected) {
        ctx.fillStyle = NODE_COLORS.selected;
      } else {
        ctx.fillStyle = node.color;
      }
      ctx.fill();

      // Border for highlighted states
      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? NODE_COLORS.selected : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Bounty indicator (small green dot)
      if (node.node.has_active_bounty && node.radius >= 6) {
        ctx.beginPath();
        ctx.arc(
          node.x + node.radius * 0.7,
          node.y - node.radius * 0.7,
          3,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = NODE_COLORS.activeBounty;
        ctx.globalAlpha = 1.0;
        ctx.fill();
      }

      // Labels for larger nodes
      if (node.radius >= 10 && viewport.scale >= 0.6) {
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(9, Math.min(12, node.radius * 0.8))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label =
          node.node.name.length > 12
            ? node.node.name.slice(0, 10) + '..'
            : node.node.name;
        ctx.fillText(label, node.x, node.y + node.radius + 14);
      }

      // File count badge for directories
      if (
        node.node.node_type === 'directory' &&
        node.node.file_count &&
        node.node.file_count > 0 &&
        node.radius >= 8
      ) {
        ctx.globalAlpha = opacity * 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(node.node.file_count), node.x, node.y);
      }

      ctx.globalAlpha = 1.0;
    }

    // Draw legend in fixed position (unaffected by viewport)
    ctx.restore();
    drawLegend(ctx, canvasSize.width, canvasSize.height);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    nodes,
    dependencies,
    viewport,
    canvasSize,
    selectedNode,
    hoveredNode,
    showDependencies,
  ]);

  /**
   * Convert screen coordinates to canvas/world coordinates.
   *
   * @param screenX - Screen X coordinate (from mouse event).
   * @param screenY - Screen Y coordinate (from mouse event).
   * @returns World coordinates after viewport transformation.
   */
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: screenX, y: screenY };

      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Reverse viewport transform
      const worldX =
        (canvasX - canvasSize.width / 2 - viewport.offsetX) / viewport.scale +
        canvasSize.width / 2;
      const worldY =
        (canvasY - canvasSize.height / 2 - viewport.offsetY) / viewport.scale +
        canvasSize.height / 2;

      return { x: worldX, y: worldY };
    },
    [viewport, canvasSize],
  );

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      isDraggingRef.current = true;
      lastMouseRef.current = { x: event.clientX, y: event.clientY };
    },
    [],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (isDraggingRef.current) {
        const dx = event.clientX - lastMouseRef.current.x;
        const dy = event.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: event.clientX, y: event.clientY };
        onViewportChange({
          ...viewport,
          offsetX: viewport.offsetX + dx,
          offsetY: viewport.offsetY + dy,
        });
      } else {
        // Hover detection
        const world = screenToWorld(event.clientX, event.clientY);
        const hit = nodes.find((n) => {
          const dx = world.x - n.x;
          const dy = world.y - n.y;
          return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius, 8);
        });
        setHoveredNode(hit || null);
        if (hit) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        }
      }
    },
    [viewport, onViewportChange, screenToWorld, nodes],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const world = screenToWorld(event.clientX, event.clientY);
      const hit = nodes.find((n) => {
        const dx = world.x - n.x;
        const dy = world.y - n.y;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius, 8);
      });
      if (hit) {
        onNodeClick(hit.node);
      }
    },
    [screenToWorld, nodes, onNodeClick],
  );

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const world = screenToWorld(event.clientX, event.clientY);
      const hit = nodes.find((n) => {
        const dx = world.x - n.x;
        const dy = world.y - n.y;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(n.radius, 8);
      });
      if (hit && hit.node.node_type === 'directory') {
        onNodeDoubleClick(hit.node.path);
      }
    },
    [screenToWorld, nodes, onNodeDoubleClick],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, viewport.scale * scaleFactor),
      );
      onViewportChange({ ...viewport, scale: newScale });
    },
    [viewport, onViewportChange],
  );

  // Touch event handlers for mobile
  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLCanvasElement>) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY, distance: 0 };
        isDraggingRef.current = true;
      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchRef.current = {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          distance: Math.sqrt(dx * dx + dy * dy),
        };
      }
    },
    [],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (event.touches.length === 1 && isDraggingRef.current) {
        const touch = event.touches[0];
        const dx = touch.clientX - lastTouchRef.current.x;
        const dy = touch.clientY - lastTouchRef.current.y;
        lastTouchRef.current = { ...lastTouchRef.current, x: touch.clientX, y: touch.clientY };
        onViewportChange({
          ...viewport,
          offsetX: viewport.offsetX + dx,
          offsetY: viewport.offsetY + dy,
        });
      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (lastTouchRef.current.distance > 0) {
          const scaleFactor = distance / lastTouchRef.current.distance;
          const newScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, viewport.scale * scaleFactor),
          );
          onViewportChange({ ...viewport, scale: newScale });
        }
        lastTouchRef.current = {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          distance,
        };
      }
    },
    [viewport, onViewportChange],
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[400px]"
      data-testid="codebase-map-canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label="Interactive codebase map visualization showing repository structure as a radial graph"
      />

      {/* Hover tooltip */}
      {hoveredNode && !isDraggingRef.current && (
        <div
          className="fixed z-50 pointer-events-none bg-surface-100 border border-white/10 rounded-lg
                     px-3 py-2 shadow-xl max-w-xs"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
          }}
          data-testid="codebase-map-tooltip"
        >
          <p className="text-sm font-medium text-white truncate">
            {hoveredNode.node.name}
          </p>
          <p className="text-xs text-gray-400 truncate">{hoveredNode.node.path}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {hoveredNode.node.node_type === 'directory'
                ? `${hoveredNode.node.file_count || 0} files`
                : formatFileSize(hoveredNode.node.size || 0)}
            </span>
            {hoveredNode.node.has_active_bounty && (
              <span className="text-xs text-[#14F195] font-medium">
                Bounty active
              </span>
            )}
            {hoveredNode.node.recently_modified && (
              <span className="text-xs text-[#9945FF] font-medium">
                Recently modified
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Draw the color legend on the canvas (fixed position, not affected by viewport).
 *
 * @param ctx - Canvas 2D rendering context.
 * @param width - Canvas width in CSS pixels.
 * @param height - Canvas height in CSS pixels.
 */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const legendItems = [
    { color: NODE_COLORS.activeBounty, label: 'Active Bounty' },
    { color: NODE_COLORS.recentlyModified, label: 'Recently Modified' },
    { color: NODE_COLORS.hasTestCoverage, label: 'Has Tests' },
    { color: NODE_COLORS.defaultFile, label: 'File' },
    { color: NODE_COLORS.defaultDirectory, label: 'Directory' },
  ];

  const padding = 12;
  const itemHeight = 18;
  const legendWidth = 140;
  const legendHeight = padding * 2 + legendItems.length * itemHeight;
  const legendX = width - legendWidth - padding;
  const legendY = height - legendHeight - padding;

  // Background
  ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 6);
  ctx.fill();
  ctx.stroke();

  // Items
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  legendItems.forEach((item, index) => {
    const y = legendY + padding + index * itemHeight + itemHeight / 2;

    // Color swatch
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(legendX + padding + 5, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = '#cccccc';
    ctx.fillText(item.label, legendX + padding + 16, y);
  });
}

export default CodebaseMapVisualization;
