import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "../lib/stats";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  monthLabel: string;
  currentMemberId: string;
}

export function Leaderboard({ entries, monthLabel, currentMemberId }: LeaderboardProps) {
  return (
    <section
      aria-label="Team leaderboard"
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Team Leaderboard
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            All 3 members · Monthly pace &amp; today
          </p>
        </div>
        <span className="shrink-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {monthLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {entries.map((entry) => {
          const isCurrent = entry.member.id === currentMemberId;
          const isLeader = entry.rank === 1 && entry.count > 0;
          const barWidth = entry.percentage > 0 ? Math.max(4, entry.percentage) : 0;

          return (
            <div
              key={entry.member.id}
              className={`min-w-0 rounded-xl border p-3 transition-colors ${
                isCurrent
                  ? "border-[#0071e3]/30 bg-[#0071e3]/[0.04] dark:border-[#0071e3]/40 dark:bg-[#0071e3]/[0.08]"
                  : "border-black/5 bg-[#fafafa] dark:border-white/5 dark:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold tabular-nums ${
                      isLeader
                        ? "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400"
                        : "bg-neutral-200/70 text-neutral-600 dark:bg-white/10 dark:text-neutral-400"
                    }`}
                    aria-label={`Rank ${entry.rank}`}
                  >
                    {isLeader ? <Trophy className="h-3 w-3" aria-hidden="true" /> : `#${entry.rank}`}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.member.avatarColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {entry.member.name}
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 text-[10px] font-medium text-[#0071e3] dark:text-[#4da3ff]">
                      (You)
                    </span>
                  )}
                </div>

                <span className="shrink-0 font-mono text-neutral-700 tabular-nums dark:text-neutral-200">
                  {entry.count}/{entry.expected}{" "}
                  <span className="text-neutral-400 dark:text-neutral-500">
                    ({entry.percentage}%)
                  </span>
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={entry.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${entry.member.name} monthly progress ${entry.percentage}%`}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/10"
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: entry.member.avatarColor,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {[1, 2, 3].map((slot) => (
                      <span
                        key={slot}
                        className={`h-1.5 w-1.5 rounded-full ${
                          slot <= entry.todayCompleted
                            ? "bg-emerald-500"
                            : "bg-neutral-300 dark:bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono tabular-nums">{entry.todayCompleted}/3 today</span>
                </div>
                <span className="font-mono tabular-nums">
                  {entry.streak}d streak
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
