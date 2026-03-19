import React, from 'react';
import Link from 'next/link';
import { ConnectButton } from '@solana/wallet-adapter-react-ui';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 z-50">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold text-white">
            SolFoundry
          </Link>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
};
