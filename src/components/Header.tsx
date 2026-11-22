import { LogOut } from "lucide-react";
import type { TeamMember } from "../lib/types";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  currentMember: TeamMember;
  onSwitchMember: () => void;
}

export function Header({ currentMember, onSwitchMember }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-black/75">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-base font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-lg">
            Reel Tracker
          </span>
          <span
            aria-hidden="true"
            className="hidden text-neutral-300 dark:text-neutral-700 sm:inline"
          >
            ·
          </span>
          <span className="hidden truncate text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:inline">
            GTA 6 Content Team
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.08] bg-[#fafafa] px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-[#111111]">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: currentMember.avatarColor }}
              aria-hidden="true"
            >
              {currentMember.name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[110px] truncate text-xs font-medium text-neutral-800 dark:text-neutral-200 sm:inline">
              {currentMember.name}
            </span>
          </div>

          <button
            type="button"
            onClick={onSwitchMember}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 dark:border-white/[0.08] dark:bg-[#111111] dark:text-neutral-200 dark:hover:bg-white/10 dark:focus-visible:ring-offset-black"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Switch member</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
