interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = "", count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded bg-gray-700 ${className}`}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-forge-900 border border-forge-800 p-6 space-y-4">
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-forge-800">
      <Skeleton className="h-4 w-8" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-4">
        <Skeleton className="h-24 w-64 rounded-xl" />
        <Skeleton className="h-24 w-64 rounded-xl" />
        <Skeleton className="h-24 w-64 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-96" />
      <div className="grid grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
