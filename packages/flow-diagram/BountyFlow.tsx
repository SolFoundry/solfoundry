import React, { useState } from 'react';
import './BountyFlow.css';

interface Node {
  id: string;
  label: string;
  description: string;
  icon: string;
  x: number;
  y: number;
}

const nodes: Node[] = [
  {
    id: 'posted',
    label: 'Bounty Posted',
    description: 'Maintainer creates bounty with reward tier',
    icon: '📝',
    x: 50,
    y: 50
  },
  {
    id: 'claimed',
    label: 'Developer Claims',
    description: 'Developer comments to claim the bounty',
    icon: '👨‍💻',
    x: 250,
    y: 50
  },
  {
    id: 'submitted',
    label: 'Work Submitted',
    description: 'Pull request submitted with solution',
    icon: '📤',
    x: 450,
    y: 50
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Maintainer reviews and provides feedback',
    icon: '👀',
    x: 650,
    y: 50
  },
  {
    id: 'approved',
    label: 'Approved',
    description: 'PR merged, bounty approved',
    icon: '✅',
    x: 850,
    y: 50
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Automatic payment via Algora',
    icon: '💰',
    x: 1050,
    y: 50
  }
];

export const BountyFlow: React.FC = () => {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number>(0);

  const handleNodeClick = (nodeId: string, index: number) => {
    setActiveNode(nodeId);
    if (index + 1 > completedSteps) {
      setCompletedSteps(index + 1);
    }
  };

  return (
    <div className="bounty-flow-container">
      <h2>Bounty Lifecycle</h2>
      <div className="flow-diagram">
        <svg width="1100" height="200" className="flow-svg">
          {/* Connection lines */}
          {nodes.map((node, index) => {
            if (index === nodes.length - 1) return null;
            const nextNode = nodes[index + 1];
            const isCompleted = index < completedSteps - 1;
            
            return (
              <line
                key={`line-${index}`}
                x1={node.x + 40}
                y1={node.y + 40}
                x2={nextNode.x}
                y2={nextNode.y + 40}
                stroke={isCompleted ? '#4ec9b0' : '#666'}
                strokeWidth="3"
                className={isCompleted ? 'completed-line' : ''}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node, index) => (
          <div
            key={node.id}
            className={`flow-node ${activeNode === node.id ? 'active' : ''} ${index < completedSteps ? 'completed' : ''}`}
            style={{ left: node.x, top: node.y }}
            onClick={() => handleNodeClick(node.id, index)}
          >
            <div className="node-icon">{node.icon}</div>
            <div className="node-label">{node.label}</div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {activeNode && (
        <div className="detail-panel">
          <h3>{nodes.find(n => n.id === activeNode)?.label}</h3>
          <p>{nodes.find(n => n.id === activeNode)?.description}</p>
        </div>
      )}

      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${(completedSteps / nodes.length) * 100}%` }}
        />
      </div>
      <p className="progress-text">
        Progress: {completedSteps} / {nodes.length} steps
      </p>
    </div>
  );
};