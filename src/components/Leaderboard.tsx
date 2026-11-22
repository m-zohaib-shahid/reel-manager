import type { LeaderboardEntry } from "../lib/stats";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  monthLabel: string;
}

export function Leaderboard({ entries, monthLabel }: LeaderboardProps) {
  const maxCount = Math.max(1, ...entries.map((e) => e.count));

  return (
    <section
      aria-label="Team leaderboard"
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Team Leaderboard
        </h2>
        <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {monthLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        {entries.map((entry, index) => {
          const barWidth = entry.count > 0 ? Math.max(6, Math.round((entry.count / maxCount) * 100)) : 0;

          return (
            <div key={entry.member.id} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-neutral-400 tabular-nums dark:text-neutral-500">
                    {index + 1}.
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.member.avatarColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {entry.member.name}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-neutral-600 tabular-nums dark:text-neutral-300">
                  {entry.count} <span className="text-neutral-400 dark:text-neutral-500">({entry.percentage}%)</span>
                </span>
              </div>

              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: entry.member.avatarColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
