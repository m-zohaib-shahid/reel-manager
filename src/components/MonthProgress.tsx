import { postKey, type MonthlyProgressStats } from "../lib/stats";
import { SLOT_NUMBERS, formatPktDateLong, slotWindow } from "../lib/time";
import type { DailyPost } from "../lib/types";

interface MonthProgressProps {
  monthLabel: string;
  stats: MonthlyProgressStats;
  days: string[];
  todayStr: string;
  postMap: Map<string, DailyPost>;
  now: Date;
}

export function MonthProgress({
  monthLabel,
  stats,
  days,
  todayStr,
  postMap,
  now,
}: MonthProgressProps) {
  const nowMs = now.getTime();
  let fullDaysCount = 0;
  let elapsedDaysCount = 0;

  const dayCells = days.map((dateStr) => {
    const dayNumber = Number(dateStr.slice(-2));
    let postedCount = 0;
    for (const slot of SLOT_NUMBERS) {
      if (postMap.get(postKey(dateStr, slot))?.posted) {
        postedCount += 1;
      }
    }

    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;
    const lastSlotEnd = slotWindow(dateStr, 3).end.getTime();
    const hasElapsedSlots = !isFuture && (dateStr < todayStr || nowMs > slotWindow(dateStr, 1).end.getTime());

    if (!isFuture) {
      elapsedDaysCount += 1;
    }
    if (postedCount === 3) {
      fullDaysCount += 1;
    }

    let state: "complete" | "partial" | "missed" | "today" | "future" = "future";
    if (postedCount === 3) {
      state = "complete";
    } else if (postedCount > 0) {
      state = "partial";
    } else if (isFuture) {
      state = "future";
    } else if (isToday && nowMs <= lastSlotEnd) {
      state = "today";
    } else if (hasElapsedSlots || dateStr < todayStr) {
      state = "missed";
    } else {
      state = "today";
    }

    return {
      dateStr,
      dayNumber,
      postedCount,
      isToday,
      state,
    };
  });

  return (
    <section
      aria-label="Monthly progress"
      className="flex h-full flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111111]"
    >
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Monthly Pace
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {monthLabel} · Your posted vs. elapsed slots
            </p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2">
            <span className="font-mono text-xl font-semibold text-neutral-900 tabular-nums dark:text-white">
              {stats.percentage}%
            </span>
            <span className="font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
              {stats.posted}/{stats.expected} slots
            </span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={stats.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Monthly progress: ${stats.posted} of ${stats.expected} slots (${stats.percentage}%)`}
          className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08]"
        >
          <div
            className="h-full rounded-full bg-[#0071e3] transition-all duration-200"
            style={{ width: `${stats.percentage > 0 ? Math.max(3, stats.percentage) : 0}%` }}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            Daily Consistency
          </h3>
          <span className="font-mono text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">
            {fullDaysCount}/{elapsedDaysCount} full 3/3 days
          </span>
        </div>

        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {dayCells.map((cell) => {
            const stateClasses =
              cell.state === "complete"
                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                : cell.state === "partial"
                  ? "border-[#0071e3]/30 bg-[#0071e3]/10 text-[#0071e3] dark:border-[#0071e3]/35 dark:bg-[#0071e3]/15 dark:text-[#4da3ff]"
                  : cell.state === "missed"
                    ? "border-red-500/20 bg-red-500/[0.05] text-red-600/80 dark:border-red-400/20 dark:bg-red-500/[0.07] dark:text-red-400/80"
                    : cell.state === "today"
                      ? "border-[#0071e3]/50 bg-white text-neutral-900 dark:border-[#0071e3]/60 dark:bg-[#161616] dark:text-white"
                      : "border-black/[0.05] bg-neutral-50/80 text-neutral-400 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-neutral-600";

            return (
              <div
                key={cell.dateStr}
                title={`${formatPktDateLong(cell.dateStr)} · ${cell.postedCount}/3 posted`}
                className={`flex h-9 flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${stateClasses} ${
                  cell.isToday ? "ring-1.5 ring-[#0071e3]/70" : ""
                }`}
              >
                <span className="font-mono text-[11px] font-medium leading-none tabular-nums">
                  {cell.dayNumber}
                </span>
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {[1, 2, 3].map((slot) => (
                    <span
                      key={slot}
                      className={`h-1 w-1 rounded-full ${
                        slot <= cell.postedCount
                          ? cell.state === "complete"
                            ? "bg-emerald-500"
                            : "bg-[#0071e3]"
                          : cell.state === "missed"
                            ? "bg-red-400/40 dark:bg-red-400/30"
                            : "bg-neutral-300/80 dark:bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-emerald-500/70" aria-hidden="true" />
          <span>3/3 Complete</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-[#0071e3]/70" aria-hidden="true" />
          <span>Partial</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-red-500/50" aria-hidden="true" />
          <span>Missed</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-neutral-300 dark:bg-white/20" aria-hidden="true" />
          <span>Upcoming</span>
        </span>
      </div>
    </section>
  );
}
