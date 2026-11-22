import { useState } from "react";
import { Check, Clock, ExternalLink } from "lucide-react";
import { SLOT_META, formatPktTime, isLatePost } from "../lib/time";
import type { DailyPost, SlotNumber, SlotStatus, TeamMember } from "../lib/types";

interface SlotRowProps {
  dateStr: string;
  slot: SlotNumber;
  post: DailyPost | undefined;
  status: SlotStatus;
  membersById: Map<string, TeamMember>;
  currentMemberId: string;
  disabled?: boolean;
  onOpenMarkModal: (dateStr: string, slot: SlotNumber) => void;
  onUndo: (postDate: string, slot: SlotNumber) => Promise<void>;
}

export function SlotRow({
  dateStr,
  slot,
  post,
  status,
  membersById,
  currentMemberId,
  disabled = false,
  onOpenMarkModal,
  onUndo,
}: SlotRowProps) {
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const meta = SLOT_META[slot];
  const isPosted = status === "posted" && Boolean(post?.posted);
  const isFutureOrDisabled = status === "future" || disabled;
  const poster = post?.postedBy ? membersById.get(post.postedBy) : undefined;
  const posterName = poster?.name ?? post?.postedBy ?? "Team member";
  const canUndo = isPosted && post?.postedBy === currentMemberId;
  const late = isPosted && isLatePost(dateStr, slot, post?.postedAt ?? null);

  const handleConfirmUndo = async () => {
    setUndoing(true);
    try {
      await onUndo(dateStr, slot);
      setConfirmingUndo(false);
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div
      className={`px-4 py-3.5 transition-colors duration-150 sm:px-5 ${
        isPosted ? "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {isPosted ? (
            <div
              aria-label={`Slot ${slot} posted`}
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={isFutureOrDisabled}
              onClick={() => onOpenMarkModal(dateStr, slot)}
              aria-label={
                isFutureOrDisabled
                  ? `Slot ${slot}: ${meta.label} (not yet available)`
                  : `Mark Slot ${slot}: ${meta.label} as posted`
              }
              className={`group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] ${
                isFutureOrDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-colors duration-150 ${
                  isFutureOrDisabled
                    ? "border-black/15 bg-neutral-100 dark:border-white/15 dark:bg-white/5"
                    : status === "missed"
                      ? "border-red-500/50 bg-white group-hover:border-red-600 dark:border-red-400/50 dark:bg-[#0a0a0a]"
                      : status === "open"
                        ? "border-[#0071e3] bg-[#0071e3]/10 group-hover:bg-[#0071e3]/20"
                        : "border-black/20 bg-white group-hover:border-[#0071e3] dark:border-white/25 dark:bg-[#0a0a0a]"
                }`}
              />
            </button>
          )}

          <div className="min-w-0 flex-1 pt-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs font-medium text-neutral-500 tabular-nums dark:text-neutral-400">
                Slot {slot}
              </span>
              <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{meta.timeRange}</span>
              </span>
            </div>

            <p className="mt-0.5 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {meta.label}
            </p>

            {isPosted && post && (
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-600 dark:text-neutral-300">
                  <span>
                    Posted by <strong className="font-medium text-neutral-900 dark:text-white">{posterName}</strong>
                    {post.postedAt ? ` at ${formatPktTime(post.postedAt)} PKT` : ""}
                  </span>
                  {late && (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      Late entry
                    </span>
                  )}
                </div>

                {post.captionRef && (
                  <p className="break-words text-neutral-600 dark:text-neutral-400">
                    {post.captionRef}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  {post.reelUrl && (
                    <a
                      href={post.reelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1 font-medium text-[#0071e3] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                    >
                      <span>View Reel</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}

                  {canUndo && !confirmingUndo && (
                    <button
                      type="button"
                      onClick={() => setConfirmingUndo(true)}
                      className="min-h-[36px] rounded-lg px-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      Undo
                    </button>
                  )}

                  {canUndo && confirmingUndo && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={undoing}
                        onClick={() => void handleConfirmUndo()}
                        className="min-h-[36px] rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] disabled:opacity-60"
                      >
                        {undoing ? "Undoing..." : "Confirm undo"}
                      </button>
                      <button
                        type="button"
                        disabled={undoing}
                        onClick={() => setConfirmingUndo(false)}
                        className="min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:text-neutral-300 dark:hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 pt-2">
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SlotStatus }) {
  if (status === "posted") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Posted
      </span>
    );
  }

  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#0071e3]/30 bg-[#0071e3]/10 px-2.5 py-1 text-xs font-medium text-[#0071e3] dark:text-[#3b99fc]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0071e3] animate-pulse dark:bg-[#3b99fc]" aria-hidden="true" />
        <span>Open Now</span>
      </span>
    );
  }

  if (status === "missed") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300">
        Missed
      </span>
    );
  }

  if (status === "upcoming") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-black/10 bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
        Upcoming
      </span>
    );
  }

  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-black/10 bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
      Not yet
    </span>
  );
}
