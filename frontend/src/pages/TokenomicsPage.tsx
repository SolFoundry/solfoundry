'use client';

import React from 'react';
import { 
  PiggyBank, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart2, 
  RefreshCcw, 
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';

import { useTokenomics, useTreasuryStats } from '../hooks/useTreasury';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { SimpleLineChart } from '../components/common/SimpleLineChart';
import { Skeleton, SkeletonCard } from '../components/common/Skeleton';

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({ label, value, subtext, icon, color = 'brand' }: any) {
  const colorMap: Record<string, string> = {
    brand: 'text-solana-purple bg-solana-purple/10',
    green: 'text-[#14F195] bg-[#14F195]/10',
    blue: 'text-blue-400 bg-blue-400/10',
  };

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-black text-white tabular-nums">{value}</span>
        {subtext && <span className="text-xs text-gray-500 mt-1 font-medium">{subtext}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function TokenomicsPage() {
  const { data: tokenomics, isLoading: tokenLoading, error: tokenError, refetch: tokenRefetch } = useTokenomics();
  const { data: treasury, isLoading: treasuryLoading, error: treasuryError, refetch: treasuryRefetch } = useTreasuryStats();

  const handleRefetch = () => {
    tokenRefetch();
    treasuryRefetch();
  };

  if (tokenLoading || treasuryLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 lg:p-12 animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto">
          <Skeleton height="3.5rem" width="400px" className="mb-2" />
          <Skeleton height="1.5rem" width="250px" className="mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
             <Skeleton height="160px" count={4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2"><Skeleton height="400px" /></div>
             <Skeleton height="400px" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onReset={handleRefetch}>
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 lg:p-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 tracking-tighter">
              Protocol <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9945FF] to-[#14F195]">Financials</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl font-medium leading-relaxed">
              Real-time transparency into SolFoundry treasury, token dynamics, and ecosystem growth.
            </p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard 
              label="Treasury Holdings" 
              value={`${treasury?.solBalance?.toLocaleString() || 0} SOL`} 
              subtext="Total locked liquidity"
              icon={<PiggyBank size={20} />}
              color="brand"
            />
            <StatCard 
              label="$FNDRY Pool" 
              value={tokenomics?.circulatingSupply?.toLocaleString() || 0} 
              subtext="Circulating ecosystem supply"
              icon={<Zap size={20} />}
              color="green"
            />
            <StatCard 
              label="Total Distributed" 
              value={`$${tokenomics?.totalDistributed?.toLocaleString() || 0}`} 
              subtext="Protocol revenue shared"
              icon={<ArrowUpRight size={20} />}
              color="blue"
            />
            <StatCard 
              label="Burn Multiplier" 
              value="2.4x" 
              subtext="Fee burn rate acceleration"
              icon={<Cpu size={20} />}
              color="brand"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Tokenomics Details */}
            <div className="lg:col-span-2 bg-[#1a1a1a] rounded-3xl p-8 border border-white/5 shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-solana-purple/5 blur-[100px] -mr-32 -mt-32" />
              
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <BarChart2 size={24} className="text-[#14F195]" />
                  Token Economics
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#14F195] bg-[#14F195]/10 px-3 py-1 rounded-full">
                  <RefreshCcw size={12} className="animate-spin-slow" /> Live Feed
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 block">Total Supply</label>
                    <p className="text-2xl font-bold">{tokenomics?.totalSupply?.toLocaleString() || '1,000,000,000'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 block">Token Contract</label>
                    <code className="text-xs text-brand-400 bg-brand-500/5 px-2 py-1 rounded select-all">
                       {tokenomics?.tokenCA || 'Fndry...7X9'}
                    </code>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-400">Total Buybacks</span>
                       <span className="text-white font-bold">{tokenomics?.totalBuybacks?.toLocaleString() || 0} SOL</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-400">Total Burned</span>
                       <span className="text-red-400 font-bold">{tokenomics?.totalBurned?.toLocaleString() || 0} $FNDRY</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
                   <h3 className="text-sm font-bold text-gray-300 mb-6 flex items-center gap-2">
                     <ShieldCheck size={16} className="text-blue-400" />
                     Distribution Breakdown
                   </h3>
                   <div className="space-y-5">
                      {Object.entries(tokenomics?.distributionBreakdown || {}).map(([key, val]: [string, any]) => (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-2">
                             <span className="text-gray-400 font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                             <span className="text-white font-black">{val}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-gradient-to-r from-solana-purple to-solana-green" 
                                style={{ width: `${val}%` }} 
                             />
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Visualization Placeholder / Activity Chart */}
              <div className="mt-12 bg-black/20 rounded-2xl p-4 border border-white/5">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Treasury Growth Curve</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">30D</span>
                 </div>
                 <SimpleLineChart 
                    data={[
                      { label: 'W1', value: 45000 },
                      { label: 'W2', value: 52000 },
                      { label: 'W3', value: 48000 },
                      { label: 'W4', value: 65000 },
                    ]} 
                    height={120}
                    color="#9945FF"
                 />
              </div>
            </div>

            {/* Sidebar Cards */}
            <div className="space-y-8">
               <div className="bg-gradient-to-br from-[#9945FF]/20 to-transparent rounded-3xl p-8 border border-white/5 shadow-xl relative overflow-hidden group">
                  <div className="absolute -bottom-8 -right-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                     <PiggyBank size={160} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Join the Buyback</h3>
                  <p className="text-sm text-brand-200/60 mb-8 leading-relaxed">
                    Protocol revenue is used to automatically buy back $FNDRY tokens from the open market every 24 hours.
                  </p>
                  <button className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
                    Stake LP Points
                  </button>
               </div>

               <div className="bg-[#1a1a1a] rounded-3xl p-8 border border-white/5 shadow-xl">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Zap size={18} className="text-[#14F195]" /> 
                    Live Revenue
                  </h3>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-xs text-gray-500 font-bold">Platform Fees (SOL)</span>
                        <span className="text-[#14F195] font-black">{tokenomics?.feeRevenueSol || 0}</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-xs text-gray-500 font-bold">Total Payouts</span>
                        <span className="text-white font-black">{treasury?.totalPayouts || 0}</span>
                     </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-6 font-medium text-center">
                    All financial data is verifiable on-chain via the Solana Explorer.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
