import React, { useState, useEffect } from 'react';
import { fetchReviewDashboard } from '../../api/reviews';
import type { ReviewDashboard as ReviewDashboardType } from '../../types/review';
import { ScoreVisualization } from './ScoreVisualization';
import { ConsensusIndicator } from './ConsensusIndicator';
import { AppealWorkflow } from './AppealWorkflow';

interface ReviewDashboardProps {
  submissionId: string;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({ submissionId }) => {
  const [dashboard, setDashboard] = useState<ReviewDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await fetchReviewDashboard(submissionId);
        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [submissionId]);

  if (loading) {
    return (
      <div className="review-dashboard-loading">
        <div className="loading-spinner" />
        <p>Loading review dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-dashboard-error">
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!dashboard) {
    return <p>No review data available</p>;
  }

  return (
    <div className="review-dashboard">
      <h2>Multi-LLM Review Dashboard</h2>
      
      <div className="dashboard-grid">
        <div className="dashboard-left">
          <ScoreVisualization reviews={dashboard.reviews} />
          <ConsensusIndicator consensus={dashboard.consensus} />
        </div>
        
        <div className="dashboard-right">
          <AppealWorkflow 
            submissionId={submissionId}
            existingAppeal={dashboard.appeal}
          />
        </div>
      </div>
    </div>
  );
};
