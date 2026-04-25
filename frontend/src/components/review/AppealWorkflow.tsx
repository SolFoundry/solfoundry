import React, { useState } from 'react';
import { submitAppeal, updateAppealStatus, assignReviewer } from '../../api/reviews';
import type { Appeal } from '../../types/review';

interface AppealWorkflowProps {
  submissionId: string;
  existingAppeal?: Appeal;
}

export const AppealWorkflow: React.FC<AppealWorkflowProps> = ({ 
  submissionId, 
  existingAppeal 
}) => {
  const [appeal, setAppeal] = useState<Appeal | undefined>(existingAppeal);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Please provide a reason for the appeal');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newAppeal = await submitAppeal(submissionId, reason);
      setAppeal(newAppeal);
      setReason('');
      setSuccess('Appeal submitted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit appeal');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string, notes?: string) => {
    if (!appeal) return;

    try {
      setLoading(true);
      const updated = await updateAppealStatus(appeal.id, newStatus, notes);
      setAppeal(updated);
      setSuccess(`Appeal status updated to ${newStatus}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignReviewer = async (reviewerId: string) => {
    if (!appeal) return;

    try {
      setLoading(true);
      const updated = await assignReviewer(appeal.id, reviewerId);
      setAppeal(updated);
      setSuccess('Reviewer assigned successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign reviewer');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="appeal-loading">Processing...</div>;
  }

  return (
    <div className="appeal-workflow">
      <h3>Appeal Workflow</h3>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {!appeal ? (
        <form onSubmit={handleSubmitAppeal} className="appeal-form">
          <h4>Submit New Appeal</h4>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why you disagree with the review..."
            rows={4}
            className="appeal-textarea"
          />
          <button type="submit" className="appeal-submit-btn">
            Submit Appeal
          </button>
        </form>
      ) : (
        <div className="appeal-details">
          <div className="appeal-status">
            <span className="status-label">Status:</span>
            <span className={`status-badge status-${appeal.status}`}>
              {appeal.status.replace('_', ' ')}
            </span>
          </div>

          <div className="appeal-history">
            <h4>History</h4>
            {appeal.history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-header">
                  <span className="history-action">{item.action}</span>
                  <span className="history-actor">by {item.actor}</span>
                  <span className="history-time">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                {item.notes && <p className="history-notes">{item.notes}</p>}
              </div>
            ))}
          </div>

          {appeal.status === 'pending' && (
            <div className="appeal-actions">
              <button 
                onClick={() => handleStatusUpdate('under_review')}
                className="action-btn"
              >
                Start Review
              </button>
            </div>
          )}

          {appeal.status === 'under_review' && (
            <div className="appeal-actions">
              <button 
                onClick={() => handleStatusUpdate('resolved', 'Appeal resolved in favor of submitter')}
                className="action-btn action-approve"
              >
                Approve Appeal
              </button>
              <button 
                onClick={() => handleStatusUpdate('rejected', 'Appeal rejected after review')}
                className="action-btn action-reject"
              >
                Reject Appeal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
