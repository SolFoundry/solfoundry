import React from 'react';

interface BountyTagProps {
  label: string;
  className?: string;
  onClick?: (label: string) => void;
}

/**
 * Enhanced BountyTag component with dynamic color mapping and Glassmorphism.
 * T1-012 Implementation by [ShanaBoo].
 */
export const BountyTag: React.FC<BountyTagProps> = ({ label, className = '', onClick }) => {
  // Pure function to generate a stable color palette based on the label string
  const getTagStyle = (text: string) => {
    const lower = text.toLowerCase();
    
    // Explicit mappings for common SolFoundry tags
    if (lower.includes('solana')) return 'bg-solana-purple/20 text-solana-purple border-solana-purple/30';
    if (lower.includes('tier-1')) return 'bg-accent-green/20 text-accent-green border-accent-green/30';
    if (lower.includes('tier-2')) return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';
    if (lower.includes('tier-3')) return 'bg-accent-gold/20 text-accent-gold border-accent-gold/30';
    if (lower.includes('backend') || lower.includes('api')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (lower.includes('frontend') || lower.includes('ui')) return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    if (lower.includes('security') || lower.includes('audit')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    
    // Fallback: Stable hashed color
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `bg-hsl(${hue}, 70%, 50%, 0.1) text-hsl(${hue}, 70%, 70%) border-hsl(${hue}, 70%, 50%, 0.3)`;
  };

  const styleClasses = getTagStyle(label);

  return (
    <span
      onClick={() => onClick?.(label)}
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium 
        border backdrop-blur-sm transition-all duration-200
        ${styleClasses}
        ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
        ${className}
      `}
      style={styleClasses.includes('hsl') ? {
        backgroundColor: `hsla(${parseInt(styleClasses.match(/\d+/)?.[0] || '0')}, 70%, 50%, 0.1)`,
        color: `hsla(${parseInt(styleClasses.match(/\d+/)?.[0] || '0')}, 70%, 70%, 1)`,
        borderColor: `hsla(${parseInt(styleClasses.match(/\d+/)?.[0] || '0')}, 70%, 50%, 0.3)`
      } : {}}
    >
      {label}
    </span>
  );
};
