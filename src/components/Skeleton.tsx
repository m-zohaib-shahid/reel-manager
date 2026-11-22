export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-black/[0.06] dark:bg-white/[0.08] ${className}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111111]"
          >
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-4 h-8 w-20" />
            <SkeletonBlock className="mt-3 h-3 w-36" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111111] lg:col-span-2">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="mt-4 h-3 w-full" />
          <SkeletonBlock className="mt-3 h-4 w-32" />
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111111]">
          <SkeletonBlock className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-full" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#111111]">
        <SkeletonBlock className="h-6 w-48" />
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((slot) => (
            <SkeletonBlock key={slot} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
