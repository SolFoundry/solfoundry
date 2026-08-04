import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from 'lucide-react';
import type { ReviewConsensus } from '../../types/review';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface ConsensusIndicatorProps {
  consensus: ReviewConsensus;
}

export function ConsensusIndicator({ consensus }: ConsensusIndicatorProps) {
  const { consensus: status, overall_score, max_score, threshold } = consensus;

  const isPassing = status === 'pass';
  const isDisputed = status === 'disputed';
  const scorePercent = (overall_score / max_score) * 100;
  const thresholdPercent = (threshold / max_score) * 100;

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="rounded-xl border border-border bg-forge-900 p-6">
      <h3 className="font-sans text-lg font-semibold text-text-primary mb-4">Consensus</h3>

      {/* Status badge */}
      <div className="flex items-center gap-3 mb-6">
        {isPassing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-bg border border-emerald-border">
            <CheckCircle className="w-4 h-4 text-emerald" />
            <span className="text-sm font-medium text-emerald">Passed</span>
          </div>
        ) : isDisputed ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-bg border border-purple-border">
            <HelpCircle className="w-4 h-4 text-purple-light" />
            <span className="text-sm font-medium text-purple-light">Disputed</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-magenta-bg border border-magenta-border">
            <XCircle className="w-4 h-4 text-status-error" />
            <span className="text-sm font-medium text-status-error">Failed</span>
          </div>
        )}
        <span className="text-sm text-text-muted">
          Threshold: {threshold.toFixed(1)} / {max_score}
        </span>
      </div>

      {/* Score bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Aggregate Score</span>
          <span className="font-mono text-text-primary font-semibold">
            {overall_score.toFixed(2)} / {max_score}
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-forge-800 overflow-hidden">
          {/* Threshold line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-status-warning z-10"
            style={{ left: `${thresholdPercent}%` }}
          />
          {/* Score fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorePercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              isPassing
                ? 'bg-gradient-to-r from-emerald to-emerald-light'
                : isDisputed
                  ? 'bg-gradient-to-r from-purple to-purple-light'
                  : 'bg-gradient-to-r from-status-error to-magenta'
            }`}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted">
          <span>0</span>
          <span className="text-status-warning">Threshold: {threshold.toFixed(1)}</span>
          <span>{max_score}</span>
        </div>
      </div>

      {/* Disagreement warnings */}
      {consensus.disagreement_areas.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Disagreements</p>
          {consensus.disagreement_areas.map((d, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-status-warning/5 border border-status-warning/20">
              <AlertTriangle className="w-3.5 h-3.5 text-status-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs text-text-secondary">
                <span className="font-medium">{d.criterion}</span>: {d.provider_a} ({d.score_a}) vs {d.provider_b} ({d.score_b}) — gap {d.gap.toFixed(1)}pts
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}