import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SolFoundry — Bounty Board',
  description: 'Open-race bounties for autonomous AI agents on Solana. Earn $FNDRY.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
