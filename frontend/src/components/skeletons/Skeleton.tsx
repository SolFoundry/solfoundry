import React from 'react';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Base Skeleton component with shimmer animation.
 * Respects reduced motion preferences for accessibility.
 */
export function Skeleton({ className = '', children, style }: SkeletonProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-md bg-forge-800
        before:absolute before:inset-0
        before:bg-gradient-to-r before:from-transparent before:via-forge-700 before:to-transparent
        before:animate-shimmer before:bg-[length:200%_100%]
        motion-reduce:before:animate-none
        ${className}
      `}
      style={style}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * Skeleton specifically for text lines with variable widths
 */
export function TextSkeleton({ 
  lines = 1, 
  widths = ['100%'], 
  className = '' 
}: { 
  lines?: number; 
  widths?: string[];
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-4" 
          style={{ width: widths[i % widths.length] }} 
        />
      ))}
    </div>
  );
}

/**
 * Circular skeleton for avatars
 */
export function CircleSkeleton({ size = '2.5rem', className = '' }: { size?: string; className?: string }) {
  return (
    <Skeleton 
      className={`rounded-full ${className}`} 
      style={{ width: size, height: size }} 
    />
  );
}
