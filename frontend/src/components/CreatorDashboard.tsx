import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { CreatorBountyCard } from './bounties/CreatorBountyCard';
import { Skeleton, SkeletonStatCard, SkeletonCard } from './common/Skeleton';

interface CreatorDashboardProps {
    userId?: string;
    walletAddress?: string;
    onNavigateBounties?: () => void;
}

interface EscrowStats {
    staked: number;
    paid: number;
    refunded: number;
    total_fees?: number;
    completion_rate?: number;
    active_count?: number;
    total_count?: number;
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
    const [notifications, setNotifications] = useState({ pending: 0, disputed: 0, proposals: 0, reports: 0 });

    const fetchBounties = useCallback(async () => {
        if (!walletAddress) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // Fetch bounties and stats in parallel using authenticated apiClient
            const [bountiesData, statsData] = await Promise.all([
                apiClient<{ items?: any[] }>('/api/bounties', { params: { created_by: walletAddress, limit: 100 } }),
                apiClient<EscrowStats>(`/api/bounties/creator/${walletAddress}/stats`),
            ]);

            setBounties(bountiesData.items || []);
            setEscrowStats(statsData);

            // Calculate notification counts and extra stats
            let pendingCount = 0;
            let disputedCount = 0;
            let proposalCount = 0;
            let totalFees = 0;
            let completedCount = 0;
            const items = bountiesData.items || [];
            items.forEach((b: any) => {
                b.submissions?.forEach((s: any) => {
                    if (s.status === 'pending') pendingCount++;
                    if (s.status === 'disputed') disputedCount++;
                });
                if (b.fee_amount) totalFees += b.fee_amount;
                if (['completed', 'paid'].includes(b.status)) completedCount++;
                // T3 bounties may have pending proposals
                if (b.tier === 3 && b.status === 'open') proposalCount++;
            });
            const completionRate = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
            setNotifications({ pending: pendingCount, disputed: disputedCount, proposals: proposalCount, reports: 0 });
            setEscrowStats({
                ...statsData,
                total_fees: totalFees,
                completion_rate: completionRate,
                active_count: items.filter((b: any) => !['completed', 'paid', 'cancelled'].includes(b.status)).length,
                total_count: items.length,
            });

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
            <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-surface dark:text-white p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-8" role="status" aria-live="polite" aria-label="Loading creator dashboard">
                    <div className="space-y-2">
                        <Skeleton height="2.25rem" width="14rem" rounded="lg" className="max-w-full" />
                        <Skeleton height="1rem" width="min(100%, 28rem)" rounded="md" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[0, 1, 2].map(i => (
                            <SkeletonStatCard key={i} />
                        ))}
                    </div>
                    <Skeleton height="3rem" width="100%" rounded="lg" className="max-w-2xl" />
                    <div className="space-y-4">
                        {[0, 1, 2].map(i => (
                            <SkeletonCard key={i} showHeader bodyLines={2} showFooter />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!walletAddress) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-600 dark:text-gray-400">
                Please connect your wallet to view your Creator Dashboard.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-surface dark:text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header elements */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-solana-green to-solana-purple">
                            Creator Dashboard
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your bounties, review submissions, and track your escrowed funds.</p>
                    </div>

                    <div className="flex gap-3 items-center">
                        <a
                            href="/bounties/create"
                            className="px-4 py-2 bg-gradient-to-r from-solana-purple to-solana-green text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                        >
                            + Create Bounty
                        </a>
                        {notifications.pending > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-solana-green/10 border border-solana-green/20 rounded-full">
                                <span className="w-2 h-2 bg-solana-green rounded-full animate-pulse" />
                                <span className="text-solana-green text-sm font-bold">{notifications.pending} Pending Review</span>
                            </div>
                        )}
                        {notifications.disputed > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                                <span className="w-2 h-2 bg-red-500 rounded-full" />
                                <span className="text-red-500 text-sm font-bold">{notifications.disputed} Disputes</span>
                            </div>
                        )}
                        {notifications.proposals > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                <span className="text-purple-400 text-sm font-bold">{notifications.proposals} T3 Open</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Escrow Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-5 border border-gray-200 dark:border-white/5 border-l-4 border-l-solana-green shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Total Escrowed (Active)</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(escrowStats.staked)} <span className="text-solana-green text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-5 border border-gray-200 dark:border-white/5 border-l-4 border-l-solana-purple shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Total Paid Out</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(escrowStats.paid)} <span className="text-solana-purple text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-5 border border-gray-200 dark:border-white/5 border-l-4 border-l-gray-500 shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Total Refunded</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(escrowStats.refunded)} <span className="text-gray-600 dark:text-gray-400 text-lg">$FNDRY</span></p>
                    </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Active Bounties</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{escrowStats.active_count ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Total Bounties</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{escrowStats.total_count ?? 0}</p>
                    </div>
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Completion Rate</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{escrowStats.completion_rate ?? 0}%</p>
                    </div>
                    <div className="bg-white dark:bg-surface-100 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Platform Fees Paid</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(escrowStats.total_fees ?? 0)} <span className="text-gray-500 text-sm">$FNDRY</span></p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex justify-between items-center bg-gray-100 dark:bg-surface-100 p-2 rounded-lg border border-gray-200 dark:border-white/10 overflow-x-auto">
                    <div className="flex gap-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'bg-solana-green/20 text-solana-green'
                                    : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-center justify-between">
                        <p>{error}</p>
                        <button onClick={fetchBounties} className="text-gray-900 dark:text-white hover:underline font-medium">Retry</button>
                    </div>
                )}

                {/* Bounty List */}
                <div className="space-y-4">
                    {filteredBounties.length === 0 ? (
                        <div className="text-center bg-white dark:bg-surface-100 rounded-xl p-10 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
                            <p className="text-gray-600 dark:text-gray-400">No bounties found for this status.</p>
                            <a
                                href="/bounties/create"
                                className="mt-4 inline-block px-4 py-2 bg-solana-purple text-white rounded-lg hover:bg-solana-purple/80 transition-colors"
                            >
                                Create a Bounty
                            </a>
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
