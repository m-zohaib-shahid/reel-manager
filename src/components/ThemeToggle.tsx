import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 dark:border-white/10 dark:bg-[#111111] dark:text-neutral-200 dark:hover:bg-white/10 dark:focus-visible:ring-offset-black"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
