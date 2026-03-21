import React, { useState, useMemo } from 'react';
import { CreatorBountyCard } from './bounties/CreatorBountyCard';
import { useCreatorDashboard } from '../hooks/useContributor';
import { Skeleton, SkeletonCard } from './common/Skeleton';

interface CreatorDashboardProps {
    userId?: string;
    walletAddress?: string;
    onNavigateBounties?: () => void;
}

export function CreatorDashboard({
    walletAddress,
    onNavigateBounties,
}: CreatorDashboardProps) {
    const [activeTab, setActiveTab] = useState('all');
    const { data, isLoading, error, refetch } = useCreatorDashboard(walletAddress ?? '');

    const { bounties, stats, notifications } = useMemo(() => {
        const bl = data?.bounties || [];
        const st = data?.stats || { staked: 0, paid: 0, refunded: 0 };
        
        let pending = 0;
        let disputed = 0;
        bl.forEach((b: any) => {
            b.submissions?.forEach((s: any) => {
                if (s.status === 'pending') pending++;
                if (s.status === 'disputed') disputed++;
            });
        });
        
        return { 
            bounties: bl, 
            stats: st,
            notifications: { pending, disputed }
        };
    }, [data]);

    const tabs = [
        { id: 'all', label: 'All Bounties' },
        { id: 'open', label: 'Open' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'under_review', label: 'Under Review' },
        { id: 'completed', label: 'Completed' },
        { id: 'disputed', label: 'Disputed' },
        { id: 'cancelled', label: 'Cancelled' },
    ];

    const filteredBounties = activeTab === 'all' ? bounties : bounties.filter((b: any) => b.status === activeTab);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return num.toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="space-y-4">
                       <Skeleton height="3rem" width="300px" />
                       <Skeleton height="1.5rem" width="500px" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton height="100px" count={3} />
                    </div>
                    <div className="space-y-4">
                        <Skeleton height="2.5rem" className="w-full" />
                        <SkeletonCard count={4} />
                    </div>
                </div>
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

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-white">
                <p className="text-red-400 mb-4">Error loading creator dashboard.</p>
                <button onClick={() => refetch()} className="px-4 py-2 bg-[#9945FF] rounded-lg">Retry</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#14F195]">
                        <p className="text-gray-400 text-sm">Total Escrowed (Active)</p>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(stats.staked)} <span className="text-[#14F195] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#9945FF]">
                        <p className="text-gray-400 text-sm">Total Paid Out</p>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(stats.paid)} <span className="text-[#9945FF] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-gray-500">
                        <p className="text-gray-400 text-sm">Total Refunded</p>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(stats.refunded)} <span className="text-gray-400 text-lg">$FNDRY</span></p>
                    </div>
                </div>

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
                        filteredBounties.map((bounty: any) => (
                            <CreatorBountyCard
                                key={bounty.id}
                                bounty={bounty}
                                onUpdate={() => refetch()}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
