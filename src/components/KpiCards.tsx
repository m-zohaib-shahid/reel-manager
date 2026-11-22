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
      <div className="flex h-full flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span>Reels This Month</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
            {monthTotal}
          </p>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {monthLabel} · 3/3 team days
          </p>
        </div>
      </div>

      <div className="flex h-full flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span>Completion Today</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
            {todayCompleted}/3 Posted
          </p>
          <div
            className="mt-2.5 flex items-center gap-1.5"
            aria-label={`${todayCompleted} of 3 slots posted today`}
          >
            {[1, 2, 3].map((slot) => {
              const done = slot <= todayCompleted;
              return (
                <span
                  key={slot}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-150 ${
                    done ? "bg-emerald-500" : "bg-neutral-200 dark:bg-white/10"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span>Your Daily Streak</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
            {dailyStreak} {dailyStreak === 1 ? "day" : "days"}
          </p>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            Consecutive 3/3 days
          </p>
        </div>
      </div>

      <div className="flex h-full flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111111]">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span>Top Contributor</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0071e3]/10 text-[#0071e3] dark:text-[#4da3ff]">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3">
          {topContributor && topContributor.count > 0 ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
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
                {topContributor.count} {topContributor.count === 1 ? "reel" : "reels"} ·{" "}
                {topContributor.percentage}% pace
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold tracking-tight text-neutral-400 dark:text-neutral-500">
                —
              </p>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                No reels logged yet
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
