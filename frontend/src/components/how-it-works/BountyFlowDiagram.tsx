import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  HandCoins,
  Wrench,
  GitPullRequest,
  Bot,
  Coins,
  CheckCircle2,
} from 'lucide-react';

type StageId = 'post' | 'claim' | 'work' | 'submit' | 'review' | 'payment';

interface FlowStage {
  id: StageId;
  title: string;
  short: string;
  description: string;
  detail: string;
  icon: React.ElementType;
  x: number;
  y: number;
  color: 'emerald' | 'purple' | 'magenta';
}

const STAGES: FlowStage[] = [
  {
    id: 'post',
    title: 'Post',
    short: 'Creator publishes bounty',
    description: 'A creator defines the task, reward, and acceptance criteria.',
    detail: 'Reward, scope, tier, and timeline are posted so contributors can evaluate whether the bounty is worth pursuing.',
    icon: Briefcase,
    x: 110,
    y: 130,
    color: 'emerald',
  },
  {
    id: 'claim',
    title: 'Claim',
    short: 'Contributor locks in intent',
    description: 'A contributor claims or starts work on the bounty.',
    detail: 'This stage makes ownership visible and reduces duplicate effort, especially on gated or claim-based bounties.',
    icon: HandCoins,
    x: 280,
    y: 60,
    color: 'purple',
  },
  {
    id: 'work',
    title: 'Work',
    short: 'Build and iterate',
    description: 'The contributor implements the fix, feature, or creative asset.',
    detail: 'Development happens in a fork or working branch, with tests, polish, and spec alignment handled before submission.',
    icon: Wrench,
    x: 460,
    y: 130,
    color: 'emerald',
  },
  {
    id: 'submit',
    title: 'Submit',
    short: 'Open the PR',
    description: 'The contributor submits a pull request linked to the bounty.',
    detail: 'A clean PR body, wallet address, screenshots, docs, and tests improve merge odds and payout readiness.',
    icon: GitPullRequest,
    x: 630,
    y: 60,
    color: 'magenta',
  },
  {
    id: 'review',
    title: 'Review',
    short: 'AI + maintainer validation',
    description: 'Automated and human review confirm quality and scope match.',
    detail: 'Review can include code quality, test pass status, UX validation, and maintainer feedback before approval.',
    icon: Bot,
    x: 810,
    y: 130,
    color: 'purple',
  },
  {
    id: 'payment',
    title: 'Payment',
    short: 'Reward released',
    description: 'Approved work triggers token or stablecoin payout.',
    detail: 'Once the bounty is accepted, reward release is routed to the contributor wallet attached to the submission.',
    icon: Coins,
    x: 980,
    y: 60,
    color: 'emerald',
  },
];

const COLOR_CLASSES = {
  emerald: {
    ring: 'stroke-emerald',
    fill: 'fill-emerald-bg',
    border: 'stroke-emerald',
    text: 'text-emerald',
    glow: 'drop-shadow-[0_0_16px_rgba(0,230,118,0.25)]',
    panel: 'border-emerald-border bg-emerald-bg/60',
  },
  purple: {
    ring: 'stroke-purple',
    fill: 'fill-purple-bg',
    border: 'stroke-purple',
    text: 'text-purple-light',
    glow: 'drop-shadow-[0_0_16px_rgba(124,58,237,0.25)]',
    panel: 'border-purple-border bg-purple-bg/60',
  },
  magenta: {
    ring: 'stroke-magenta',
    fill: 'fill-magenta-bg',
    border: 'stroke-magenta',
    text: 'text-magenta',
    glow: 'drop-shadow-[0_0_16px_rgba(224,64,251,0.25)]',
    panel: 'border-magenta-border bg-magenta-bg/60',
  },
} as const;

const FLOW_ORDER: StageId[] = ['post', 'claim', 'work', 'submit', 'review', 'payment'];

function getStageIndex(id: StageId) {
  return FLOW_ORDER.indexOf(id);
}

function getPath(a: FlowStage, b: FlowStage) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const controlOffset = Math.max(50, Math.abs(dx) * 0.28);
  return `M ${a.x} ${a.y} C ${a.x + controlOffset} ${a.y + dy * 0.1}, ${b.x - controlOffset} ${b.y - dy * 0.1}, ${b.x} ${b.y}`;
}

export function BountyFlowDiagram() {
  const [activeStage, setActiveStage] = useState<StageId>('review');
  const activeIndex = getStageIndex(activeStage);

  const active = useMemo(() => STAGES.find((stage) => stage.id === activeStage) ?? STAGES[0], [activeStage]);

  return (
    <section className="rounded-2xl border border-border bg-forge-900/70 overflow-hidden">
      <div className="border-b border-border px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">Interactive Flow</div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl text-text-primary">Bounty Lifecycle Diagram</h2>
          <p className="mt-2 text-sm md:text-base text-text-secondary max-w-2xl">
            Follow the full path from bounty creation to payout. Hover, tap, or use the stage buttons to inspect each step.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-forge-850 px-3 py-2 text-xs font-mono text-text-muted w-fit">
          <CheckCircle2 className="w-4 h-4 text-emerald" />
          Responsive SVG + tooltips + motion
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1120px]">
            <svg
              viewBox="0 0 1100 260"
              className="w-full h-auto"
              role="img"
              aria-label="Interactive bounty flow diagram showing post, claim, work, submit, review, and payment stages"
            >
              <defs>
                <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00E676" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#7C3AED" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#E040FB" stopOpacity="0.9" />
                </linearGradient>
                <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {STAGES.slice(0, -1).map((stage, index) => {
                const next = STAGES[index + 1];
                const isActive = index < activeIndex;
                const isCurrentSegment = index === activeIndex - 1;
                return (
                  <g key={`${stage.id}-${next.id}`}>
                    <path
                      d={getPath(stage, next)}
                      fill="none"
                      stroke="#2A2A3A"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="6 10"
                    />
                    <motion.path
                      d={getPath(stage, next)}
                      fill="none"
                      stroke="url(#flowLine)"
                      strokeWidth={isCurrentSegment ? 5 : 4}
                      strokeLinecap="round"
                      initial={false}
                      animate={{ pathLength: isActive || isCurrentSegment ? 1 : 0.18, opacity: isActive || isCurrentSegment ? 1 : 0.25 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      filter={isCurrentSegment ? 'url(#softGlow)' : undefined}
                    />
                  </g>
                );
              })}

              {STAGES.map((stage, index) => {
                const isActive = stage.id === activeStage;
                const isComplete = index < activeIndex;
                const Icon = stage.icon;
                const color = COLOR_CLASSES[stage.color];

                return (
                  <g key={stage.id}>
                    <motion.g
                      initial={false}
                      animate={{ scale: isActive ? 1.08 : 1, opacity: isActive || isComplete ? 1 : 0.9 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      style={{ transformOrigin: `${stage.x}px ${stage.y}px`, cursor: 'pointer' }}
                      onMouseEnter={() => setActiveStage(stage.id)}
                      onClick={() => setActiveStage(stage.id)}
                    >
                      <circle
                        cx={stage.x}
                        cy={stage.y}
                        r={isActive ? 42 : 36}
                        className={`${color.fill} ${color.border}`}
                        strokeWidth={isActive ? 3 : 2}
                        filter={isActive ? 'url(#softGlow)' : undefined}
                      />
                      <circle
                        cx={stage.x}
                        cy={stage.y}
                        r={isComplete ? 48 : 46}
                        fill="none"
                        className={color.ring}
                        strokeWidth="1.5"
                        strokeOpacity={isComplete ? 0.9 : 0.22}
                        strokeDasharray={isActive ? '0 0' : '3 8'}
                      />
                      <foreignObject x={stage.x - 16} y={stage.y - 16} width="32" height="32">
                        <div className={`w-8 h-8 flex items-center justify-center ${color.text}`}>
                          <Icon className="w-8 h-8" />
                        </div>
                      </foreignObject>
                    </motion.g>

                    <text
                      x={stage.x}
                      y={stage.y + 66}
                      textAnchor="middle"
                      className={`fill-current ${isActive ? color.text : 'text-text-primary'} font-sans font-semibold text-[14px]`}
                    >
                      {stage.title}
                    </text>
                    <text
                      x={stage.x}
                      y={stage.y + 84}
                      textAnchor="middle"
                      className="fill-current text-text-muted font-sans text-[11px]"
                    >
                      {stage.short}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {STAGES.map((stage, index) => {
            const color = COLOR_CLASSES[stage.color];
            const isActive = stage.id === activeStage;
            const Icon = stage.icon;
            return (
              <button
                key={stage.id}
                type="button"
                data-testid={`stage-button-${stage.id}`}
                onClick={() => setActiveStage(stage.id)}
                className={`text-left rounded-xl border px-3 py-3 transition-all duration-200 ${
                  isActive ? `${color.panel} shadow-[0_0_0_1px_rgba(255,255,255,0.03)]` : 'border-border bg-forge-850 hover:bg-forge-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-text-muted">0{index + 1}</span>
                  <Icon className={`w-4 h-4 ${isActive ? color.text : 'text-text-secondary'}`} />
                </div>
                <div className={`text-sm font-semibold ${isActive ? color.text : 'text-text-primary'}`}>{stage.title}</div>
                <div className="mt-1 text-xs text-text-muted leading-relaxed">{stage.short}</div>
              </button>
            );
          })}
        </div>

        <div data-testid="active-stage-panel" className="mt-5 min-h-[170px] rounded-2xl border border-border bg-forge-850 p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-10 h-10 rounded-xl border flex items-center justify-center ${COLOR_CLASSES[active.color].panel}`}>
                  <active.icon className={`w-5 h-5 ${COLOR_CLASSES[active.color].text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-sans text-lg md:text-xl font-semibold text-text-primary">{active.title}</h3>
                    <span className={`text-xs font-mono px-2 py-1 rounded-full border ${COLOR_CLASSES[active.color].panel} ${COLOR_CLASSES[active.color].text}`}>
                      Stage 0{getStageIndex(active.id) + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm md:text-base text-text-secondary leading-relaxed">{active.description}</p>
                  <p className="mt-3 text-sm text-text-muted leading-relaxed max-w-3xl">{active.detail}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
