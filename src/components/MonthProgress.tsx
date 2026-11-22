import type { MonthlyProgressStats } from "../lib/stats";

interface MonthProgressProps {
  monthLabel: string;
  stats: MonthlyProgressStats;
}

export function MonthProgress({ monthLabel, stats }: MonthProgressProps) {
  return (
    <section
      aria-label="Monthly progress"
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Monthly Pace
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {monthLabel} · Posted vs. elapsed slots
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="font-mono text-xl font-semibold text-neutral-900 tabular-nums dark:text-white">
            {stats.percentage}%
          </span>
          <span className="font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
            {stats.posted} of {stats.expected} slots
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={stats.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Monthly progress: ${stats.posted} of ${stats.expected} slots (${stats.percentage}%)`}
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10"
      >
        <div
          className="h-full rounded-full bg-[#0071e3] transition-all duration-200"
          style={{ width: `${stats.percentage}%` }}
        />
      </div>
    </section>
  );
}
