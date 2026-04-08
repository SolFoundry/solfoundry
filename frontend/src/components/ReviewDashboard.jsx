import React from 'react';

const consensusIndicators = {
    Claude: 'High',
    Codex: 'Medium',
    Gemini: 'Low',
};

const aiScoresWithConsensus = [
    { llm: 'Claude', score: 5, consensus: consensusIndicators.Claude, consensusDots: '●●●' },
    { llm: 'Codex', score: 4, consensus: consensusIndicators.Codex, consensusDots: '●●' },
    { llm: 'Gemini', score: 3, consensus: consensusIndicators.Gemini, consensusDots: '●' },
];

const ReviewDashboard = () => (
    <div>
        <h1>Review Dashboard</h1>
        <ul>
            {aiScoresWithConsensus.map((row) => (
                <li key={row.llm}>
                    {row.llm}: {row.score} — consensus {row.consensus} {row.consensusDots}
                </li>
            ))}
        </ul>
    </div>
);

export default ReviewDashboard;
