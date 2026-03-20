export interface ActivityEvent {
  id: string;
  type: 'bounty_created' | 'pr_submitted' | 'review_completed' | 'payout_sent' | 'bounty_claimed';
  timestamp: Date;
  user: {
    username: string;
    avatar: string;
  };
  bounty?: {
    id: string;
    title: string;
    reward: number;
  };
  pr?: {
    number: number;
    url: string;
  };
  review?: {
    score: number;
  };
  payout?: {
    amount: number;
    recipient: string;
  };
}

const generateRandomTimestamp = (): Date => {
  const now = new Date();
  const hoursAgo = Math.random() * 48;
  return new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
};

const users = [
  { username: 'cryptodev42', avatar: '/avatars/user1.png' },
  { username: 'solana_builder', avatar: '/avatars/user2.png' },
  { username: 'web3_warrior', avatar: '/avatars/user3.png' },
  { username: 'rust_ninja', avatar: '/avatars/user4.png' },
  { username: 'defi_master', avatar: '/avatars/user5.png' },
  { username: 'nft_creator', avatar: '/avatars/user6.png' },
  { username: 'blockchain_dev', avatar: '/avatars/user7.png' },
  { username: 'smart_contract_pro', avatar: '/avatars/user8.png' },
  { username: 'frontend_ace', avatar: '/avatars/user9.png' },
  { username: 'backend_guru', avatar: '/avatars/user10.png' }
];

const bountyTitles = [
  'NFT Marketplace Smart Contract',
  'DeFi Staking Pool Implementation',
  'Wallet Integration Component',
  'Token Swap Interface',
  'Cross-chain Bridge Protocol',
  'Governance Voting System',
  'Liquidity Mining Dashboard',
  'Multi-sig Wallet UI',
  'Oracle Price Feed Integration',
  'Yield Farming Calculator',
  'DEX Trading Interface',
  'DAO Proposal System',
  'Escrow Smart Contract',
  'Token Vesting Schedule',
  'AMM Pool Analytics'
];

const getRandomUser = () => users[Math.floor(Math.random() * users.length)];
const getRandomBounty = () => ({
  id: Math.random().toString(36).substr(2, 9),
  title: bountyTitles[Math.floor(Math.random() * bountyTitles.length)],
  reward: Math.floor(Math.random() * 500000) + 50000
});

export const mockActivityData: ActivityEvent[] = [
  {
    id: 'act_001',
    type: 'bounty_created',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_002',
    type: 'pr_submitted',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    pr: {
      number: 247,
      url: 'https://github.com/SolFoundry/solfoundry/pull/247'
    }
  },
  {
    id: 'act_003',
    type: 'review_completed',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    review: {
      score: Math.floor(Math.random() * 4) + 7
    }
  },
  {
    id: 'act_004',
    type: 'payout_sent',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    payout: {
      amount: Math.floor(Math.random() * 300000) + 100000,
      recipient: getRandomUser().username
    }
  },
  {
    id: 'act_005',
    type: 'bounty_claimed',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_006',
    type: 'bounty_created',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_007',
    type: 'pr_submitted',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    pr: {
      number: 251,
      url: 'https://github.com/SolFoundry/solfoundry/pull/251'
    }
  },
  {
    id: 'act_008',
    type: 'review_completed',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    review: {
      score: 8
    }
  },
  {
    id: 'act_009',
    type: 'payout_sent',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    payout: {
      amount: 450000,
      recipient: 'frontend_ace'
    }
  },
  {
    id: 'act_010',
    type: 'bounty_claimed',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_011',
    type: 'bounty_created',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_012',
    type: 'pr_submitted',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    pr: {
      number: 253,
      url: 'https://github.com/SolFoundry/solfoundry/pull/253'
    }
  },
  {
    id: 'act_013',
    type: 'review_completed',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty(),
    review: {
      score: 9
    }
  },
  {
    id: 'act_014',
    type: 'bounty_created',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    bounty: getRandomBounty()
  },
  {
    id: 'act_015',
    type: 'payout_sent',
    timestamp: generateRandomTimestamp(),
    user: getRandomUser(),
    payout: {
      amount: 275000,
      recipient: 'solana_builder'
    }
  }
].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
