function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-200 ${className}`} />;
}

export function ContributorProfileSkeleton() {
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto" role="status" aria-label="Loading contributor profile">
      {/* Back link */}
      <Bone className="h-4 w-36 mb-6" />

      {/* Header card */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Bone className="h-20 w-20 rounded-full! shrink-0" />
          <div className="flex-1 w-full space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Bone className="h-8 w-48 mx-auto sm:mx-0" />
              <Bone className="h-6 w-16 rounded-full! mx-auto sm:mx-0" />
            </div>
            <Bone className="h-4 w-40 mx-auto sm:mx-0" />
            <Bone className="h-8 w-44 mx-auto sm:mx-0" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-surface-300 bg-surface-50 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Bone className="h-10 w-10 shrink-0" />
              <div className="space-y-2 flex-1">
                <Bone className="h-3 w-16" />
                <Bone className="h-5 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tier progress */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-6 mb-6">
        <Bone className="h-4 w-32 mb-4" />
        <Bone className="h-3 w-full mb-3" />
        <div className="flex items-center justify-between">
          {Array.from({ length: 3 }, (_, i) => (
            <Bone key={i} className="h-8 w-8 rounded-full!" />
          ))}
        </div>
        <Bone className="h-1.5 w-full mt-2" />
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-6">
        <Bone className="h-4 w-32 mb-5" />
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <Bone className="h-4 w-4 rounded-full! shrink-0 mt-1" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Bone className="h-3 w-12 rounded-full!" />
                  <Bone className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}