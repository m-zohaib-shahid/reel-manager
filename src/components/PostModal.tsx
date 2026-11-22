import { useEffect, useRef, useState, type FormEvent } from "react";
import { SLOT_META, formatPktDateLong } from "../lib/time";
import type { MarkPostedInput, SlotNumber, TeamMember } from "../lib/types";

interface PostModalProps {
  postDate: string;
  slot: SlotNumber;
  currentMember: TeamMember;
  onClose: () => void;
  onConfirm: (input: MarkPostedInput) => Promise<void>;
}

export function PostModal({
  postDate,
  slot,
  currentMember,
  onClose,
  onConfirm,
}: PostModalProps) {
  const [reelUrl, setReelUrl] = useState("");
  const [captionRef, setCaptionRef] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const meta = SLOT_META[slot];

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    urlInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!submitting) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, submitting]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUrl = reelUrl.trim();
    const trimmedCaption = captionRef.trim();

    if (trimmedUrl.length > 0 && !/^https?:\/\//i.test(trimmedUrl)) {
      setUrlError("Reel URL must start with http:// or https://");
      urlInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setUrlError(null);
    try {
      await onConfirm({
        postDate,
        slot,
        memberId: currentMember.id,
        reelUrl: trimmedUrl || null,
        captionRef: trimmedCaption || null,
      });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#111111]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
              {formatPktDateLong(postDate)} · Slot {slot}
            </p>
            <h2
              id="post-modal-title"
              className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white"
            >
              {meta.label}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
              {meta.timeRange}
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <span className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Posting as
            </span>
            <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-black/10 bg-[#fafafa] px-3.5 py-2.5 dark:border-white/10 dark:bg-[#0a0a0a]">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: currentMember.avatarColor }}
                aria-hidden="true"
              >
                {currentMember.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                {currentMember.name}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="reel-url-input"
              className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Instagram Reel URL <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              ref={urlInputRef}
              id="reel-url-input"
              type="url"
              value={reelUrl}
              onChange={(e) => {
                setReelUrl(e.target.value);
                if (urlError) {
                  setUrlError(null);
                }
              }}
              placeholder="https://www.instagram.com/reel/..."
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-black/15 bg-white px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
            />
            {urlError && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                {urlError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="caption-ref-input"
              className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Caption / Clip Reference <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <textarea
              id="caption-ref-input"
              rows={3}
              value={captionRef}
              onChange={(e) => setCaptionRef(e.target.value)}
              placeholder="e.g., Vice City map leak side-by-side"
              className="mt-1.5 w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
            />
          </div>

          <div className="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] disabled:opacity-60 dark:border-white/10 dark:bg-[#111111] dark:text-neutral-200 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-[#0071e3] px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#0062c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-[#111111]"
            >
              {submitting ? "Saving..." : "Mark as Posted"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
