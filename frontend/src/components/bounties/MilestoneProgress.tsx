import React from 'react';

interface Milestone {
  id: string;
  milestone_number: number;
  description: string;
  percentage: number;
  status: 'pending' | 'submitted' | 'approved';
  submitted_at?: string;
  approved_at?: string;
  payout_tx_hash?: string;
}

interface MilestoneProgressProps {
  milestones: Milestone[];
  isCreator?: boolean;
  onApprove?: (milestoneId: string) => void;
  onSubmit?: (milestoneId: string) => void;
  loading?: boolean;
}

export const MilestoneProgress: React.FC<MilestoneProgressProps> = ({
  milestones,
  isCreator,
  onApprove,
  onSubmit,
  loading,
}) => {
  if (!milestones || milestones.length === 0) return null;

  const totalPercentage = milestones.reduce((acc, m) => acc + m.percentage, 0);
  const approvedPercentage = milestones
    .filter((m) => m.status === 'approved')
    .reduce((acc, m) => acc + m.percentage, 0);

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-300">Milestone Progress</h2>
        <span className="text-sm font-medium text-purple-400">
          {approvedPercentage}% Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-4 w-full bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${(approvedPercentage / totalPercentage) * 100}%` }}
        />
      </div>

      <div className="space-y-4">
        {milestones.sort((a, b) => a.milestone_number - b.milestone_number).map((milestone) => (
          <div
            key={milestone.id}
            className={`p-4 rounded-lg border transition-colors ${
              milestone.status === 'approved'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : milestone.status === 'submitted'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-gray-800/50 border-gray-700/50'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">
                    #{milestone.milestone_number}
                  </span>
                  <h3 className="font-medium text-gray-200">
                    {milestone.description}
                  </h3>
                  <span className="text-xs font-medium text-gray-400">
                    ({milestone.percentage}%)
                  </span>
                </div>
                
                {milestone.status === 'approved' && milestone.approved_at && (
                  <p className="text-xs text-emerald-400">
                    Approved on {new Date(milestone.approved_at).toLocaleDateString()}
                  </p>
                )}
                {milestone.status === 'submitted' && milestone.submitted_at && (
                  <p className="text-xs text-yellow-400">
                    Submitted on {new Date(milestone.submitted_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {milestone.status === 'pending' && !isCreator && onSubmit && (
                  <button
                    onClick={() => onSubmit(milestone.id)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Submit
                  </button>
                )}
                {milestone.status === 'submitted' && isCreator && onApprove && (
                  <button
                    onClick={() => onApprove(milestone.id)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Approve & Pay
                  </button>
                )}
                
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  milestone.status === 'approved'
                    ? 'bg-emerald-500 text-white'
                    : milestone.status === 'submitted'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {milestone.status}
                </span>
              </div>
            </div>
            
            {milestone.payout_tx_hash && (
              <div className="mt-2 pt-2 border-t border-emerald-500/10">
                <a
                  href={`https://solscan.io/tx/${milestone.payout_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Payout Transaction
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
