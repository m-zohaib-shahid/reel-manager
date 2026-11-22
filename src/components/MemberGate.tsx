import { useEffect, useRef, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { adapter, isLocalDataSource } from "../lib/data";
import type { TeamMember } from "../lib/types";
import { ThemeToggle } from "./ThemeToggle";
import { ErrorBanner } from "./ErrorBanner";
import { SkeletonBlock } from "./Skeleton";

interface MemberGateProps {
  onAuthenticated: (member: TeamMember) => void;
}

export function MemberGate({ onAuthenticated }: MemberGateProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const pinInputRef = useRef<HTMLInputElement | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await adapter.getMembers();
      setMembers(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
  }, []);

  useEffect(() => {
    if (selected && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [selected]);

  const handleSelectMember = (member: TeamMember) => {
    setSelected(member);
    setPin("");
    setPinError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) {
      return;
    }

    const cleaned = pin.trim();
    if (cleaned.length !== 4) {
      setPinError("Enter your 4-digit PIN.");
      return;
    }

    setVerifying(true);
    setPinError(null);

    try {
      const ok = await adapter.verifyPin(selected.id, cleaned);
      if (!ok) {
        setPinError("Incorrect PIN. Please try again.");
        setVerifying(false);
        return;
      }
      onAuthenticated(selected);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Verification failed.");
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] text-neutral-900 dark:bg-black dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end px-4 pt-5 sm:px-6">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111111] sm:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <Users className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />
              <span>GTA 6 Content Team</span>
              <span aria-hidden="true">·</span>
              <span>PKT (UTC+5)</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Reel Tracker
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {selected
                ? `Enter the 4-digit PIN for ${selected.name}.`
                : "Select your profile to access the daily schedule."}
            </p>
          </div>

          {loadError && (
            <div className="mb-4">
              <ErrorBanner message={loadError} onRetry={() => void fetchMembers()} />
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : !selected ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectMember(member)}
                  className="group flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-[#fafafa] p-4 text-center transition-all duration-150 hover:border-[#0071e3]/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:border-white/10 dark:bg-[#0a0a0a] dark:hover:border-[#0071e3]/60 dark:hover:bg-[#161616]"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white transition-transform duration-150 group-hover:scale-105"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-full truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {member.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3 dark:border-white/10 dark:bg-[#0a0a0a]">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: selected.avatarColor }}
                  >
                    {selected.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                    {selected.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setPin("");
                    setPinError(null);
                  }}
                  className="min-h-[44px] shrink-0 rounded-lg px-2.5 text-xs font-medium text-[#0071e3] transition-colors hover:bg-[#0071e3]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                >
                  Change
                </button>
              </div>

              <div>
                <label
                  htmlFor="member-pin-input"
                  className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
                >
                  4-Digit PIN
                </label>
                <input
                  ref={pinInputRef}
                  id="member-pin-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(digitsOnly);
                    if (pinError) {
                      setPinError(null);
                    }
                  }}
                  placeholder="••••"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 font-mono text-lg tracking-[0.35em] text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
                />
                {pinError && (
                  <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {pinError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="min-h-[44px] w-full rounded-xl bg-[#0071e3] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#0062c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-[#111111]"
              >
                {verifying ? "Verifying..." : "Continue"}
              </button>
            </form>
          )}
        </div>

        {isLocalDataSource && (
          <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-500">
            Local PINs: Zohaib (1111) · Huzaifa (2222) · Hashir (3333)
          </p>
        )}
      </main>
    </div>
  );
}
