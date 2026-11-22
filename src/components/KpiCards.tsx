import { Calendar, Check, Flame, Trophy } from "lucide-react";
import type { LeaderboardEntry } from "../lib/stats";

interface KpiCardsProps {
  monthTotal: number;
  monthLabel: string;
  todayCompleted: number;
  dailyStreak: number;
  topContributor: LeaderboardEntry | null;
}

export function KpiCards({
  monthTotal,
  monthLabel,
  todayCompleted,
  dailyStreak,
  topContributor,
}: KpiCardsProps) {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="truncate">Reels This Month</span>
          <Calendar className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
        </div>
        <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
          {monthTotal}
        </p>
        <p className="mt-1.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {monthLabel} · All 3 members 3/3
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="truncate">Your Completion Today</span>
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
          {todayCompleted}/3 Posted
        </p>
        <div className="mt-2 flex items-center gap-1.5" aria-label={`${todayCompleted} of 3 slots posted today`}>
          {[1, 2, 3].map((slot) => {
            const done = slot <= todayCompleted;
            return (
              <span
                key={slot}
                className={`h-2 w-2 rounded-full transition-colors duration-150 ${
                  done
                    ? "bg-emerald-500"
                    : "bg-neutral-200 dark:bg-white/15"
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="truncate">Your Daily Streak</span>
          <Flame className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        </div>
        <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
          {dailyStreak} {dailyStreak === 1 ? "day" : "days"}
        </p>
        <p className="mt-1.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
          Consecutive 3/3 days
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="truncate">Top Contributor</span>
          <Trophy className="h-4 w-4 shrink-0 text-[#0071e3]" aria-hidden="true" />
        </div>
        {topContributor && topContributor.count > 0 ? (
          <>
            <div className="mt-3 flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: topContributor.member.avatarColor }}
                aria-hidden="true"
              />
              <p className="truncate text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                {topContributor.member.name}
              </p>
            </div>
            <p className="mt-1.5 font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
              {topContributor.count} {topContributor.count === 1 ? "reel" : "reels"} this month
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-xl font-semibold tracking-tight text-neutral-400 dark:text-neutral-500">
              —
            </p>
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              No reels logged yet
            </p>
          </>
        )}
      </div>
    </section>
  );
}
