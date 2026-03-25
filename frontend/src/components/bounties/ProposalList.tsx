/**
 * ProposalList -- shows proposals for a T3 bounty.
 * Creator view: all proposals with assign buttons.
 * Contributor view: their own proposal status.
 */
import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../services/apiClient';

interface Proposal {
  id: string;
  bounty_id: string;
  user_id: string;
  username: string | null;
  proposal_text: string;
  status: string;
  created_at: string;
}

interface ProposalListProps {
  bountyId: string;
  isCreator: boolean;
  onAssigned?: () => void;
}

export function ProposalList({ bountyId, isCreator, onAssigned }: ProposalListProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchProposals = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/bounties/${bountyId}/proposals`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [bountyId]);

  const handleAssign = async (proposalId: string) => {
    if (!confirm('Assign this builder to the bounty? This will start their deadline.')) return;
    setAssigning(proposalId);
    try {
      const token2 = getAuthToken();
      const res = await fetch(`/api/bounties/${bountyId}/proposals/${proposalId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token2 ? { 'Authorization': `Bearer ${token2}` } : {}),
        },
      });
      if (res.ok) {
        fetchProposals();
        onAssigned?.();
      }
    } catch {
      // silent
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return <div className="text-gray-500 text-sm animate-pulse">Loading proposals...</div>;
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-500 text-sm">No proposals yet.</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'assigned': return <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">Assigned</span>;
      case 'rejected': return <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">Not Selected</span>;
      default: return <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">Pending</span>;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">
        {proposals.length} Proposal{proposals.length !== 1 && 's'}
      </h3>
      {proposals.map((p) => (
        <div key={p.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {p.username || p.user_id.slice(0, 8) + '...'}
              </span>
              {statusBadge(p.status)}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(p.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {p.proposal_text}
          </p>
          {isCreator && p.status === 'pending' && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => handleAssign(p.id)}
                disabled={assigning === p.id}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors min-h-[36px]"
              >
                {assigning === p.id ? 'Assigning...' : 'Assign This Builder'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
