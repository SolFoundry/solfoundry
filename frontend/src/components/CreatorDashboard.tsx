import React, { useState, useEffect, useCallback } from 'react';
import { CreatorBountyCard } from './bounties/CreatorBountyCard';
import { Tooltip } from './common/Tooltip';

interface CreatorDashboardProps {
    userId?: string;
    walletAddress?: string;
    onNavigateBounties?: () => void;
}

interface EscrowStats {
    staked: number;
    paid: number;
    refunded: number;
}

export function CreatorDashboard({
    userId,
    walletAddress,
    onNavigateBounties,
}: CreatorDashboardProps) {
    const [activeTab, setActiveTab] = useState('all');
    const [bounties, setBounties] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [escrowStats, setEscrowStats] = useState<EscrowStats>({ staked: 0, paid: 0, refunded: 0 });
    const [notifications, setNotifications] = useState({ pending: 0, disputed: 0 });

    const fetchBounties = useCallback(async () => {
        if (!walletAddress) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // Fetch bounties and stats in parallel
            const [bountiesRes, statsRes] = await Promise.all([
                fetch(`/api/bounties?created_by=${walletAddress}&limit=100`),
                fetch(`/api/bounties/creator/${walletAddress}/stats`)
            ]);

            if (!bountiesRes.ok) throw new Error('Failed to fetch bounties');
            if (!statsRes.ok) throw new Error('Failed to fetch stats');

            const [bountiesData, statsData] = await Promise.all([
                bountiesRes.json(),
                statsRes.json()
            ]);

            setBounties(bountiesData.items || []);
            setEscrowStats(statsData);

            // Calculate notification counts
            let pendingCount = 0;
            let disputedCount = 0;
            (bountiesData.items || []).forEach((b: any) => {
                b.submissions?.forEach((s: any) => {
                    if (s.status === 'pending') pendingCount++;
                    if (s.status === 'disputed') disputedCount++;
                });
            });
            setNotifications({ pending: pendingCount, disputed: disputedCount });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchBounties();
    }, [fetchBounties]);

    const tabs = [
        { id: 'all', label: 'All Bounties' },
        { id: 'open', label: 'Open' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'under_review', label: 'Under Review' },
        { id: 'completed', label: 'Completed' },
        { id: 'disputed', label: 'Disputed' },
        { id: 'cancelled', label: 'Cancelled' },
    ];

    const filteredBounties = activeTab === 'all' ? bounties : bounties.filter(b => b.status === activeTab);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return num.toString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div
                    role="status"
                    aria-label="Loading"
                    className="w-12 h-12 border-4 border-[#9945FF] border-t-transparent rounded-full animate-spin"
                />
            </div>
        );
    }

    if (!walletAddress) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
                Please connect your wallet to view your Creator Dashboard.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header elements */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#14F195] to-[#9945FF]">
                            Creator Dashboard
                        </h1>
                        <p className="text-gray-400 mt-2">Manage your bounties, review submissions, and track your escrowed funds.</p>
                    </div>

                    <div className="flex gap-3">
                        {notifications.pending > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#14F195]/10 border border-[#14F195]/20 rounded-full">
                                <span className="w-2 h-2 bg-[#14F195] rounded-full animate-pulse" />
                                <span className="text-[#14F195] text-sm font-bold">{notifications.pending} Pending Review</span>
                            </div>
                        )}
                        {notifications.disputed > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                                <span className="w-2 h-2 bg-red-500 rounded-full" />
                                <span className="text-red-500 text-sm font-bold">{notifications.disputed} Disputes</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Escrow Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#14F195]">
                        <Tooltip content="$FNDRY currently locked in escrow PDAs for your active bounties. Released to contributors when PRs are merged." position="bottom">
                            <p className="text-gray-400 text-sm flex items-center gap-1 cursor-help">
                                Total Escrowed (Active)
                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                            </p>
                        </Tooltip>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(escrowStats.staked)} <span className="text-[#14F195] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#9945FF]">
                        <Tooltip content="Total $FNDRY successfully paid to contributors for merged bounty PRs." position="bottom">
                            <p className="text-gray-400 text-sm flex items-center gap-1 cursor-help">
                                Total Paid Out
                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                            </p>
                        </Tooltip>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(escrowStats.paid)} <span className="text-[#9945FF] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-gray-500">
                        <Tooltip content="$FNDRY returned from escrow for cancelled or expired bounties that had no valid submissions." position="bottom">
                            <p className="text-gray-400 text-sm flex items-center gap-1 cursor-help">
                                Total Refunded
                                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                            </p>
                        </Tooltip>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(escrowStats.refunded)} <span className="text-gray-400 text-lg">$FNDRY</span></p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex justify-between items-center bg-[#1a1a1a] p-2 rounded-lg border border-white/10 overflow-x-auto">
                    <div className="flex gap-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'bg-[#14F195]/20 text-[#14F195]'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-500/20 text-red-400 p-4 rounded-lg flex items-center justify-between">
                        <p>{error}</p>
                        <button onClick={fetchBounties} className="text-white hover:underline">Retry</button>
                    </div>
                )}

                {/* Bounty List */}
                <div className="space-y-4">
                    {filteredBounties.length === 0 ? (
                        <div className="text-center bg-[#1a1a1a] rounded-xl p-10 border border-white/5">
                            <p className="text-gray-400">No bounties found for this status.</p>
                            <button
                                onClick={onNavigateBounties}
                                className="mt-4 px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#9945FF]/80 transition-colors"
                            >
                                Browse All Bounties
                            </button>
                        </div>
                    ) : (
                        filteredBounties.map(bounty => (
                            <CreatorBountyCard
                                key={bounty.id}
                                bounty={bounty}
                                onUpdate={fetchBounties}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
