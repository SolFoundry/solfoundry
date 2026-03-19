// Mock data for the profile
const mockUser = {
  username: 'crypto-dev',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1234',
  joinDate: '2024-03-15',
  avatarUrl: 'https://github.com/crypto-dev.png',
  reputation: {
    score: 847,
    rank: 'Gold',
    breakdown: {
      codeQuality: 92,
      communication: 88,
      timeliness: 85,
      community: 78,
    },
  },
  stats: {
    totalEarned: 12450,
    bountiesCompleted: 47,
    successRate: 94,
    avgReviewScore: 4.8,
    currentStreak: 12,
  },
  earningsByMonth: [
    { month: 'Apr', amount: 800 },
    { month: 'May', amount: 1200 },
    { month: 'Jun', amount: 950 },
    { month: 'Jul', amount: 1500 },
    { month: 'Aug', amount: 1800 },
    { month: 'Sep', amount: 1100 },
    { month: 'Oct', amount: 1400 },
    { month: 'Nov', amount: 1650 },
    { month: 'Dec', amount: 1200 },
    { month: 'Jan', amount: 1850 },
    { month: 'Feb', amount: 2100 },
    { month: 'Mar', amount: 1900 },
  ],
  bountyHistory: [
    { id: 1, title: 'Smart Contract Audit', tier: 'Gold', reward: 2500, status: 'Completed', date: '2026-03-15' },
    { id: 2, title: 'DeFi Protocol Integration', tier: 'Gold', reward: 2100, status: 'Completed', date: '2026-03-10' },
    { id: 3, title: 'Token Migration Script', tier: 'Silver', reward: 1200, status: 'Completed', date: '2026-02-28' },
    { id: 4, title: 'Security Vulnerability Fix', tier: 'Gold', reward: 3000, status: 'Completed', date: '2026-02-20' },
    { id: 5, title: 'NFT Marketplace Backend', tier: 'Silver', reward: 900, status: 'Completed', date: '2026-02-12' },
    { id: 6, title: 'Gas Optimization Review', tier: 'Bronze', reward: 400, status: 'Completed', date: '2026-02-05' },
    { id: 7, title: 'Cross-chain Bridge', tier: 'Gold', reward: 2800, status: 'Completed', date: '2026-01-28' },
    { id: 8, title: 'DAO Governance Module', tier: 'Silver', reward: 1500, status: 'Completed', date: '2026-01-20' },
    { id: 9, title: 'Yield Aggregator', tier: 'Gold', reward: 2200, status: 'Completed', date: '2026-01-12' },
    { id: 10, title: 'Liquidity Pool V2', tier: 'Silver', reward: 1100, status: 'In Progress', date: '2026-03-18' },
    { id: 11, title: 'Oracle Integration', tier: 'Bronze', reward: 350, status: 'Completed', date: '2025-12-30' },
    { id: 12, title: 'Test Coverage Enhancement', tier: 'Bronze', reward: 300, status: 'Completed', date: '2025-12-15' },
  ],
};

// Helper functions
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'Gold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Silver': return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
    case 'Bronze': return 'bg-amber-700/20 text-amber-600 border-amber-700/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Completed': return 'text-[#14F195]';
    case 'In Progress': return 'text-[#9945FF]';
    case 'Pending': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}

function getRankBadgeColor(rank: string): string {
  switch (rank) {
    case 'Gold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    case 'Silver': return 'bg-gray-400/20 text-gray-300 border-gray-400';
    case 'Bronze': return 'bg-amber-700/20 text-amber-600 border-amber-700';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
  }
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  
  // In a real app, we'd fetch user data based on username
  // For now, use mock data
  const user = mockUser;
  const joinDate = new Date(user.joinDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const maxEarnings = Math.max(...user.earningsByMonth.map(e => e.amount));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-[#111] border border-[#9945FF]/30 rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-24 h-24 rounded-full border-2 border-[#9945FF]"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#14F195] rounded-full border-2 border-[#0a0a0a]" />
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold">{user.username}</h1>
                <span className={`px-3 py-1 rounded-full text-sm border ${getRankBadgeColor(user.reputation.rank)}`}>
                  {user.reputation.rank} Contributor
                </span>
              </div>
              <div className="flex flex-col md:flex-row gap-4 text-gray-400 text-sm">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {truncateAddress(user.walletAddress)}
                </span>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Joined {joinDate}
                </span>
              </div>
            </div>
            
            {/* Hire Button */}
            <button className="px-6 py-3 bg-[#9945FF] hover:bg-[#7c3aed] text-white rounded-lg font-semibold transition-colors">
              Hire as Agent
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-[#14F195]">{formatCurrency(user.stats.totalEarned)}</p>
          </div>
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Bounties Completed</p>
            <p className="text-2xl font-bold">{user.stats.bountiesCompleted}</p>
          </div>
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-[#9945FF]">{user.stats.successRate}%</p>
          </div>
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Avg Review Score</p>
            <p className="text-2xl font-bold">{user.stats.avgReviewScore} ⭐</p>
          </div>
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4 col-span-2 md:col-span-1">
            <p className="text-gray-400 text-sm mb-1">Current Streak</p>
            <p className="text-2xl font-bold text-[#14F195]">{user.stats.currentStreak} 🔥</p>
          </div>
        </div>

        {/* Earnings Chart - CSS-only bar chart */}
        <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Earnings by Month</h2>
          <div className="h-64 flex items-end justify-between gap-2">
            {user.earningsByMonth.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-gradient-to-t from-[#9945FF] to-[#14F195] rounded-t transition-all hover:opacity-80"
                  style={{ height: `${(item.amount / maxEarnings) * 100}%` }}
                  title={formatCurrency(item.amount)}
                />
                <span className="text-xs text-gray-500">{item.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bounty History Table */}
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Bounty History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="pb-3 text-sm">Bounty</th>
                    <th className="pb-3 text-sm">Tier</th>
                    <th className="pb-3 text-sm">Reward</th>
                    <th className="pb-3 text-sm">Status</th>
                    <th className="pb-3 text-sm">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {user.bountyHistory.slice(0, 10).map((bounty) => (
                    <tr key={bounty.id} className="border-b border-gray-800/50 hover:bg-white/5">
                      <td className="py-3 text-sm font-medium">{bounty.title}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs border ${getTierColor(bounty.tier)}`}>
                          {bounty.tier}
                        </span>
                      </td>
                      <td className="py-3 text-[#14F195]">{formatCurrency(bounty.reward)}</td>
                      <td className={`py-3 text-sm ${getStatusColor(bounty.status)}`}>{bounty.status}</td>
                      <td className="py-3 text-gray-400 text-sm">{bounty.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reputation Breakdown */}
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Reputation</h2>
              <div className="text-right">
                <p className="text-3xl font-bold text-[#9945FF]">{user.reputation.score}</p>
                <p className="text-gray-400 text-sm">Reputation Score</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {Object.entries(user.reputation.breakdown).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-[#14F195]">{value}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-[#9945FF] to-[#14F195] h-2 rounded-full"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-[#0a0a0a] rounded-lg border border-gray-800">
              <h3 className="font-semibold mb-2">How Score is Calculated</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Code Quality (30%) - Quality and security of submitted code</li>
                <li>• Communication (25%) - Response time and clarity</li>
                <li>• Timeliness (25%) - Meeting deadlines</li>
                <li>• Community (20%) - Contributions to discussions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
