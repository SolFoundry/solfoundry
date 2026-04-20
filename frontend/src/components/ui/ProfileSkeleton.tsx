import React from 'react';
import { Skeleton } from './Skeleton';

export function ProfileHeaderSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
      <div className="flex items-start gap-5">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" height={24} />
          <Skeleton variant="text" width="50%" height={14} />
        </div>
      </div>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
        {[80, 90, 70, 60].map((w, i) => (
          <Skeleton key={i} variant="rectangular" width={w} height={28} className="rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-forge-900 p-4">
          <div className="flex items-start gap-3">
            <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton variant="text" width={60} height={10} />
              <Skeleton variant="text" width={80} height={20} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4">
      <Skeleton variant="text" width={140} height={14} className="mb-4" />
      <Skeleton variant="rectangular" width="100%" height={180} className="rounded" />
    </div>
  );
}
