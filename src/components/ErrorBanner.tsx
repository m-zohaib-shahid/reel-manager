import { AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <p className="break-words">{message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] rounded-xl border border-red-500/30 bg-white px-3.5 py-2 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/50"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:text-red-200 dark:hover:bg-red-900/50"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
