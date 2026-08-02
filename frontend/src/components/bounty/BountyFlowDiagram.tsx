import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Types ── */
interface Stage {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  lightColor: string;
  x: number;
  y: number;
}

const STAGES: Stage[] = [
  {
    id: 'post',
    label: 'Post',
    description: 'A bounty sponsor creates a new bounty with a reward, description, and acceptance criteria.',
    icon: '📋',
    color: '#3B82F6',
    lightColor: '#DBEAFE',
    x: 0,
    y: 0,
  },
  {
    id: 'claim',
    label: 'Claim',
    description: 'A contributor claims the bounty, signaling intent to work on it. This may require staking collateral.',
    icon: '✋',
    color: '#8B5CF6',
    lightColor: '#EDE9FE',
    x: 120,
    y: 0,
  },
  {
    id: 'work',
    label: 'Work',
    description: 'The contributor works on the bounty, implementing the required features or fixes in their fork.',
    icon: '⚒️',
    color: '#F59E0B',
    lightColor: '#FEF3C7',
    x: 240,
    y: 0,
  },
  {
    id: 'submit',
    label: 'Submit',
    description: 'The contributor submits their work via a pull request, attaching evidence and a completion summary.',
    icon: '📤',
    color: '#10B981',
    lightColor: '#D1FAE5',
    x: 360,
    y: 0,
  },
  {
    id: 'review',
    label: 'Review',
    description: 'The sponsor reviews the submission. They can approve, request changes, or reject with reasoning.',
    icon: '🔍',
    color: '#EC4899',
    lightColor: '#FCE7F3',
    x: 480,
    y: 0,
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Once approved, the bounty reward is released to the contributor. The bounty is marked as completed.',
    icon: '💰',
    color: '#22C55E',
    lightColor: '#DCFCE7',
    x: 600,
    y: 0,
  },
];

/* ── Arrow path between two points ── */
function arrowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const controlOffset = 40;
  // For horizontal flow, add a slight curve
  return `M${x1},${y1} C${x1 + controlOffset},${y1} ${x2 - controlOffset},${y2} ${x2},${y2}`;
}

/* ── Arrowhead marker ── */
const ArrowMarker = () => (
  <defs>
    <marker
      id="arrowhead"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
    </marker>
  </defs>
);

/* ── Stage Node ── */
interface StageNodeProps {
  stage: Stage;
  index: number;
  total: number;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

const StageNode: React.FC<StageNodeProps> = ({ stage, activeId, onHover, onClick }) => {
  const isActive = activeId === stage.id;

  // Calculate connector positions
  const nodeWidth = 80;
  const nodeHeight = 80;

  return (
    <g
      className="cursor-pointer"
      onMouseEnter={() => onHover(stage.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(stage.id)}
    >
      {/* Glow when active */}
      {isActive && (
        <circle
          cx={stage.x + nodeWidth / 2}
          cy={stage.y + nodeHeight / 2}
          r={50}
          fill="none"
          stroke={stage.color}
          strokeWidth={3}
          opacity={0.3}
        >
          <animate
            attributeName="r"
            from={42}
            to={55}
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from={0.3}
            to={0}
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Node background */}
      <rect
        x={stage.x}
        y={stage.y}
        width={nodeWidth}
        height={nodeHeight}
        rx={16}
        ry={16}
        fill={isActive ? stage.color : stage.lightColor}
        stroke={isActive ? stage.color : stage.color}
        strokeWidth={2}
        className="transition-all duration-300"
      />

      {/* Icon */}
      <text
        x={stage.x + nodeWidth / 2}
        y={stage.y + nodeHeight / 2 - 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={24}
      >
        {stage.icon}
      </text>

      {/* Label */}
      <text
        x={stage.x + nodeWidth / 2}
        y={stage.y + nodeHeight + 18}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-semibold fill-gray-700"
        fontSize={13}
      >
        {stage.label}
      </text>
    </g>
  );
};

/* ── Tooltip ── */
interface TooltipProps {
  stage: Stage | null;
}

const Tooltip: React.FC<TooltipProps> = ({ stage }) => {
  return (
    <AnimatePresence>
      {stage && (
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="absolute left-1/2 -translate-x-1/2 mt-4 w-72 p-4 rounded-xl shadow-lg border border-gray-100 bg-white z-10"
          style={{ borderTop: `3px solid ${stage.color}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{stage.icon}</span>
            <span className="font-bold text-gray-900">{stage.label} Stage</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{stage.description}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Mobile List View ── */
const MobileListView: React.FC<{
  stages: Stage[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}> = ({ stages, activeId, onHover, onClick }) => {
  return (
    <div className="space-y-2 sm:hidden">
      {stages.map((stage, index) => {
        const isActive = activeId === stage.id;
        return (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
            style={{
              backgroundColor: isActive ? stage.lightColor : '#F9FAFB',
              borderLeft: `3px solid ${isActive ? stage.color : '#E5E7EB'}`,
            }}
            onMouseEnter={() => onHover(stage.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(stage.id)}
          >
            <span className="text-2xl">{stage.icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">{stage.label}</div>
              {isActive && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="text-xs text-gray-500 mt-1"
                >
                  {stage.description}
                </motion.p>
              )}
            </div>
            {index < stages.length - 1 && (
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

/* ── Main Component ── */
const BountyFlowDiagram: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const svgWidth = 680;
  const svgHeight = 130;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Desktop SVG Diagram */}
      <div className="hidden sm:block relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto"
          aria-label="Bounty lifecycle flow diagram"
          role="img"
        >
          <ArrowMarker />

          {/* Connection lines */}
          {STAGES.slice(0, -1).map((stage, i) => {
            const next = STAGES[i + 1];
            const x1 = stage.x + 80;
            const y1 = stage.y + 40;
            const x2 = next.x;
            const y2 = next.y + 40;
            return (
              <path
                key={`arrow-${stage.id}-${next.id}`}
                d={arrowPath(x1, y1, x2, y2)}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
                className="transition-colors duration-300"
                style={{
                  stroke: activeId === stage.id || activeId === next.id ? stage.color : '#CBD5E1',
                  strokeWidth: activeId === stage.id || activeId === next.id ? 3 : 2,
                }}
              />
            );
          })}

          {/* Stage nodes */}
          {STAGES.map((stage, index) => (
            <StageNode
              key={stage.id}
              stage={stage}
              index={index}
              total={STAGES.length}
              activeId={activeId}
              onHover={setActiveId}
              onClick={setActiveId}
            />
          ))}
        </svg>

        {/* Tooltip */}
        <Tooltip stage={STAGES.find((s) => s.id === activeId) ?? null} />
      </div>

      {/* Mobile List View */}
      <MobileListView
        stages={STAGES}
        activeId={activeId}
        onHover={setActiveId}
        onClick={setActiveId}
      />
    </div>
  );
};

export default BountyFlowDiagram;