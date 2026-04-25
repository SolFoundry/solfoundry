import React from 'react';
import type { LLMReview } from '../../types/review';

interface ScoreVisualizationProps {
  reviews: LLMReview[];
}

const providerColors: Record<string, string> = {
  claude: '#7B68EE',
  codex: '#00CED1',
  gemini: '#FF6B6B',
};

const providerNames: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

export const ScoreVisualization: React.FC<ScoreVisualizationProps> = ({ reviews }) => {
  return (
    <div className="score-visualization">
      <h3>LLM Review Scores</h3>
      
      <div className="scores-grid">
        {reviews.map((review) => (
          <div 
            key={review.id} 
            className="score-card"
            style={{ borderColor: providerColors[review.llmProvider] }}
          >
            <div className="score-header">
              <span className="provider-name" style={{ color: providerColors[review.llmProvider] }}>
                {providerNames[review.llmProvider]}
              </span>
              <span className="score-value">{review.score}/100</span>
            </div>
            
            <div className="score-bar-container">
              <div 
                className="score-bar" 
                style={{ 
                  width: `${review.score}%`,
                  backgroundColor: providerColors[review.llmProvider]
                }}
              />
            </div>
            
            <div className="score-reasoning">
              <p>{review.reasoning}</p>
            </div>
            
            <div className="score-timestamp">
              {new Date(review.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
