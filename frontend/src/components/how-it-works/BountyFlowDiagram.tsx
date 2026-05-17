import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  CircleDollarSign,
  FileText,
  GitPullRequest,
  Hammer,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

type FlowStageId = 'post' | 'claim' | 'work' | 'submit' | 'review' | 'payment';

interface FlowStage {
  id: FlowStageId;
  label: string;
  shortLabel: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  accent: 'emerald' | 'purple' | 'magenta' | 'info' | 'warning' | 'success';
}

const STAGES: FlowStage[] = [
  {
    id: 'post',
    label: 'Post bounty',
    shortLabel: 'Post',
    description: 'Creator publishes a scoped task with reward, deadline, and review criteria.',
    detail: 'The bounty starts as a GitHub issue or SolFoundry listing with enough detail for contributors to estimate the work.',
    icon: FileText,
    accent: 'emerald',
  },
  {
    id: 'claim',
    label: 'Claim',
    shortLabel: 'Claim',
    description: 'Contributor chooses the bounty and signals intent to work.',
    detail: 'Open races can start immediately. Gated tiers check contributor reputation before review begins.',
    icon: ShieldCheck,
    accent: 'purple',
  },
  {
    id: 'work',
    label: 'Work',
    shortLabel: 'Work',
    description: 'Contributor implements the fix, feature, docs, or asset.',
    detail: 'Good submissions stay scoped, include verification notes, and avoid unrelated churn.',
    icon: Hammer,
    accent: 'magenta',
  },
  {
    id: 'submit',
    label: 'Submit PR',
    shortLabel: 'Submit',
    description: 'The solution is opened as a pull request referencing the bounty issue.',
    detail: 'The PR body must include the linked issue, test evidence, and wallet details when required by the bounty.',
    icon: GitPullRequest,
    accent: 'info',
  },
  {
    id: 'review',
    label: 'Review',
    shortLabel: 'Review',
    description: 'Automated and maintainer review checks quality, scope, and eligibility.',
    detail: 'SolFoundry review combines CI status, bounty guards, and AI-assisted review before maintainer approval.',
    icon: Bot,
    accent: 'warning',
  },
  {
    id: 'payment',
    label: 'Payment',
    shortLabel: 'Pay',
    description: 'Approved work is merged and paid from the bounty mechanism.',
    detail: 'Rewards can be released from escrow, treasury, or direct payout depending on the bounty source.',
    icon: CircleDollarSign,
    accent: 'success',
  },
];

const ACCENTS: Record<FlowStage['accent'], { fill: string; stroke: string; text: string; glow: string }> = {
  emerald: {
    fill: 'fill-emerald-bg',
    stroke: 'stroke-emerald',
    text: 'text-emerald',
    glow: 'shadow-[0_0_28px_rgba(0,230,118,0.22)]',
  },
  purple: {
    fill: 'fill-purple-bg',
    stroke: 'stroke-purple',
    text: 'text-purple-light',
    glow: 'shadow-[0_0_28px_rgba(124,58,237,0.22)]',
  },
  magenta: {
    fill: 'fill-magenta-bg',
    stroke: 'stroke-magenta',
    text: 'text-magenta',
    glow: 'shadow-[0_0_28px_rgba(224,64,251,0.22)]',
  },
  info: {
    fill: 'fill-[rgba(64,196,255,0.1)]',
    stroke: 'stroke-status-info',
    text: 'text-status-info',
    glow: 'shadow-[0_0_28px_rgba(64,196,255,0.2)]',
  },
  warning: {
    fill: 'fill-[rgba(255,179,0,0.1)]',
    stroke: 'stroke-status-warning',
    text: 'text-status-warning',
    glow: 'shadow-[0_0_28px_rgba(255,179,0,0.18)]',
  },
  success: {
    fill: 'fill-emerald-bg',
    stroke: 'stroke-status-success',
    text: 'text-status-success',
    glow: 'shadow-[0_0_28px_rgba(0,230,118,0.22)]',
  },
};

const NODE_POSITIONS = [
  { x: 80, y: 110 },
  { x: 226, y: 110 },
  { x: 372, y: 110 },
  { x: 518, y: 110 },
  { x: 664, y: 110 },
  { x: 810, y: 110 },
];

export function BountyFlowDiagram() {
  const [activeId, setActiveId] = useState<FlowStageId>('post');
  const activeStage = useMemo(
    () => STAGES.find((stage) => stage.id === activeId) ?? STAGES[0],
    [activeId],
  );

  return (
    <section
      aria-labelledby="bounty-flow-heading"
      className="mb-14 rounded-2xl border border-border bg-forge-900/80 p-4 sm:p-6 overflow-hidden"
      data-testid="bounty-flow-diagram"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald">Lifecycle map</p>
          <h2 id="bounty-flow-heading" className="mt-2 font-display text-2xl font-bold text-text-primary">
            Bounty flow from post to payout
          </h2>
        </div>
        <p className="max-w-md text-sm text-text-secondary">
          Hover, focus, or tap any stage to see what happens before the bounty moves forward.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-forge-950/70 p-3 sm:p-4">
        <svg
          role="img"
          aria-label="Interactive bounty lifecycle diagram"
          viewBox="0 0 890 220"
          className="h-auto min-h-[190px] w-full"
          data-testid="bounty-flow-svg"
        >
          <defs>
            <marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border-active" />
            </marker>
          </defs>
          {NODE_POSITIONS.slice(0, -1).map((position, index) => (
            <motion.path
              key={`${STAGES[index].id}-connector`}
              d={`M ${position.x + 48} ${position.y} C ${position.x + 76} ${position.y - 36}, ${
                NODE_POSITIONS[index + 1].x - 76
              } ${NODE_POSITIONS[index + 1].y - 36}, ${NODE_POSITIONS[index + 1].x - 48} ${
                NODE_POSITIONS[index + 1].y
              }`}
              className="stroke-border-active"
              strokeWidth="2"
              strokeDasharray="5 7"
              fill="none"
              markerEnd="url(#flow-arrow)"
              initial={{ pathLength: 0.3, opacity: 0.55 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
            />
          ))}

          {STAGES.map((stage, index) => {
            const position = NODE_POSITIONS[index];
            const Icon = stage.icon;
            const selected = stage.id === activeId;
            const accent = ACCENTS[stage.accent];

            return (
              <motion.g
                key={stage.id}
                role="button"
                tabIndex={0}
                aria-label={`Show ${stage.label} stage`}
                aria-pressed={selected}
                onMouseEnter={() => setActiveId(stage.id)}
                onFocus={() => setActiveId(stage.id)}
                onClick={() => setActiveId(stage.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveId(stage.id);
                  }
                }}
                className="cursor-pointer outline-none"
                animate={{ scale: selected ? 1.05 : 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={selected ? 46 : 40}
                  className={`${accent.fill} ${accent.stroke}`}
                  strokeWidth={selected ? 3 : 2}
                />
                <foreignObject x={position.x - 13} y={position.y - 18} width="26" height="26">
                  <Icon className={`h-6 w-6 ${accent.text}`} aria-hidden="true" />
                </foreignObject>
                <text
                  x={position.x}
                  y={position.y + 63}
                  textAnchor="middle"
                  className="fill-text-secondary text-[13px] font-semibold"
                >
                  {stage.shortLabel}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <motion.div
        key={activeStage.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`mt-5 rounded-xl border border-border bg-forge-850 p-4 ${ACCENTS[activeStage.accent].glow}`}
        data-testid="stage-tooltip"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              ACCENTS[activeStage.accent].text
            } border-current bg-forge-900`}
          >
            <activeStage.icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-sans text-lg font-semibold text-text-primary">{activeStage.label}</h3>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed">{activeStage.description}</p>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">{activeStage.detail}</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
