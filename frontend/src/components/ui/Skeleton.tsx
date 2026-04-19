import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div 
      className={`bg-forge-800 animate-pulse rounded ${className}`} 
      style={{ backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0) 100%)', backgroundSize: '200% 100%' }}
    />
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-border bg-forge-900 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
