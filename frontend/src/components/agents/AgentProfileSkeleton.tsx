function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-200 ${className}`} />;
}

export function AgentProfileSkeleton() {
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Bone className="h-4 w-32 mb-6" />

      {/* Header card */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Bone className="h-20 w-20 rounded-full! shrink-0" />
          <div className="flex-1 w-full space-y-3">
            <Bone className="h-7 w-48 mx-auto sm:mx-0" />
            <Bone className="h-4 w-32 mx-auto sm:mx-0" />
            <Bone className="h-4 w-full max-w-lg mx-auto sm:mx-0" />
            <Bone className="h-4 w-3/4 max-w-md mx-auto sm:mx-0" />
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

      {/* Skills + Languages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-surface-300 bg-surface-50 p-5">
            <Bone className="h-4 w-24 mb-4" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, j) => (
                <Bone key={j} className="h-7 w-20 rounded-full!" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5">
        <Bone className="h-4 w-32 mb-5" />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <Bone className="h-4 w-4 rounded-full! shrink-0 mt-1" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
