import React from 'react';

export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
      {/* Shimmer overlay via inner elements */}

      {/* Back link */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-4 h-4 rounded bg-forge-800" />
        <div className="h-3 w-24 rounded bg-forge-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + meta card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            {/* Org line */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full bg-forge-800" />
              <div className="h-3 w-40 rounded bg-forge-800 font-mono" />
            </div>

            {/* Title */}
            <div className="h-7 w-3/4 rounded bg-forge-800 mb-4" />

            {/* Skills */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-forge-800" />
                <div className="h-3 w-16 rounded bg-forge-800" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-forge-800" />
                <div className="h-3 w-12 rounded bg-forge-800" />
              </div>
            </div>

            {/* Description lines */}
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-forge-800" />
              <div className="h-3.5 w-5/6 rounded bg-forge-800" />
              <div className="h-3.5 w-4/6 rounded bg-forge-800" />
              <div className="h-3.5 w-full rounded bg-forge-800" />
              <div className="h-3.5 w-3/4 rounded bg-forge-800" />
            </div>

            {/* Issue link */}
            <div className="flex items-center gap-1.5 mt-4">
              <div className="w-4 h-4 rounded bg-forge-800" />
              <div className="h-3 w-36 rounded bg-forge-800" />
            </div>
          </div>

          {/* Submissions card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <div className="h-5 w-28 rounded bg-forge-800 mb-4" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-forge-800/40 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-forge-800" />
                    <div className="h-4 w-24 rounded bg-forge-800" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded bg-forge-800" />
                    <div className="h-3 w-2/3 rounded bg-forge-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Reward card */}
          <div className="rounded-xl border border-border bg-forge-900 p-5">
            <div className="h-3 w-14 rounded bg-forge-800 mb-2" />
            <div className="h-8 w-32 rounded bg-forge-800 mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-forge-800" />
              <div className="h-3 w-3/4 rounded bg-forge-800" />
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-xl border border-border bg-forge-900 p-5">
            <div className="h-4 w-20 rounded bg-forge-800 mb-4" />
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-16 rounded bg-forge-800" />
                <div className="h-3 w-20 rounded bg-forge-800" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-12 rounded bg-forge-800" />
                <div className="h-3 w-16 rounded bg-forge-800" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-14 rounded bg-forge-800" />
                <div className="h-3 w-10 rounded bg-forge-800" />
              </div>
            </div>
          </div>

          {/* Submit button placeholder */}
          <div className="h-10 w-full rounded-lg bg-forge-800" />
        </div>
      </div>
    </div>
  );
}
