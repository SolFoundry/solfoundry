import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ReviewScorePanel } from '../components/reviews/ReviewScorePanel';
import { AppealWorkflow } from '../components/reviews/AppealWorkflow';
import { AppealHistory } from '../components/reviews/AppealHistory';
import { useAppeal } from '../hooks/useReviewScores';

function ReviewDashboard({ submissionId }: { submissionId: string }) {
  const { appeal } = useAppeal(submissionId);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white px-6 py-16 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/bounties" className="text-white/40 hover:text-white text-sm">← Bounties</Link>
        <span className="text-white/20">/</span>
        <span className="text-white/60 text-sm font-mono truncate">{submissionId}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-1">Review Dashboard</h1>
        <p className="text-white/50 text-sm">
          Multi-LLM review scores with consensus analysis and appeal workflow.
        </p>
      </div>

      {/* Scores */}
      <ReviewScorePanel submissionId={submissionId} />

      {/* Appeal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AppealWorkflow submissionId={submissionId} />

        {appeal && appeal.history.length > 0 && (
          <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white/70 mb-4">Appeal History</h3>
            <AppealHistory history={appeal.history} />
          </div>
        )}
      </div>
    </div>
  );
}

export function ReviewDashboardPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  if (!submissionId) return null;
  return <ReviewDashboard submissionId={submissionId} />;
}
