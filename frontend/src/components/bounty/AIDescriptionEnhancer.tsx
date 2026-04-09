import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Check, ChevronDown, AlertCircle, Bot } from 'lucide-react';
import type { EnhancedDescription } from '../../api/ai';
import { fadeIn } from '../../lib/animations';

interface AIDescriptionEnhancerProps {
  title: string;
  description: string;
  onApply: (enhanced: EnhancedDescription) => void;
  disabled?: boolean;
}

const PROVIDER_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  claude: { label: 'Claude', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  openai: { label: 'OpenAI', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  gemini: { label: 'Gemini', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
};

export function AIDescriptionEnhancer({ title, description, onApply, disabled }: AIDescriptionEnhancerProps) {
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EnhancedDescription[] | null>(null);
  const [selected, setSelected] = useState<number>(0);
  const [showDetails, setShowDetails] = useState(false);

  const canEnhance = title.trim().length >= 5 && description.trim().length >= 20;

  const handleEnhance = useCallback(async () => {
    if (!canEnhance || enhancing) return;
    setEnhancing(true);
    setError(null);
    setResults(null);
    setSelected(0);
    setShowDetails(false);

    try {
      const { enhanceDescription } = await import('../../api/ai');
      const response = await enhanceDescription({ title, description });

      // Collect non-null provider results
      const providerResults: EnhancedDescription[] = [];
      if (response.claude) providerResults.push(response.claude);
      if (response.openai) providerResults.push(response.openai);
      if (response.gemini) providerResults.push(response.gemini);

      // Always include consensus as first option
      if (response.consensus) {
        providerResults.unshift({
          ...response.consensus,
          provider: 'consensus',
          confidence: Math.max(
            ...providerResults.map((r) => r.confidence),
            response.consensus.confidence,
          ),
        });
      }

      setResults(providerResults.length > 0 ? providerResults : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI enhancement failed. Try again.');
    } finally {
      setEnhancing(false);
    }
  }, [title, description, canEnhance, enhancing]);

  const handleApply = useCallback(() => {
    if (results && results[selected]) {
      onApply(results[selected]);
      setResults(null);
    }
  }, [results, selected, onApply]);

  const handleDismiss = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* Enhance button */}
      <button
        onClick={handleEnhance}
        disabled={!canEnhance || enhancing || disabled}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-magenta/20 to-purple-light/20 border border-magenta/30 text-magenta text-sm font-medium hover:from-magenta/30 hover:to-purple-light/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group"
      >
        {enhancing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing with multiple LLMs...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>AI Enhance Description</span>
          </>
        )}
      </button>

      {canEnhance && !enhancing && !results && (
        <p className="text-xs text-text-muted">
          Uses Claude, OpenAI &amp; Gemini to improve clarity, add acceptance criteria, and suggest skills.
        </p>
      )}

      {/* Error state */}
      {error && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex items-start gap-2 p-3 rounded-lg bg-status-error/10 border border-status-error/20"
        >
          <AlertCircle className="w-4 h-4 text-status-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-status-error">{error}</p>
            <button
              onClick={handleDismiss}
              className="text-xs text-text-muted hover:text-text-primary mt-1"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="bg-forge-800 border border-border rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald" />
                <span className="text-sm font-semibold text-text-primary">AI Enhancement Results</span>
                <span className="text-xs text-text-muted">({results.length} suggestions)</span>
              </div>
              <button
                onClick={handleDismiss}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Dismiss
              </button>
            </div>

            {/* Provider tabs */}
            <div className="flex border-b border-border">
              {results.map((result, i) => {
                const style =
                  result.provider === 'consensus'
                    ? { label: '⭐ Consensus', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' }
                    : PROVIDER_STYLES[result.provider] ?? { label: result.provider, color: 'text-text-secondary', bg: 'bg-forge-700', border: 'border-border' };
                const isActive = selected === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(i)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all duration-150 ${
                      isActive
                        ? `${style.color} border-current ${style.bg}`
                        : 'text-text-muted border-transparent hover:text-text-secondary'
                    }`}
                  >
                    {style.label}
                    <span className="opacity-60">{Math.round(result.confidence * 100)}%</span>
                  </button>
                );
              })}
            </div>

            {/* Selected result preview */}
            {results[selected] && (
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Enhanced Title</p>
                  <p className="text-sm font-semibold text-text-primary">{results[selected].title}</p>
                </div>

                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Enhanced Description</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-4">
                    {results[selected].description}
                  </p>
                </div>

                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-emerald hover:text-emerald-light flex items-center gap-1"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  {showDetails ? 'Hide' : 'Show'} details
                </button>

                {showDetails && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3 pt-2 border-t border-border"
                  >
                    {/* Full description */}
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Full Description</p>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">
                        {results[selected].description}
                      </p>
                    </div>

                    {/* Acceptance criteria */}
                    {results[selected].acceptance_criteria.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Acceptance Criteria</p>
                        <ul className="space-y-1">
                          {results[selected].acceptance_criteria.map((criterion, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                              <Check className="w-3.5 h-3.5 text-emerald flex-shrink-0 mt-0.5" />
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested skills */}
                    {results[selected].suggested_skills.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Suggested Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {results[selected].suggested_skills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-block text-xs px-2 py-0.5 rounded-full bg-forge-700 text-text-secondary border border-border"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested tier */}
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Suggested Tier</p>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-magenta-bg text-magenta border border-magenta-border">
                        {results[selected].suggested_tier}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Apply button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleApply}
                    className="px-5 py-2 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Apply Enhancement
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
