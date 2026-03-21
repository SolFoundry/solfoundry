import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { CreatorDashboard } from '../components/CreatorDashboard';

export default function CreatorDashboardPage() {
    const navigate = useNavigate();
    const { publicKey } = useWallet();
    const walletAddress = publicKey?.toBase58() ?? undefined;

    return (
        <CreatorDashboard
            userId={walletAddress ?? 'anonymous'}
            walletAddress={walletAddress}
            onNavigateBounties={() => navigate('/bounties')}
        />
    );
}
