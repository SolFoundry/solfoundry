import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Star, TrendingUp, AlertCircle, CheckCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

// Types
export interface ReviewModel {
  name: string;
  provider: string;
  score: number; // 0-10
  confidence: number; // 0-1
  summary: string;
  strengths: string[];
  improvements: string[];
  reasoning: string;
  reviewedAt: string;
}

export interface ReviewResults {
  models: ReviewModel[];
  trimmedMean: number;
  threshold: number;
  passed: boolean;
  tier: 1 | 2 | 3;
}

export async function fetchReviewResults(prNumber: number): Promise<ReviewResults> {
  return apiClient<ReviewResults>(`/api/prs/${prNumber}/review`);
}

// Score Display
function ScoreCircle({ score, maxScore = 10 }: { score: number; maxScore?: number }) {
  const pct = (score / maxScore) * 100;
  const color = score >= 7 ? '#00D4AA' : score >= 6 ? '#FBBF24' : '#EF4444';
  const circumference = 2 * Math.PI * 36;
  const strokeDash = (pct / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle cx="40" cy="40" r="36" fill="none" stroke="#1F2937" strokeWidth="4" />
        {/* Score arc */}
        <circle
          cx="40" cy="40" r="36"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score.toFixed(1)}</span>
      </div>
    </div>
  );
}

// Confidence Bar
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? '#00D4AA' : confidence >= 0.6 ? '#FBBF24' : '#EF4444';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// Model Card
function ModelReviewCard({ model, isHighlighted }: { model: ReviewModel; isHighlighted: boolean }) {
  const [showDetails, setShowDetails] = useState(false);

  const borderColor = model.score >= 7
    ? 'border-emerald/30' : model.score >= 6
    ? 'border-tier-t2/30' : 'border-status-error/30';

  return (
    <div className={`rounded-lg bg-surface-card border ${borderColor} ${isHighlighted ? 'ring-1 ring-emerald/20' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <ScoreCircle score={model.score} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-emerald" />
            <span className="text-sm font-semibold text-text-primary">{model.name}</span>
            <span className="text-xs text-text-muted">by {model.provider}</span>
          </div>
          <p className="text-sm text-text-secondary mb-2">{model.summary}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-anvil-orange" />
              <span className="text-xs text-text-muted">Confidence</span>
            </div>
            <div className="flex-1 max-w-[120px]">
              <ConfidenceBar confidence={model.confidence} />
            </div>
          </div>
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {model.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald mb-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Strengths
              </p>
              <ul className="space-y-0.5">
                {model.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-text-secondary">• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {model.improvements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-tier-t2 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Suggested Improvements
              </p>
              <ul className="space-y-0.5">
                {model.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-text-secondary">• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Full Reasoning (expandable) */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-emerald hover:underline"
        >
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showDetails ? 'Hide' : 'Show'} full reasoning
        </button>
        {showDetails && (
          <div className="mt-2 p-3 rounded bg-surface-hover text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
            {model.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export function BountyReviewResults({ prNumber }: { prNumber: number }) {
  const [results, setResults] = useState<ReviewResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchReviewResults(prNumber);
        setResults(data);
      } catch {
        // Demo data
        setResults({
          models: [
            { name: 'GPT-5.4', provider: 'OpenAI', score: 7.2, confidence: 0.85, summary: 'Solid implementation with good test coverage.', strengths: ['Clean architecture', 'Comprehensive tests'], improvements: ['Add error boundary', 'Type annotations needed'], reasoning: 'The implementation follows established patterns...', reviewedAt: new Date().toISOString() },
            { name: 'Gemini 2.5 Pro', provider: 'Google', score: 6.8, confidence: 0.78, summary: 'Good core logic but some edge cases missing.', strengths: ['Core logic correct', 'Good variable naming'], improvements: ['Missing null checks', 'Consider async error handling'], reasoning: 'Reviewing the code structure...', reviewedAt: new Date().toISOString() },
            { name: 'Grok 4', provider: 'xAI', score: 7.5, confidence: 0.82, summary: 'Well-structured code with room for optimization.', strengths: ['Efficient algorithms', 'Clear documentation'], improvements: ['Optimize bundle size', 'Add loading states'], reasoning: 'Analyzing performance characteristics...', reviewedAt: new Date().toISOString() },
            { name: 'Sonnet 4.6', provider: 'Anthropic', score: 6.5, confidence: 0.75, summary: 'Functional but could be more robust.', strengths: ['Simple and readable', 'Works as specified'], improvements: ['Add input validation', 'Improve accessibility'], reasoning: 'Evaluating code quality...', reviewedAt: new Date().toISOString() },
            { name: 'DeepSeek V3.2', provider: 'DeepSeek', score: 7.0, confidence: 0.80, summary: 'Good implementation with minor issues.', strengths: ['Correct edge cases', 'Good performance'], improvements: ['Add type hints', 'Missing docstrings'], reasoning: 'Detailed analysis follows...', reviewedAt: new Date().toISOString() },
          ],
          trimmedMean: 7.0,
          threshold: 6.0,
          passed: true,
          tier: 1,
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [prNumber]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-surface-card rounded-lg" />
        ))}
      </div>
    );
  }

  if (!results) return null;

  const resultColor = results.passed ? 'text-emerald' : 'text-status-error';
  const resultBg = results.passed ? 'bg-emerald/10' : 'bg-status-error/10';
  const resultBorder = results.passed ? 'border-emerald/30' : 'border-status-error/30';

  return (
    <div className="space-y-6">
      {/* Overall Result */}
      <div className={`p-4 rounded-lg ${resultBg} border ${resultBorder}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${resultColor}`}>
              {results.passed ? '✅ PASSED' : '❌ FAILED'}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Trimmed Mean: <strong className="text-text-primary">{results.trimmedMean.toFixed(1)}/10</strong>
              {' · '}Threshold: <strong>{results.threshold.toFixed(1)}</strong>
              {' · '}Tier {results.tier}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums" style={{
              color: results.trimmedMean >= 7 ? '#00D4AA' : results.trimmedMean >= 6 ? '#FBBF24' : '#EF4444'
            }}>
              {results.trimmedMean.toFixed(1)}
            </p>
            <p className="text-xs text-text-muted">/ 10</p>
          </div>
        </div>
      </div>

      {/* Model Reviews (side-by-side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.models.map((model, i) => (
          <ModelReviewCard
            key={model.name}
            model={model}
            isHighlighted={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

export default BountyReviewResults;
