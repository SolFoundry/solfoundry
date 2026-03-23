import React, { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { BountyTags } from './BountyTags';

interface Submission {
    id: string;
    bounty_id: string;
    pr_url: string;
    submitted_by: string;
    notes?: string;
    status: string;
    ai_score: number;
    submitted_at: string;
}

interface CreatorBountyCardProps {
    bounty: any;
    onUpdate: () => void;
}

export function CreatorBountyCard({ bounty, onUpdate }: CreatorBountyCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [isExtending, setIsExtending] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [extendDays, setExtendDays] = useState(7);
    const bountyId = bounty.id;
    const toast = useToast();

    const handleCancel = async () => {
        if (!window.confirm("Are you sure you want to cancel this bounty? This will trigger a refund.")) return;
        setIsCancelling(true);
        try {
            const res = await fetch(`/api/bounties/${bountyId}/cancel`, { method: 'POST' });
            if (res.ok) {
                onUpdate();
            } else {
                toast.error("Failed to cancel bounty");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsCancelling(false);
        }
    };

    const handleExtendDeadline = async () => {
        if (!bounty?.deadline) return;
        setIsExtending(true);
        const newDeadline = new Date(bounty.deadline);
        newDeadline.setDate(newDeadline.getDate() + extendDays);

        try {
            const res = await fetch(`/api/bounties/${bountyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deadline: newDeadline.toISOString() }),
            });
            if (res.ok) {
                onUpdate();
            } else {
                toast.error("Failed to extend deadline");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsExtending(false);
        }
    };

    const handleUpdateSubmission = async (submissionId: string, status: string) => {
        try {
            const res = await fetch(`/api/bounties/${bountyId}/submissions/${submissionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                onUpdate();
            } else {
                toast.error("Failed to update submission");
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (!bounty) {
        return (
            <div className="bg-surface-100 rounded-lg p-6 border border-white/5 animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-white/10 rounded"></div>
                        <div className="h-4 bg-white/10 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return num.toString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'text-solana-green';
            case 'in_progress': return 'text-blue-400';
            case 'under_review': return 'text-purple-400';
            case 'disputed': return 'text-red-400';
            case 'completed':
            case 'paid': return 'text-green-400';
            case 'cancelled': return 'text-gray-500';
            default: return 'text-gray-400';
        }
    };

    const pendingSubmissions = bounty.submissions?.filter((s: Submission) => s.status === 'pending') || [];
    const disputedSubmissions = bounty.submissions?.filter((s: Submission) => s.status === 'disputed') || [];

    return (
        <div className="bg-surface-100 rounded-xl border border-white/10 hover:border-white/20 transition-colors overflow-hidden">
            {/* Card Header Summary */}
            <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-white leading-tight">{bounty.title}</h3>
                            {pendingSubmissions.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-solana-green/20 text-solana-green text-xs font-bold border border-solana-green/30">
                                    {pendingSubmissions.length} New Submission{pendingSubmissions.length > 1 && 's'}
                                </span>
                            )}
                            {disputedSubmissions.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-xs font-bold border border-red-500/30">
                                    Dispute
                                </span>
                            )}
                        </div>

                        <BountyTags
                            tier={bounty.tier ?? 'T1'}
                            skills={bounty.required_skills ?? bounty.skills ?? []}
                            category={bounty.category}
                            showTier
                            maxSkills={4}
                            className="mb-2"
                            data-testid="creator-bounty"
                        />

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
                            <span className={`font-semibold ${getStatusColor(bounty.status)} uppercase tracking-wider text-xs`}>
                                {bounty.status.replace(/_/g, ' ')}
                            </span>
                            <span className="flex items-center gap-1">
                                Escrowed: <strong className="text-white">{formatNumber(bounty.reward_amount)} FNDRY</strong>
                            </span>
                            <span>
                                Deadline: <strong className="text-white">{bounty.deadline ? new Date(bounty.deadline).toLocaleDateString() : 'N/A'}</strong>
                            </span>
                            <span>
                                Submissions: <strong className="text-white">{bounty.submission_count}</strong>
                            </span>
                            {bounty.tier === 'T3' && bounty.milestones && bounty.milestones.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">Milestones:</span>
                                    <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500" 
                                            style={{ 
                                                width: `${(bounty.milestones.filter((m: any) => m.status === 'approved').length / bounty.milestones.length) * 100}%` 
                                            }} 
                                        />
                                    </div>
                                    <span className="text-white text-xs font-bold">
                                        {bounty.milestones.filter((m: any) => m.status === 'approved').length}/{bounty.milestones.length}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors border border-white/10"
                        >
                            {expanded ? 'Hide Submissions' : 'View Submissions'}
                        </button>
                        <div className="relative group">
                            <button
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors border border-white/10 flex items-center gap-2"
                                disabled={bounty.status === 'cancelled' || bounty.status === 'paid' || bounty.status === 'completed'}
                            >
                                <span>Actions ▾</span>
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-surface border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={handleExtendDeadline}
                                        disabled={isExtending}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-md"
                                    >
                                        Extend Deadline (+7d)
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={isCancelling}
                                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md"
                                    >
                                        Cancel & Refund
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Submission Feed */}
            {expanded && (
                <div className="border-t border-white/5 bg-surface p-6 text-sm">
                    <h4 className="text-gray-300 font-semibold mb-4 text-sm uppercase tracking-wider">Submission Feed</h4>

                    {bounty.submissions && bounty.submissions.length > 0 ? (
                        <div className="space-y-4">
                            {bounty.submissions.map((sub: Submission) => (
                                <div key={sub.id} className="bg-surface-100 border border-white/10 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-solana-green">{sub.submitted_by.slice(0, 10)}...</span>
                                            <span className="text-gray-500 text-xs">{new Date(sub.submitted_at).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <a href={sub.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                View PR
                                            </a>
                                            <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-300 border border-white/10">
                                                Status: <span className="text-white capitalize">{sub.status}</span>
                                            </span>
                                            {sub.status === 'paid' && (
                                                <button
                                                    onClick={() => window.open(`/profile/${sub.submitted_by}`, '_blank')}
                                                    className="text-solana-green hover:underline text-xs flex items-center gap-1"
                                                >
                                                    View Winner Profile ↗
                                                </button>
                                            )}
                                        </div>
                                        {sub.notes && <p className="text-gray-400 text-xs italic">"{sub.notes}"</p>}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-center bg-surface p-2 rounded-lg border border-white/5">
                                            <div className="text-xs text-gray-500 uppercase">AI Score</div>
                                            <div className={`font-bold text-lg ${sub.ai_score > 0.8 ? 'text-solana-green' : sub.ai_score > 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {(sub.ai_score * 100).toFixed(0)}%
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleUpdateSubmission(sub.id, 'approved')}
                                                disabled={sub.status === 'approved' || sub.status === 'paid'}
                                                className="px-3 py-1 bg-solana-green/10 text-solana-green hover:bg-solana-green/20 border border-solana-green/30 rounded text-xs font-semibold disabled:opacity-50 transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleUpdateSubmission(sub.id, 'disputed')}
                                                disabled={sub.status === 'disputed' || sub.status === 'paid'}
                                                className="px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded text-xs font-semibold disabled:opacity-50 transition-colors"
                                            >
                                                Dispute
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4">No submissions yet.</p>
                    )}
                </div>
            )}
        </div>
    );
}
