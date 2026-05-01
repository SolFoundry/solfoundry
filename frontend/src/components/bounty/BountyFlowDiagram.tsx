import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Users,
  Code2,
  GitPullRequest,
  Eye,
  Wallet,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';

interface FlowStage {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const FLOW_STAGES: FlowStage[] = [
  {
    id: 'post',
    icon: FileText,
    title: 'Post Bounty',
    description: 'Creator defines requirements and rewards',
    details: [
      'Write clear title and description',
      'Set reward amount (USDC or FNDRY)',
      'Define acceptance criteria',
      'AI suggests difficulty tier (T1/T2/T3)',
      'Link GitHub issue for context',
    ],
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
  },
  {
    id: 'claim',
    icon: Users,
    title: 'Claim & Qualify',
    description: 'Contributors claim and prove eligibility',
    details: [
      'Click "Claim Bounty" to reserve',
      'T1: Open to all contributors',
      'T2: Requires 4+ merged T1 bounties',
      'T3: Requires 3+ merged T2 bounties',
      'Race mode: first claim wins',
    ],
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
  },
  {
    id: 'work',
    icon: Code2,
    title: 'Develop Solution',
    description: 'Build and test the implementation',
    details: [
      'Fork the target repository',
      'Create feature branch',
      'Implement according to criteria',
      'Write tests for coverage',
      'Follow project coding standards',
    ],
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
  },
  {
    id: 'submit',
    icon: GitPullRequest,
    title: 'Submit PR',
    description: 'Open pull request on SolFoundry',
    details: [
      'Push to your fork',
      'Create PR referencing bounty issue',
      'Include demo/screenshots',
      'Add test results',
      'Link to original GitHub issue',
    ],
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
  },
  {
    id: 'review',
    icon: Eye,
    title: 'AI + Human Review',
    description: 'Multi-LLM scoring and maintainer review',
    details: [
      '3 LLMs score independently (0-10)',
      'Pass threshold: 7.0 average',
      'Maintainer final approval',
      'Feedback loop for revisions',
      'Automated security scanning',
    ],
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
  },
  {
    id: 'payment',
    icon: Wallet,
    title: 'Receive Payment',
    description: 'Reward distributed automatically',
    details: [
      'Funds released from escrow',
      'Payment in chosen token (USDC/FNDRY)',
      'Contributor reputation increases',
      'Bounty marked as completed',
      'Leaderboard updated',
    ],
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/30',
  },
];

const STAGE_POSITIONS = [
  { x: 100, y: 120 },
  { x: 300, y: 60 },
  { x: 500, y: 120 },
  { x: 500, y: 260 },
  { x: 300, y: 320 },
  { x: 100, y: 260 },
];

interface TooltipProps {
  stage: FlowStage;
  position: { x: number; y: number };
  onClose: () => void;
}

function Tooltip({ stage, position, onClose }: TooltipProps) {
  const Icon = stage.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`absolute z-50 w-72 ${stage.bgColor} ${stage.borderColor} border rounded-xl p-4 backdrop-blur-sm shadow-xl`}
      style={{
        left: Math.min(position.x + 40, 500),
        top: Math.min(position.y - 20, 200),
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${stage.color}`}>
          <Icon size={18} />
          <span className="font-semibold text-sm">{stage.title}</span>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-text-muted text-xs mb-3">{stage.description}</p>
      <ul className="space-y-1">
        {stage.details.map((detail, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
            <span className={`${stage.color} mt-0.5`}>•</span>
            {detail}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

interface FlowNodeProps {
  stage: FlowStage;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

function FlowNode({ stage, index, isActive, onClick }: FlowNodeProps) {
  const Icon = stage.icon;
  const pos = STAGE_POSITIONS[index];

  return (
    <motion.g
      onClick={onClick}
      className="cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Node circle */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={32}
        className={`${isActive ? stage.borderColor : 'border-gray-600/30'} ${stage.bgColor} fill-current`}
        fill={isActive ? `${stage.color.replace('text-', '')}15` : 'rgba(30,30,40,0.8)'}
        stroke="currentColor"
        strokeWidth={isActive ? 2 : 1}
        style={{ color: isActive ? stage.color.replace('text-', '') : '#4B5563' }}
      />
      {/* Icon */}
      <foreignObject x={pos.x - 14} y={pos.y - 14} width={28} height={28}>
        <div className={`flex items-center justify-center ${stage.color}`}>
          <Icon size={20} />
        </div>
      </foreignObject>
      {/* Label */}
      <text
        x={pos.x}
        y={pos.y + 48}
        textAnchor="middle"
        className="fill-gray-300 text-xs font-medium"
        fontSize="11"
      >
        {stage.title}
      </text>
      {/* Step number */}
      <circle cx={pos.x + 22} cy={pos.y - 22} r={10} fill="#1a1a2e" stroke={isActive ? stage.color.replace('text-', '') : '#4B5563'} strokeWidth="1" />
      <text
        x={pos.x + 22}
        y={pos.y - 18}
        textAnchor="middle"
        className="fill-gray-400"
        fontSize="9"
        fontWeight="bold"
      >
        {index + 1}
      </text>
    </motion.g>
  );
}

export function BountyFlowDiagram({ compact = false }: { compact?: boolean }) {
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  const handleStageClick = useCallback((index: number) => {
    setActiveStage((prev) => (prev === index ? null : index));
  }, []);

  const handleCloseTooltip = useCallback(() => {
    setActiveStage(null);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {FLOW_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.id}>
              {i > 0 && <ChevronRight size={14} className="text-gray-500" />}
              <button
                onClick={() => handleStageClick(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeStage === i
                    ? `${stage.bgColor} ${stage.color} ${stage.borderColor} border`
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                <Icon size={14} />
                {stage.title}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* SVG Diagram */}
      <svg
        viewBox="0 0 600 400"
        className="w-full max-w-2xl mx-auto"
        role="img"
        aria-label="Bounty lifecycle flow diagram"
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill="url(#grid)" />

        {/* Connection lines */}
        {FLOW_STAGES.map((_, i) => {
          const from = STAGE_POSITIONS[i];
          const to = STAGE_POSITIONS[(i + 1) % FLOW_STAGES.length];
          const isActive = activeStage === i || activeStage === (i + 1) % FLOW_STAGES.length;

          return (
            <motion.path
              key={`line-${i}`}
              d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 20} ${to.x} ${to.y}`}
              fill="none"
              stroke={isActive ? 'url(#flowGradient)' : '#374151'}
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeDasharray={isActive ? 'none' : '4 4'}
              className="transition-all duration-300"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
            />
          );
        })}

        {/* Flow direction arrows */}
        {FLOW_STAGES.map((_, i) => {
          const from = STAGE_POSITIONS[i];
          const to = STAGE_POSITIONS[(i + 1) % FLOW_STAGES.length];
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2 - 20;

          return (
            <g key={`arrow-${i}`} opacity={activeStage === i || activeStage === (i + 1) % FLOW_STAGES.length ? 1 : 0.3}>
              <polygon
                points={`${midX},${midY - 5} ${midX + 6},${midY + 3} ${midX - 6},${midY + 3}`}
                fill="#8B5CF6"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {FLOW_STAGES.map((stage, i) => (
          <FlowNode
            key={stage.id}
            stage={stage}
            index={i}
            isActive={activeStage === i || hoveredStage === i}
            onClick={() => handleStageClick(i)}
            onMouseEnter={() => setHoveredStage(i)}
            onMouseLeave={() => setHoveredStage(null)}
          />
        ))}

        {/* Title */}
        <text x="300" y="30" textAnchor="middle" className="fill-white text-lg font-bold">
          Bounty Lifecycle Flow
        </text>
        <text x="300" y="48" textAnchor="middle" className="fill-gray-400 text-xs">
          Click any stage to see detailed information
        </text>
      </svg>

      {/* Tooltip overlay */}
      <AnimatePresence>
        {activeStage !== null && (
          <Tooltip
            stage={FLOW_STAGES[activeStage]}
            position={STAGE_POSITIONS[activeStage]}
            onClose={handleCloseTooltip}
          />
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-700/50">
        {FLOW_STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <button
              key={stage.id}
              onClick={() => handleStageClick(FLOW_STAGES.indexOf(stage))}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                activeStage === FLOW_STAGES.indexOf(stage) ? stage.color : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={12} />
              {stage.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BountyFlowDiagram;
