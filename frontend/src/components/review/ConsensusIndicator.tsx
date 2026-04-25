import React from 'react';
import type { ReviewConsensus } from '../../types/review';

interface ConsensusIndicatorProps {
  consensus: ReviewConsensus;
}

const consensusColors: Record<string, string> = {
  high: '#4CAF50',
  medium: '#FF9800',
  low: '#F44336',
};

const consensusLabels: Record<string, string> = {
  high: 'High Agreement',
  medium: 'Medium Agreement',
  low: 'Low Agreement',
};

export const ConsensusIndicator: React.FC<ConsensusIndicatorProps> = ({ consensus }) => {
  return (
    <div className="consensus-indicator">
      <h3>Review Consensus</h3>
      
      <div className="consensus-summary">
        <div className="average-score">
          <span className="score-label">Average Score</span>
          <span className="score-value">{consensus.averageScore.toFixed(1)}/100</span>
        </div>
        
        <div 
          className="agreement-level"
          style={{ color: consensusColors[consensus.agreementLevel] }}
        >
          {consensusLabels[consensus.agreementLevel]}
        </div>
      </div>
      
      {consensus.disagreements.length > 0 && (
        <div className="disagreements-section">
          <h4>Disagreements</h4>
          <ul className="disagreements-list">
            {consensus.disagreements.map((disagreement, index) => (
              <li key={index} className="disagreement-item">
                {disagreement}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="score-distribution">
        <h4>Score Distribution</h4>
        <div className="distribution-bars">
          {consensus.scores.map((score, index) => (
            <div key={index} className="distribution-bar">
              <div 
                className="bar-fill" 
                style={{ width: `${score}%` }}
              />
              <span className="bar-value">{score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
