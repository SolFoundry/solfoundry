import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Brain, Shield, Zap, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import type { LLMReviewScore } from '../../types/bounty';

const PROVIDER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  claude: { label: 'Claude', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  codex: { label: 'Codex', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  gemini: { label: 'Gemini', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
};

function getQualityColor(quality: string): string {
  switch (quality) {
    case 'excellent': return 'text-emerald';
    case 'good': return 'text-blue-400';
    case 'fair': return 'text-amber-400';
    case 'poor': return 'text-red-400';
    default: return 'text-text-muted';
  }
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Very High';
  if (confidence >= 80) return 'High';
  if (confidence >= 65) return 'Moderate';
  return 'Low';
}

export function LLMReviewCard({ review }: { review: LLMReviewScore }) {
  const [expanded, setExpanded] = useState(false);
  const config = PROVIDER_CONFIG[review.provider] || PROVIDER_CONFIG.claude;
  const scorePct = (review.score / 10) * 100;
  const scoreColor = review.score >= 8 ? "bg-emerald" : review.score >= 6 ? "bg-amber-400" : "bg-red-400";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={'rounded-xl border p-4 ' + config.border + ' ' + config.bg}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {review.provider === "claude" && <Brain className={"w-5 h-5 " + config.color} />}
          {review.provider === "codex" && <Zap className={"w-5 h-5 " + config.color} />}
          {review.provider === "gemini" && <Shield className={"w-5 h-5 " + config.color} />}
          <span className={"font-semibold text-sm " + config.color}>{config.label}</span>
        </div>
        <span className={"text-xs font-mono px-2 py-0.5 rounded-full border " + config.bg + " " + config.color + " " + config.border}>
          {getConfidenceLabel(review.confidence)}
        </span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">Score</span>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-lg font-bold text-text-primary">{review.score.toFixed(1)}</span>
            <span className="text-xs text-text-muted">/10</span>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-forge-800 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: scorePct + "%" }}
            transition={{ duration: 0.8 }} className={"h-full rounded-full " + scoreColor} />
        </div>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">Confidence</span>
          <span className="font-mono text-xs text-text-secondary">{review.confidence}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-forge-800 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: review.confidence + "%" }}
            transition={{ duration: 0.6, delay: 0.2 }} className="h-full rounded-full bg-blue-400" />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted">Quality:</span>
        <span className={"text-xs font-semibold capitalize " + getQualityColor(review.quality)}>{review.quality}</span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mb-2">{review.summary}</p>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "Hide details" : "Show details"}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3 mt-3 border-t border-border space-y-3">
              {review.strengths && review.strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald" /><span className="text-xs font-medium text-text-primary">Strengths</span></div>
                  <ul className="space-y-1">{review.strengths.map((s, i) => <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-emerald">+</span> {s}</li>)}</ul>
                </div>
              )}
              {review.weaknesses && review.weaknesses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs font-medium text-text-primary">Improvements</span></div>
                  <ul className="space-y-1">{review.weaknesses.map((w, i) => <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-amber-400">-</span> {w}</li>)}</ul>
                </div>
              )}
              {review.full_review_url && (
                <a href={review.full_review_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                  <ExternalLink className="w-3 h-3" /> View full review with reasoning
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function LLMReviewPanel({ reviews, aggregateScore, passThreshold }: {
  bountyId: string;
  reviews: LLMReviewScore[];
  aggregateScore: number;
  passThreshold: number;
}) {
  const passed = aggregateScore >= passThreshold;
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="font-sans text-lg font-semibold text-text-primary">AI Review Results</h2>
        </div>
        <div className={"flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border " + (passed ? "bg-emerald-bg/50 text-emerald border-emerald-border" : "bg-red-400/10 text-red-400 border-red-400/30")}>
          {passed ? "PASSED" : "BELOW"} <span className="font-mono">{aggregateScore.toFixed(1)} / {passThreshold.toFixed(1)}</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mb-4">Reviews from three independent LLMs (Claude, Codex, Gemini) evaluating code quality, correctness, and completeness.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reviews.map((review) => <LLMReviewCard key={review.provider} review={review} />)}
      </div>
    </div>
  );
}
