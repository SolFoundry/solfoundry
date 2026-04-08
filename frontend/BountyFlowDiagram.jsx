import React from "react";

const BountyFlowDiagram = () => {
  return (
    <svg width="500" height="300">
      <g>
        <rect x="20" y="50" width="100" height="50" fill="lightblue" />
        <text x="50" y="75" textAnchor="middle">
          Post
        </text>
        <line x1="120" y1="75" x2="200" y2="75" stroke="black" />
      </g>
      <g>
        <rect x="200" y="50" width="100" height="50" fill="lightgreen" />
        <text x="250" y="75" textAnchor="middle">
          Claim
        </text>
        <line x1="300" y1="75" x2="400" y2="75" stroke="black" />
      </g>
      <g>
        <rect x="400" y="50" width="100" height="50" fill="salmon" />
        <text x="450" y="75" textAnchor="middle">
          Work
        </text>
        <line x1="500" y1="75" x2="600" y2="75" stroke="black" />
      </g>
      {/* Continue with other states like Submit, Review, Payment */}
    </svg>
  );
};

export default BountyFlowDiagram;
