import React from 'react';

const ReviewDashboard = () => {
    // Placeholder data for AI scores
const consensusIndicators = { Claude: 'High', Codex: 'Medium', Gemini: 'Low' };
const aiScoresWithConsensus = [{llm: 'Claude', score: 5, consensus: consensusIndicators.Claude, consensusDots: '●●●'}, {llm: 'Codex', score: 4, consensus: consensusIndicators.Codex, consensusDots: '●●'}, {llm: 'Gemini', score: 3, consensus: consensusIndicators.Gemini, consensusDots: '●'}];
    const aiScores = [{llm: 'Claude', score: 5}, {llm: 'Codex', score: 4}, {llm: 'Gemini', score: 3}];

    return (
        <div>
            <h1>Review Dashboard</h1>
            <ul>
                {aiScores.map((scoreData, index) => (
                    <li key={index}>{scoreData.llm}: {scoreData.score}</li>
                ))}
            </ul>
        </div>
    );
};

export default ReviewDashboard;