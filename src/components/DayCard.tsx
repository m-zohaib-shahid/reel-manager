import { SLOT_NUMBERS, formatPktDateLong, getSlotStatus } from "../lib/time";
import { postKey } from "../lib/stats";
import type { DailyPost, SlotNumber, TeamMember } from "../lib/types";
import { SlotRow } from "./SlotRow";

interface DayCardProps {
  dateStr: string;
  todayStr: string;
  now: Date;
  postMap: Map<string, DailyPost>;
  membersById: Map<string, TeamMember>;
  currentMemberId: string;
  disabled?: boolean;
  onOpenMarkModal: (dateStr: string, slot: SlotNumber) => void;
  onUndo: (postDate: string, slot: SlotNumber) => Promise<void>;
}

export function DayCard({
  dateStr,
  todayStr,
  now,
  postMap,
  membersById,
  currentMemberId,
  disabled = false,
  onOpenMarkModal,
  onUndo,
}: DayCardProps) {
  const isToday = dateStr === todayStr;

  let postedCount = 0;
  for (const slot of SLOT_NUMBERS) {
    if (postMap.get(postKey(dateStr, slot))?.posted) {
      postedCount += 1;
    }
  }

  const allComplete = postedCount === 3;

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xs dark:border-white/10 dark:bg-[#111111]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-3.5 dark:border-white/10 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {formatPktDateLong(dateStr)}
          </h3>
          {isToday && (
            <span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-xs font-medium text-[#0071e3] dark:text-[#3b99fc]">
              Today
            </span>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums ${
            allComplete
              ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border border-black/10 bg-neutral-100 text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300"
          }`}
        >
          {postedCount}/3 posted
        </span>
      </header>

      <div className="divide-y divide-black/10 dark:divide-white/10">
        {SLOT_NUMBERS.map((slot) => {
          const post = postMap.get(postKey(dateStr, slot));
          const status = getSlotStatus(dateStr, slot, Boolean(post?.posted), now);
          return (
            <SlotRow
              key={slot}
              dateStr={dateStr}
              slot={slot}
              post={post}
              status={status}
              membersById={membersById}
              currentMemberId={currentMemberId}
              disabled={disabled}
              onOpenMarkModal={onOpenMarkModal}
              onUndo={onUndo}
            />
          );
        })}
      </div>
    </article>
  );
}
