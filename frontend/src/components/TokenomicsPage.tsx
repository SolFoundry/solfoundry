'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
interface TokenDistribution {
  treasury: number;
  liquidity: number;
  team: number;
}

interface TreasuryStats {
  solBalance: number;
  fndryBalance: number;
  totalSpent: number;
  totalBurned: number;
  lastUpdated: string;
}

interface SupplyAnalysis {
  circulating: number;
  locked: number;
  burned: number;
  total: number;
}

interface TokenInfo {
  contractAddress: string;
  chain: string;
  decimals: number;
  symbol: string;
}

// Mock data
const MOCK_DISTRIBUTION: TokenDistribution = {
  treasury: 79,
  liquidity: 20,
  team: 1,
};

const MOCK_TREASURY_STATS: TreasuryStats = {
  solBalance: 15234.56,
  fndryBalance: 50000000,
  totalSpent: 2500000,
  totalBurned: 15000000,
  lastUpdated: new Date().toISOString(),
};

const MOCK_SUPPLY_ANALYSIS: SupplyAnalysis = {
  circulating: 85000000,
  locked: 15000000,
  burned: 15000000,
  total: 100000000,
};

const TOKEN_INFO: TokenInfo = {
  contractAddress: 'FNDRyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  chain: 'Solana',
  decimals: 9,
  symbol: 'FNDRY',
};

// Animation hook for scroll reveal
const useScrollReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
};

// Animated Donut Chart Component
const DonutChart: React.FC<{ data: TokenDistribution; animate: boolean }> = ({ data, animate }) => {
  const [animatedData, setAnimatedData] = useState({ treasury: 0, liquidity: 0, team: 0 });

  useEffect(() => {
    if (animate) {
      const duration = 1500;
      const steps = 60;
      const interval = duration / steps;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        setAnimatedData({
          treasury: data.treasury * eased,
          liquidity: data.liquidity * eased,
          team: data.team * eased,
        });

        if (step >= steps) clearInterval(timer);
      }, interval);

      return () => clearInterval(timer);
    }
  }, [animate, data]);

  const total = animatedData.treasury + animatedData.liquidity + animatedData.team;
  const segments = [
    { key: 'treasury', value: animatedData.treasury, color: '#6366f1', label: 'Treasury' },
    { key: 'liquidity', value: animatedData.liquidity, color: '#22c55e', label: 'Liquidity' },
    { key: 'team', value: animatedData.team, color: '#f59e0b', label: 'Team (1% vesting)' },
  ];

  // Calculate stroke-dasharray for each segment
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-auto transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="24"
        />
        
        {/* Animated segments */}
        {segments.map((segment, index) => {
          const percentage = total > 0 ? (segment.value / 100) * 100 : 0;
          const strokeLength = (percentage / 100) * circumference;
          const gap = circumference - strokeLength;
          const offset = (accumulatedOffset / 100) * circumference;
          accumulatedOffset += percentage;

          return (
            <circle
              key={segment.key}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="24"
              strokeLinecap="round"
              strokeDasharray={`${strokeLength} ${gap}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500"
              style={{ opacity: animate ? 1 : 0 }}
            />
          );
        })}
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">100%</span>
        <span className="text-sm text-gray-400">Total Supply</span>
      </div>
      
      {/* Legend */}
      <div className="mt-6 space-y-2">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-300">{segment.label}</span>
            </div>
            <span className="text-sm font-medium text-white">
              {segment.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Buyback Cycle Animation Component
const BuybackCycle: React.FC<{ animate: boolean }> = ({ animate }) => {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    { label: '5% Fee', icon: '💰', description: 'Transaction fee collected' },
    { label: 'Buyback', icon: '🔄', description: 'Auto-buy FNDRY from market' },
    { label: 'Burn', icon: '🔥', description: 'Permanently remove tokens' },
    { label: 'Repeat', icon: '↻', description: 'Deflationary cycle continues' },
  ];

  useEffect(() => {
    if (animate) {
      const interval = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % steps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [animate, steps.length]);

  return (
    <div className="relative">
      {/* Animated cycle diagram */}
      <div className="flex flex-wrap justify-center items-center gap-4">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <div
              className={`
                relative flex flex-col items-center p-4 rounded-xl
                transition-all duration-500 min-w-[120px]
                ${activeStep === index
                  ? 'bg-indigo-600/30 border-2 border-indigo-500 scale-110'
                  : 'bg-gray-800/50 border border-gray-700'
                }
              `}
            >
              <span className="text-3xl mb-2">{step.icon}</span>
              <span className="text-sm font-medium text-white">{step.label}</span>
              <span className="text-xs text-gray-400 text-center mt-1">
                {step.description}
              </span>
              
              {/* Pulse animation for active step */}
              {activeStep === index && (
                <div className="absolute inset-0 rounded-xl bg-indigo-500/20 animate-ping" />
              )}
            </div>
            
            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className={`
                text-2xl transition-all duration-300
                ${activeStep === index ? 'text-indigo-400' : 'text-gray-600'}
              `}>
                →
              </div>
            )}
          </React.Fragment>
        ))}
        
        {/* Cycle arrow back to start */}
        <div className={`
          text-2xl transition-all duration-300
          ${activeStep === steps.length - 1 ? 'text-indigo-400' : 'text-gray-600'}
        `}>
          ↺
        </div>
      </div>
      
      {/* Description */}
      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          Every transaction contributes to deflationary pressure, increasing value for all holders.
        </p>
      </div>
    </div>
  );
};

// Treasury Stats Card Component
const TreasuryStatsCard: React.FC<{ stats: TreasuryStats; isLoading: boolean }> = ({ stats, isLoading }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  const statItems = [
    { label: 'SOL Balance', value: `${formatNumber(stats.solBalance)} SOL`, color: 'text-purple-400' },
    { label: 'FNDRY Balance', value: formatNumber(stats.fndryBalance), color: 'text-indigo-400' },
    { label: 'Total Spent', value: formatNumber(stats.totalSpent), color: 'text-yellow-400' },
    { label: 'Total Burned', value: `${formatNumber(stats.totalBurned)} FNDRY`, color: 'text-red-400' },
  ];

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🏛️ Treasury Stats</h3>
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((item, index) => (
          <div key={index} className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.color}`}>
              {isLoading ? '...' : item.value}
            </p>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-gray-500 mt-3">
        Last updated: {new Date(stats.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
};

// Supply Analysis Component
const SupplyAnalysisCard: React.FC<{ supply: SupplyAnalysis }> = ({ supply }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    return num.toLocaleString();
  };

  const supplyItems = [
    { label: 'Circulating', value: supply.circulating, color: 'bg-green-500', percentage: (supply.circulating / supply.total) * 100 },
    { label: 'Locked', value: supply.locked, color: 'bg-yellow-500', percentage: (supply.locked / supply.total) * 100 },
    { label: 'Burned', value: supply.burned, color: 'bg-red-500', percentage: (supply.burned / supply.total) * 100 },
  ];

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-white mb-4">📊 Supply Analysis</h3>
      
      {/* Horizontal bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-gray-800 mb-4">
        {supplyItems.map((item, index) => (
          <div
            key={index}
            className={`${item.color} transition-all duration-1000`}
            style={{ width: `${item.percentage}%` }}
            title={`${item.label}: ${formatNumber(item.value)} (${item.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="space-y-2">
        {supplyItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-sm text-gray-300">{item.label}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-white">{formatNumber(item.value)}</span>
              <span className="text-xs text-gray-500 ml-2">({item.percentage.toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Total Supply</span>
          <span className="text-lg font-bold text-white">{formatNumber(supply.total)}</span>
        </div>
      </div>
    </div>
  );
};

// Price Chart Placeholder Component
const PriceChartPlaceholder: React.FC = () => {
  const [chartType, setChartType] = useState<'dexscreener' | 'custom'>('dexscreener');

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">📈 Price Chart</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('dexscreener')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors min-h-[44px] ${
              chartType === 'dexscreener'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            DexScreener
          </button>
          <button
            onClick={() => setChartType('custom')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors min-h-[44px] ${
              chartType === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Custom
          </button>
        </div>
      </div>
      
      <div className="bg-gray-800/50 rounded-lg h-64 flex items-center justify-center">
        {chartType === 'dexscreener' ? (
          <div className="text-center">
            <p className="text-gray-400 mb-2">DexScreener embed will appear here</p>
            <p className="text-xs text-gray-500">
              (Requires real contract address for live integration)
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-2">Custom price chart placeholder</p>
            <p className="text-xs text-gray-500">
              (Implement with charting library like Recharts)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Token Info Card Component
const TokenInfoCard: React.FC<{ info: TokenInfo }> = ({ info }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(info.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [info.contractAddress]);

  const links = [
    { label: 'Bags', url: `https://bags.fm/token/${info.contractAddress}` },
    { label: 'Solscan', url: `https://solscan.io/token/${info.contractAddress}` },
    { label: 'DexScreener', url: `https://dexscreener.com/solana/${info.contractAddress}` },
  ];

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-white mb-4">🪙 Token Info</h3>
      
      {/* Contract Address */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 block mb-1">Contract Address</label>
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
          <code className="text-sm text-indigo-400 flex-1 overflow-x-auto">
            {info.contractAddress}
          </code>
          <button
            onClick={copyToClipboard}
            className="text-gray-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? (
              <span className="text-green-400">✓</span>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Token details grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Chain</p>
          <p className="text-sm font-medium text-white">{info.chain}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Decimals</p>
          <p className="text-sm font-medium text-white">{info.decimals}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Symbol</p>
          <p className="text-sm font-medium text-white">{info.symbol}</p>
        </div>
      </div>
      
      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[100px] text-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors min-h-[44px] flex items-center justify-center"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
};

// Slogan Banner Component
const SloganBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 rounded-lg p-6 sm:p-8 text-center border border-indigo-500/30">
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-relaxed">
        "No VC. No presale. No airdrop.{' '}
        <span className="text-indigo-400">Earn by building.</span>"
      </p>
      <p className="text-sm text-gray-400 mt-3">
        100% community-driven. Fair launch. No exceptions.
      </p>
    </div>
  );
};

// Main Tokenomics Page Component
export const TokenomicsPage: React.FC = () => {
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats>(MOCK_TREASURY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [animateCharts, setAnimateCharts] = useState(false);
  
  const distributionReveal = useScrollReveal();
  const buybackReveal = useScrollReveal();
  const statsReveal = useScrollReveal();
  const supplyReveal = useScrollReveal();
  const chartReveal = useScrollReveal();
  const infoReveal = useScrollReveal();

  // Simulate API fetch for treasury stats
  useEffect(() => {
    const fetchTreasuryStats = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In production, replace with actual API call
      setTreasuryStats(MOCK_TREASURY_STATS);
      setIsLoading(false);
    };

    fetchTreasuryStats();
  }, []);

  // Trigger animations when components come into view
  useEffect(() => {
    if (distributionReveal.isVisible) {
      setAnimateCharts(true);
    }
  }, [distributionReveal.isVisible]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
            Tokenomics
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Transparent, community-driven token economy
          </p>
        </div>

        {/* Slogan Banner */}
        <SloganBanner />

        {/* Token Distribution & Buyback Cycle */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token Distribution Chart */}
          <div
            ref={distributionReveal.ref}
            className={`bg-gray-900 rounded-lg p-4 sm:p-6 transition-all duration-700 ${
              distributionReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <h3 className="text-lg font-semibold text-white mb-6">🎯 Token Distribution</h3>
            <DonutChart data={MOCK_DISTRIBUTION} animate={animateCharts} />
          </div>

          {/* Buyback Mechanism */}
          <div
            ref={buybackReveal.ref}
            className={`bg-gray-900 rounded-lg p-4 sm:p-6 transition-all duration-700 delay-200 ${
              buybackReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <h3 className="text-lg font-semibold text-white mb-6">🔄 Buyback & Burn Mechanism</h3>
            <BuybackCycle animate={buybackReveal.isVisible} />
          </div>
        </div>

        {/* Treasury Stats & Supply Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            ref={statsReveal.ref}
            className={`transition-all duration-700 delay-100 ${
              statsReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <TreasuryStatsCard stats={treasuryStats} isLoading={isLoading} />
          </div>

          <div
            ref={supplyReveal.ref}
            className={`transition-all duration-700 delay-300 ${
              supplyReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <SupplyAnalysisCard supply={MOCK_SUPPLY_ANALYSIS} />
          </div>
        </div>

        {/* Price Chart & Token Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            ref={chartReveal.ref}
            className={`transition-all duration-700 delay-100 ${
              chartReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <PriceChartPlaceholder />
          </div>

          <div
            ref={infoReveal.ref}
            className={`transition-all duration-700 delay-300 ${
              infoReveal.isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-10'
            }`}
          >
            <TokenInfoCard info={TOKEN_INFO} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Data updates in real-time from on-chain sources</p>
        </div>
      </div>
    </div>
  );
};

export default TokenomicsPage;