import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FlowStage {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  color: string;
}

const FLOW_STAGES: FlowStage[] = [
  {
    id: 'post',
    label: 'Post',
    detail: 'A maintainer publishes a scoped GitHub issue with reward, tier, and acceptance criteria.',
    x: 80,
    y: 112,
    color: '#34d399',
  },
  {
    id: 'claim',
    label: 'Claim',
    detail: 'A contributor claims the bounty and confirms they are actively working on the issue.',
    x: 240,
    y: 112,
    color: '#22d3ee',
  },
  {
    id: 'work',
    label: 'Work',
    detail: 'The fix is built in a fork or feature branch with focused code and tests.',
    x: 400,
    y: 112,
    color: '#a78bfa',
  },
  {
    id: 'submit',
    label: 'Submit',
    detail: 'The contributor opens a pull request that links the bounty issue and documents verification.',
    x: 560,
    y: 112,
    color: '#f472b6',
  },
  {
    id: 'review',
    label: 'Review',
    detail: 'Automated checks, LLM review, and maintainers evaluate correctness before approval.',
    x: 720,
    y: 112,
    color: '#fbbf24',
  },
  {
    id: 'payment',
    label: 'Payment',
    detail: 'Approved work releases the bounty reward to the contributor wallet or payout account.',
    x: 880,
    y: 112,
    color: '#fb7185',
  },
];

export function BountyFlowDiagram() {
  const [activeStageId, setActiveStageId] = useState(FLOW_STAGES[0].id);
  const activeIndex = FLOW_STAGES.findIndex((stage) => stage.id === activeStageId);
  const activeStage = FLOW_STAGES[Math.max(activeIndex, 0)];

  const progressWidth = useMemo(() => {
    if (activeIndex <= 0) {
      return 0;
    }

    const first = FLOW_STAGES[0];
    const active = FLOW_STAGES[activeIndex];
    return active.x - first.x;
  }, [activeIndex]);

  return (
    <section className="mb-14" aria-labelledby="bounty-flow-heading">
      <div className="mb-6 text-center">
        <h2 id="bounty-flow-heading" className="font-display text-2xl font-bold text-text-primary">
          Bounty Lifecycle
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Explore each handoff from issue creation to contributor payout.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-forge-900 p-4 md:p-6 overflow-hidden">
        <svg
          role="img"
          aria-label="Interactive bounty lifecycle flow diagram"
          viewBox="0 0 960 260"
          className="w-full min-h-[220px]"
          data-testid="bounty-flow-svg"
        >
          <defs>
            <filter id="flow-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line x1="80" y1="112" x2="880" y2="112" stroke="rgba(148, 163, 184, 0.28)" strokeWidth="6" strokeLinecap="round" />
          <motion.line
            x1="80"
            y1="112"
            x2={80 + progressWidth}
            y2="112"
            stroke="url(#active-flow-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            initial={false}
            animate={{ x2: 80 + progressWidth }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />

          <linearGradient id="active-flow-gradient" x1="80" y1="112" x2="880" y2="112" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="0.45" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>

          {FLOW_STAGES.map((stage, index) => {
            const isActive = stage.id === activeStage.id;
            const isComplete = index < activeIndex;

            return (
              <g
                key={stage.id}
                role="button"
                tabIndex={0}
                aria-label={`${stage.label}: ${stage.detail}`}
                data-testid={`flow-stage-${stage.id}`}
                onMouseEnter={() => setActiveStageId(stage.id)}
                onFocus={() => setActiveStageId(stage.id)}
                onClick={() => setActiveStageId(stage.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveStageId(stage.id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <motion.circle
                  cx={stage.x}
                  cy={stage.y}
                  r={isActive ? 32 : 25}
                  fill={isActive || isComplete ? stage.color : '#111827'}
                  stroke={stage.color}
                  strokeWidth={isActive ? 5 : 3}
                  filter={isActive ? 'url(#flow-glow)' : undefined}
                  initial={false}
                  animate={{ r: isActive ? 32 : 25, opacity: isComplete || isActive ? 1 : 0.78 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                />
                <text
                  x={stage.x}
                  y={stage.y + 5}
                  textAnchor="middle"
                  className="fill-forge-950 font-mono text-sm font-bold pointer-events-none"
                >
                  {index + 1}
                </text>
                <text
                  x={stage.x}
                  y="178"
                  textAnchor="middle"
                  className="fill-text-primary text-sm font-semibold pointer-events-none"
                >
                  {stage.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" aria-label="Bounty flow stage selector">
          {FLOW_STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              aria-label={`Show ${stage.label} stage`}
              onMouseEnter={() => setActiveStageId(stage.id)}
              onFocus={() => setActiveStageId(stage.id)}
              onClick={() => setActiveStageId(stage.id)}
              aria-pressed={stage.id === activeStage.id}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                stage.id === activeStage.id
                  ? 'border-emerald bg-emerald-bg text-emerald'
                  : 'border-border bg-forge-800 text-text-secondary hover:text-text-primary'
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mt-5 rounded-lg border border-border bg-forge-800 p-4"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs uppercase tracking-wider text-text-muted">Current stage</p>
            <h3 className="mt-1 font-sans text-lg font-semibold text-text-primary">{activeStage.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{activeStage.detail}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
