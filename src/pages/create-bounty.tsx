import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Layout from '../components/Layout';
import CreateBountyWizard from '../components/CreateBountyWizard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CreateBounty() {
  const { user, error, isLoading } = useUser();
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login?returnTo=/create-bounty');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && connected && publicKey) {
      setShowWizard(true);
    } else {
      setShowWizard(false);
    }
  }, [user, connected, publicKey]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Authentication Error</h1>
            <p className="text-red-600 mb-4">There was an error loading your profile. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-blue-800 mb-2">GitHub Authentication Required</h1>
            <p className="text-blue-600 mb-4">Please sign in with GitHub to create a bounty.</p>
            <a
              href="/api/auth/login?returnTo=/create-bounty"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              Sign in with GitHub
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  if (!connected || !publicKey) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-yellow-800 mb-2">Wallet Connection Required</h1>
            <p className="text-yellow-600 mb-4">Please connect your Solana wallet to create a bounty.</p>
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Bounty</h1>
          <p className="text-gray-600">
            Set up a bounty for your GitHub issue and incentivize developers to contribute.
          </p>
        </div>

        {showWizard && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <CreateBountyWizard 
              user={user}
              walletAddress={publicKey.toString()}
              onComplete={() => router.push('/dashboard')}
              onCancel={() => router.push('/dashboard')}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}