import React, { useState, useEffect, useCallback } from 'react';
import { CreatorBountyCard } from './bounties/CreatorBountyCard';

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

    const fetchBounties = useCallback(async () => {
        if (!walletAddress) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/bounties?created_by=${walletAddress}&limit=100`);
            if (!res.ok) throw new Error('Failed to fetch bounties');
            const data = await res.json();
            setBounties(data.items || []);

            // Calculate escrow stats
            let staked = 0;
            let paid = 0;
            let refunded = 0;
            (data.items || []).forEach((b: any) => {
                if (b.status === 'open' || b.status === 'in_progress' || b.status === 'under_review' || b.status === 'disputed' || b.status === 'completed') {
                    staked += b.reward_amount;
                } else if (b.status === 'paid') {
                    paid += b.reward_amount;
                } else if (b.status === 'cancelled') {
                    refunded += b.reward_amount;
                }
            });
            setEscrowStats({ staked, paid, refunded });

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
                <div className="w-12 h-12 border-4 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
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
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#14F195] to-[#9945FF]">
                        Creator Dashboard
                    </h1>
                    <p className="text-gray-400 mt-2">Manage your bounties, review submissions, and track your escrowed funds.</p>
                </div>

                {/* Escrow Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#14F195]">
                        <p className="text-gray-400 text-sm">Total Escrowed (Active)</p>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(escrowStats.staked)} <span className="text-[#14F195] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-[#9945FF]">
                        <p className="text-gray-400 text-sm">Total Paid Out</p>
                        <p className="text-3xl font-bold text-white mt-1">{formatNumber(escrowStats.paid)} <span className="text-[#9945FF] text-lg">$FNDRY</span></p>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 border-l-4 border-l-gray-500">
                        <p className="text-gray-400 text-sm">Total Refunded</p>
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
                                bountyId={bounty.id}
                                onUpdate={fetchBounties}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
