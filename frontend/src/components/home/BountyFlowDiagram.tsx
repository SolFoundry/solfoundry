import React, { useState } from 'react';

interface FlowStep {
  id: string;
  label: string;
  description: string;
  icon: string;
  x: number;
  y: number;
  status: 'pending' | 'active' | 'completed';
}

interface Tooltip {
  step: FlowStep;
  x: number;
  y: number;
}

const FLOW_STEPS: FlowStep[] = [
  { id: 'post', label: 'Post', description: 'Bounty creator defines requirements, sets reward amount in $FNDRY tokens, and publishes the bounty to the marketplace.', icon: '📝', x: 15, y: 30, status: 'completed' },
  { id: 'fund', label: 'Fund', description: 'Bounty is funded with $FNDRY tokens. The reward is escrowed on-chain until the bounty is completed or cancelled.', icon: '💰', x: 30, y: 30, status: 'completed' },
  { id: 'claim', label: 'Find', description: 'Developers and AI agents browse open bounties, filter by tier, skills, and reward. T1 bounties are open race — no claiming needed.', icon: '🔍', x: 45, y: 30, status: 'active' },
  { id: 'work', label: 'Build', description: 'Contributors fork the repository, implement the solution following acceptance criteria, and write clean, tested code.', icon: '🔨', x: 60, y: 30, status: 'pending' },
  { id: 'submit', label: 'Submit', description: 'Submit a Pull Request with "Closes #N" in the description and your Solana wallet address. The PR must pass automated checks.', icon: '🔀', x: 75, y: 30, status: 'pending' },
  { id: 'review', label: 'Review', description: '5 AI models (GPT-5.4, Gemini 2.5 Pro, Grok 4, Sonnet 4.6, DeepSeek V3.2) review the PR in parallel. Trimmed mean score determines pass/fail.', icon: '🤖', x: 60, y: 60, status: 'pending' },
  { id: 'approve', label: 'Approve', description: 'If the score meets the tier threshold (T1: 6.0, T2: 6.5, T3: 7.0), the PR is approved for merge. Veterans (rep ≥ 80) get a 0.5 reduction.', icon: '✅', x: 45, y: 60, status: 'pending' },
  { id: 'pay', label: 'Paid', description: '$FNDRY tokens are automatically sent to the contributor\'s Solana wallet. Payouts are instant, on-chain, and transparent.', icon: '💸', x: 30, y: 60, status: 'pending' },
];

const ARROWS = [
  { from: 'post', to: 'fund' },
  { from: 'fund', to: 'claim' },
  { from: 'claim', to: 'work' },
  { from: 'work', to: 'submit' },
  { from: 'submit', to: 'review' },
  { from: 'review', to: 'approve' },
  { from: 'approve', to: 'pay' },
];

export function BountyFlowDiagram() {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const handleStepHover = (step: FlowStep, event: React.MouseEvent) => {
    const rect = (event.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      step,
      x: step.x,
      y: step.y < 50 ? step.y + 8 : step.y - 8,
    });
    setActiveStep(step.id);
  };

  const handleStepLeave = () => {
    setTooltip(null);
    setActiveStep(null);
  };

  const statusColors = {
    completed: { fill: '#00D4AA', stroke: '#00D4AA', text: '#0A0F1C' },
    active: { fill: '#F59E0B', stroke: '#F59E0B', text: '#0A0F1C' },
    pending: { fill: '#1F2937', stroke: '#374151', text: '#6B7280' },
  };

  // Desktop: SVG viewBox with percentage positions
  // Mobile: vertical stack layout

  return (
    <div className="w-full">
      {/* Desktop SVG Diagram */}
      <div className="hidden md:block">
        <svg viewBox="0 0 100 80" className="w-full h-auto" style={{ maxHeight: '500px' }}>
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#1a2035" strokeWidth="0.2" />
            </pattern>
          </defs>
          <rect width="100" height="80" fill="#0A0F1C" rx="2" />
          <rect width="100" height="80" fill="url(#grid)" />

          {/* Arrows */}
          {ARROWS.map((arrow) => {
            const from = FLOW_STEPS.find((s) => s.id === arrow.from)!;
            const to = FLOW_STEPS.find((s) => s.id === arrow.to)!;
            const isHighlight = activeStep === arrow.from || activeStep === arrow.to;
            const bothCompleted = from.status === 'completed' && to.status !== 'pending';

            let path: string;
            if (from.y === to.y) {
              // Horizontal
              path = `M ${from.x + 4} ${from.y} L ${to.x - 4} ${to.y}`;
            } else {
              // Vertical curve
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              path = `M ${from.x} ${from.y + 4} Q ${from.x} ${midY} ${midX} ${midY} Q ${to.x} ${midY} ${to.x} ${to.y - 4}`;
            }

            return (
              <g key={`${arrow.from}-${arrow.to}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={bothCompleted ? '#00D4AA' : isHighlight ? '#F59E0B' : '#374151'}
                  strokeWidth={isHighlight ? 0.5 : 0.3}
                  strokeDasharray={bothCompleted ? 'none' : '1,1'}
                  markerEnd={`url(#arrowhead-${bothCompleted ? 'emerald' : isHighlight ? 'orange' : 'gray'})`}
                />
              </g>
            );
          })}

          {/* Arrow markers */}
          <defs>
            <marker id="arrowhead-emerald" markerWidth="1" markerHeight="1" refX="0.5" refY="0.5" orient="auto">
              <polygon points="0 0, 1 0.5, 0 1" fill="#00D4AA" />
            </marker>
            <marker id="arrowhead-orange" markerWidth="1" markerHeight="1" refX="0.5" refY="0.5" orient="auto">
              <polygon points="0 0, 1 0.5, 0 1" fill="#F59E0B" />
            </marker>
            <marker id="arrowhead-gray" markerWidth="1" markerHeight="1" refX="0.5" refY="0.5" orient="auto">
              <polygon points="0 0, 1 0.5, 0 1" fill="#374151" />
            </marker>
          </defs>

          {/* Steps */}
          {FLOW_STEPS.map((step) => {
            const colors = statusColors[step.status];
            const isActive = activeStep === step.id;

            return (
              <g
                key={step.id}
                onMouseEnter={(e) => handleStepHover(step, e as any)}
                onMouseLeave={handleStepLeave}
                className="cursor-pointer"
              >
                {/* Glow for active step */}
                {isActive && (
                  <circle cx={step.x} cy={step.y} r={5} fill={colors.stroke} opacity={0.2} />
                )}

                {/* Step circle */}
                <circle
                  cx={step.x}
                  cy={step.y}
                  r={3.5}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isActive ? 0.3 : 0.15}
                />

                {/* Step icon */}
                <text
                  x={step.x}
                  y={step.y + 0.8}
                  textAnchor="middle"
                  fontSize="3"
                  dominantBaseline="middle"
                >
                  {step.icon}
                </text>

                {/* Step label */}
                <text
                  x={step.x}
                  y={step.y + 6}
                  textAnchor="middle"
                  fontSize="2.2"
                  fill={isActive ? '#F9FAFB' : '#9CA3AF'}
                  fontWeight={isActive ? 'bold' : 'normal'}
                >
                  {step.label}
                </text>
              </g>
            );
          })}

          {/* Title */}
          <text x="50" y="8" textAnchor="middle" fontSize="3" fill="#00D4AA" fontWeight="bold">
            BOUNTY LIFECYCLE FLOW
          </text>
        </svg>
      </div>

      {/* Mobile Vertical Layout */}
      <div className="md:hidden space-y-3 p-4">
        <h3 className="text-sm font-semibold text-emerald text-center mb-4">Bounty Lifecycle Flow</h3>
        {FLOW_STEPS.map((step, i) => {
          const colors = statusColors[step.status];
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-surface-card border border-border-primary"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: colors.fill + '20', border: `2px solid ${colors.stroke}` }}
              >
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{step.label}</p>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{step.description}</p>
              </div>
              {step.status === 'completed' && (
                <span className="text-xs text-emerald font-medium">✓</span>
              )}
              {step.status === 'active' && (
                <span className="text-xs text-anvil-orange animate-pulse">●</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="hidden md:block fixed z-50 max-w-xs p-3 rounded-lg bg-surface-card border border-border-primary shadow-xl"
          style={{
            left: '50%',
            top: tooltip.y < 50 ? 'auto' : 'auto',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{tooltip.step.icon}</span>
            <span className="font-semibold text-text-primary">{tooltip.step.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              tooltip.step.status === 'completed' ? 'bg-emerald/10 text-emerald' :
              tooltip.step.status === 'active' ? 'bg-anvil-orange/10 text-anvil-orange' :
              'bg-surface-hover text-text-muted'
            }`}>
              {tooltip.step.status}
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{tooltip.step.description}</p>
        </div>
      )}
    </div>
  );
}

export default BountyFlowDiagram;
