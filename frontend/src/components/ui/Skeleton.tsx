import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseClasses = 'bg-forge-800';
  const variantClasses = {
    text: 'rounded h-4',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'text' ? '1rem' : undefined),
  };

  if (!animate) {
    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={style}
      />
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{
        ...style,
        background: 'linear-gradient(90deg, #16161F 25%, #1E1E2A 50%, #16161F 75%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Pre-built skeleton layouts
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton width={120} />
        </div>
        <Skeleton width={32} height={20} />
      </div>
      <div className="space-y-2">
        <Skeleton height={20} width="80%" />
        <Skeleton height={16} width="60%" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton width={40} />
        <Skeleton width={50} />
        <Skeleton width={45} />
      </div>
      <div className="border-t border-border/50 pt-3" />
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={24} />
        <div className="flex items-center gap-2">
          <Skeleton width={40} />
          <Skeleton width={40} />
        </div>
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-forge-900">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton width={120} />
          <div className="flex-1" />
          <Skeleton width={60} />
          <Skeleton width={80} />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="space-y-2">
          <Skeleton width={160} height={24} />
          <Skeleton width={100} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-forge-900 rounded-lg p-4 text-center space-y-2">
            <Skeleton width={40} height={32} className="mx-auto" />
            <Skeleton width={60} className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
