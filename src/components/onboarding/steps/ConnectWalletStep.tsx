import React, { useState } from 'react';
import { Wallet, ExternalLink, ArrowRight, SkipForward } from 'lucide-react';

interface ConnectWalletStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export const ConnectWalletStep: React.FC<ConnectWalletStepProps> = ({
  onNext,
  onSkip
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const mockConnect = async (walletType: 'phantom' | 'solflare') => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock wallet address generation
      const mockAddress = walletType === 'phantom'
        ? '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgHkx'
        : 'BQWWFhzBdw2vKKBUX17NHeFbCoFQHfRARpdztPE2tDJ';

      setConnectedWallet(mockAddress);
    } catch (error) {
      setConnectionError('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleNext = () => {
    if (connectedWallet) {
      onNext();
    }
  };

  if (connectedWallet) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Wallet className="h-8 w-8 text-green-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Wallet Connected!</h2>
          <p className="text-gray-600">
            Your Solana wallet is now connected to SolFoundry
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-2">Connected Address:</p>
          <p className="font-mono text-sm text-gray-900 break-all">
            {connectedWallet}
          </p>
        </div>

        <button
          onClick={handleNext}
          className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
        >
          Continue to Bounty System
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
        <Wallet className="h-8 w-8 text-orange-600" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Connect your Solana wallet to start earning $FNDRY tokens for your contributions.
          Your wallet will be used to receive bounty payments.
        </p>
      </div>

      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{connectionError}</p>
        </div>
      )}

      <div className="space-y-3 max-w-sm mx-auto">
        <button
          onClick={() => mockConnect('phantom')}
          disabled={isConnecting}
          className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
          </div>
          {isConnecting ? 'Connecting...' : 'Connect with Phantom'}
          <ExternalLink className="h-4 w-4" />
        </button>

        <button
          onClick={() => mockConnect('solflare')}
          disabled={isConnecting}
          className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
          {isConnecting ? 'Connecting...' : 'Connect with Solflare'}
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-3">
          Want to browse bounties first?
        </p>
        <button
          onClick={onSkip}
          className="text-orange-600 hover:text-orange-700 font-medium flex items-center justify-center gap-2 mx-auto"
        >
          <SkipForward className="h-4 w-4" />
          Skip wallet setup for now
        </button>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 text-left">
        <h4 className="font-semibold text-gray-900 mb-2">Why connect a wallet?</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Receive $FNDRY token rewards instantly</li>
          <li>• Track your contribution history</li>
          <li>• Participate in governance voting</li>
          <li>• Access premium bounty opportunities</li>
        </ul>
      </div>
    </div>
  );
};
