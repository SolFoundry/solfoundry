import React, { useState, useRef } from 'react';

interface WalletAddressProps {
  address: string;
}

const WalletAddress: React.FC<WalletAddressProps> = ({ address }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const truncateAddress = (addr: string, startChars: number = 6, endChars: number = 6) => {
    if (addr.length <= startChars + endChars + 3) { // +3 for "..."
      return addr;
    }
    return `${addr.substring(0, startChars)}...${addr.substring(addr.length - endChars)}`;
  };

  const handleCopy = async () => {
    if (navigator.clipboard && address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
          setHovered(false); // Reset hover state for tooltip when copy feedback fades
        }, 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const displayAddress = truncateAddress(address);

  return (
    <div
      className="relative inline-flex items-center group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCopy}
    >
      <span className="font-mono text-sm text-gray-800 dark:text-gray-200 select-none transition-colors duration-200">
        {displayAddress}
      </span>
      <span className="ml-2 flex-shrink-0">
        {copied ? (
          <span className="text-green-500 text-lg transition-all duration-200 transform scale-125">✓</span> // Checkmark icon
        ) : (
          <svg className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-2M8 5v2m0-2h2m4 0h2M9 16H6a2 2 0 01-2-2v-2a2 2 0 012-2h2m0 0H8m0 0h1a2 2 0 012 2v2a2 2 0 01-2 2h-1"></path>
          </svg> // Copy icon (simplified version for common path)
        )}
      </span>

      {(hovered && !copied) && ( // Show full address tooltip only on hover and if not currently showing 'Copied!'
        <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          {address}
        </div>
      )}
      {copied && ( // Show 'Copied!' tooltip when copied
        <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-green-600 text-white text-xs rounded shadow-lg opacity-100 pointer-events-none whitespace-nowrap">
          Copied!
        </div>
      )}
    </div>
  );
};

export default WalletAddress;
