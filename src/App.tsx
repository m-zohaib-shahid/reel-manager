import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayCard } from "./components/DayCard";
import { ErrorBanner } from "./components/ErrorBanner";
import { Header } from "./components/Header";
import { KpiCards } from "./components/KpiCards";
import { Leaderboard } from "./components/Leaderboard";
import { MemberGate } from "./components/MemberGate";
import { MonthProgress } from "./components/MonthProgress";
import { PostModal } from "./components/PostModal";
import { DashboardSkeleton } from "./components/Skeleton";
import { adapter, ensureFreshStorage } from "./lib/data";
import {
  buildMemberPostMap,
  calculateDailyStreak,
  computeLeaderboard,
  computeMonthlyProgress,
  countMonthTeamCompletedDays,
  countTodayCompleted,
} from "./lib/stats";
import {
  addDays,
  addMonths,
  formatMonthTitle,
  getPktDateString,
  getPktMonthString,
  monthRange,
} from "./lib/time";
import type { DailyPost, MarkPostedInput, SlotNumber, TeamMember } from "./lib/types";
import { useNow } from "./lib/useNow";
import { usePosts } from "./lib/usePosts";

const SESSION_STORAGE_KEY = "reel-tracker-session";

type ActiveTab = "today" | "upcoming" | "history";

interface ModalTarget {
  postDate: string;
  slot: SlotNumber;
}

export default function App() {
  const now = useNow(30000);

  const [sessionReady, setSessionReady] = useState(false);
  const [currentMember, setCurrentMember] = useState<TeamMember | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    try {
      ensureFreshStorage();
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TeamMember>;
        if (parsed.id && parsed.name && parsed.avatarColor) {
          setCurrentMember({
            id: parsed.id,
            name: parsed.name,
            avatarColor: parsed.avatarColor,
          });
        }
      }
    } catch {
      // Ignore invalid or inaccessible session storage
    } finally {
      setSessionReady(true);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const list = await adapter.getMembers();
      setMembers(list);
      setMembersError(null);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to load team members.");
    }
  }, []);

  useEffect(() => {
    if (!currentMember) {
      return;
    }
    void loadMembers();
  }, [currentMember, loadMembers]);

  useEffect(() => {
    if (!currentMember || members.length === 0) {
      return;
    }
    const fresh = members.find((m) => m.id === currentMember.id);
    if (
      fresh &&
      (fresh.name !== currentMember.name || fresh.avatarColor !== currentMember.avatarColor)
    ) {
      setCurrentMember(fresh);
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(fresh));
      } catch {
        // Ignore storage write failures
      }
    }
  }, [currentMember, members]);

  const handleAuthenticated = useCallback((member: TeamMember) => {
    setCurrentMember(member);
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(member));
    } catch {
      // Ignore storage write failures
    }
  }, []);

  const handleSwitchMember = useCallback(() => {
    setCurrentMember(null);
    setModalTarget(null);
    setActionError(null);
    void adapter.signOut?.();
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage remove failures
    }
  }, []);

  const todayStr = useMemo(() => (now ? getPktDateString(now) : null), [now]);
  const currentMonth = useMemo(() => (now ? getPktMonthString(now) : null), [now]);

  useEffect(() => {
    if (currentMonth && !selectedMonth) {
      setSelectedMonth(currentMonth);
    }
  }, [currentMonth, selectedMonth]);

  const effectiveMonth = selectedMonth || currentMonth;
  const streakFromDate = useMemo(() => (todayStr ? addDays(todayStr, -60) : null), [todayStr]);
  const currentMonthRange = useMemo(
    () => (currentMonth ? monthRange(currentMonth) : null),
    [currentMonth]
  );
  const historyMonthRange = useMemo(
    () => (effectiveMonth ? monthRange(effectiveMonth) : null),
    [effectiveMonth]
  );

  // Fetch rolling 60-day window (covers streak, last 7 days missed, today, and current month up to today)
  const {
    posts: recentPosts,
    loading: recentLoading,
    error: recentError,
    refetch: refetchRecent,
    setPosts: setRecentPosts,
  } = usePosts(streakFromDate, todayStr);

  // Fetch selected history month
  const {
    posts: historyPosts,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
    setPosts: setHistoryPosts,
  } = usePosts(historyMonthRange?.fromDate ?? null, historyMonthRange?.toDate ?? null);

  const mergedRecentMap = useMemo(
    () => (currentMember ? buildMemberPostMap(recentPosts, currentMember.id) : new Map<string, DailyPost>()),
    [recentPosts, currentMember]
  );
  const mergedHistoryMap = useMemo(
    () => (currentMember ? buildMemberPostMap(historyPosts, currentMember.id) : new Map<string, DailyPost>()),
    [historyPosts, currentMember]
  );

  const membersById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const m of members) {
      map.set(m.id, m);
    }
    if (currentMember && !map.has(currentMember.id)) {
      map.set(currentMember.id, currentMember);
    }
    return map;
  }, [members, currentMember]);

  const monthLabel = useMemo(
    () => (currentMonth ? formatMonthTitle(currentMonth) : ""),
    [currentMonth]
  );

  const monthTotal = useMemo(
    () => (currentMonth ? countMonthTeamCompletedDays(recentPosts, members, currentMonth) : 0),
    [recentPosts, members, currentMonth]
  );

  const todayCompleted = useMemo(
    () => (todayStr ? countTodayCompleted(mergedRecentMap, todayStr) : 0),
    [mergedRecentMap, todayStr]
  );

  const dailyStreak = useMemo(
    () => (now ? calculateDailyStreak(mergedRecentMap, now, 60) : 0),
    [mergedRecentMap, now]
  );

  const leaderboardEntries = useMemo(
    () => (currentMonth ? computeLeaderboard(members, recentPosts, currentMonth) : []),
    [members, recentPosts, currentMonth]
  );

  const topContributor = useMemo(
    () => (leaderboardEntries.length > 0 ? leaderboardEntries[0] : null),
    [leaderboardEntries]
  );

  const monthlyProgress = useMemo(
    () => (now ? computeMonthlyProgress(mergedRecentMap, now) : { posted: 0, expected: 0, percentage: 0 }),
    [mergedRecentMap, now]
  );

  const upcomingDates = useMemo(
    () => (todayStr ? [1, 2, 3, 4, 5, 6, 7].map((offset) => addDays(todayStr, offset)) : []),
    [todayStr]
  );

  const historyPastDates = useMemo(() => {
    if (!historyMonthRange || !todayStr) {
      return [];
    }
    return historyMonthRange.days.filter((d) => d < todayStr).reverse();
  }, [historyMonthRange, todayStr]);

  const upsertOptimisticPost = (prev: DailyPost[], nextPost: DailyPost): DailyPost[] => {
    const idx = prev.findIndex(
      (p) =>
        p.postDate === nextPost.postDate &&
        p.slot === nextPost.slot &&
        p.postedBy === nextPost.postedBy
    );
    if (idx === -1) {
      return [...prev, nextPost];
    }
    const copy = [...prev];
    copy[idx] = nextPost;
    return copy;
  };

  const removeOptimisticPost = (
    prev: DailyPost[],
    postDate: string,
    slot: SlotNumber,
    memberId: string
  ): DailyPost[] => {
    return prev.filter(
      (p) => !(p.postDate === postDate && p.slot === slot && p.postedBy === memberId)
    );
  };

  const handleConfirmPost = useCallback(
    async (input: MarkPostedInput) => {
      if (!currentMember) {
        return;
      }
      setActionError(null);

      const previousRecent = recentPosts;
      const previousHistory = historyPosts;

      const optimisticPost: DailyPost = {
        id: `${input.postDate}-${input.slot}-${input.memberId}`,
        postDate: input.postDate,
        slot: input.slot,
        posted: true,
        postedBy: input.memberId,
        postedAt: new Date().toISOString(),
        reelUrl: input.reelUrl,
        captionRef: input.captionRef,
      };

      if (streakFromDate && todayStr && input.postDate >= streakFromDate && input.postDate <= todayStr) {
        setRecentPosts((prev) => upsertOptimisticPost(prev, optimisticPost));
      }
      if (
        historyMonthRange &&
        input.postDate >= historyMonthRange.fromDate &&
        input.postDate <= historyMonthRange.toDate
      ) {
        setHistoryPosts((prev) => upsertOptimisticPost(prev, optimisticPost));
      }

      setModalTarget(null);

      try {
        const saved = await adapter.markPosted(input);
        if (streakFromDate && todayStr && saved.postDate >= streakFromDate && saved.postDate <= todayStr) {
          setRecentPosts((prev) => upsertOptimisticPost(prev, saved));
        }
        if (
          historyMonthRange &&
          saved.postDate >= historyMonthRange.fromDate &&
          saved.postDate <= historyMonthRange.toDate
        ) {
          setHistoryPosts((prev) => upsertOptimisticPost(prev, saved));
        }
      } catch (err) {
        setRecentPosts(previousRecent);
        setHistoryPosts(previousHistory);
        setActionError(
          err instanceof Error ? err.message : "Could not save reel post. Changes rolled back."
        );
      }
    },
    [
      currentMember,
      recentPosts,
      historyPosts,
      streakFromDate,
      todayStr,
      historyMonthRange,
      setRecentPosts,
      setHistoryPosts,
    ]
  );

  const handleUndoPost = useCallback(
    async (postDate: string, slot: SlotNumber) => {
      if (!currentMember) {
        return;
      }
      setActionError(null);

      const previousRecent = recentPosts;
      const previousHistory = historyPosts;

      if (streakFromDate && todayStr && postDate >= streakFromDate && postDate <= todayStr) {
        setRecentPosts((prev) => removeOptimisticPost(prev, postDate, slot, currentMember.id));
      }
      if (
        historyMonthRange &&
        postDate >= historyMonthRange.fromDate &&
        postDate <= historyMonthRange.toDate
      ) {
        setHistoryPosts((prev) => removeOptimisticPost(prev, postDate, slot, currentMember.id));
      }

      try {
        await adapter.undoPost(postDate, slot, currentMember.id);
      } catch (err) {
        setRecentPosts(previousRecent);
        setHistoryPosts(previousHistory);
        setActionError(
          err instanceof Error ? err.message : "Could not undo post. Changes rolled back."
        );
      }
    },
    [
      currentMember,
      recentPosts,
      historyPosts,
      streakFromDate,
      todayStr,
      historyMonthRange,
      setRecentPosts,
      setHistoryPosts,
    ]
  );

  if (!sessionReady || !now || !todayStr || !currentMonth || !effectiveMonth || !currentMonthRange) {
    return (
      <div className="min-h-screen bg-[#fafafa] text-neutral-900 dark:bg-black dark:text-neutral-100">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!currentMember) {
    return <MemberGate onAuthenticated={handleAuthenticated} />;
  }

  const combinedError =
    actionError ||
    membersError ||
    recentError ||
    (activeTab === "history" ? historyError : null);
  const isInitialLoading = recentLoading && recentPosts.length === 0;
  const canGoNextMonth = effectiveMonth < currentMonth;

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 dark:bg-black dark:text-neutral-100">
      <Header currentMember={currentMember} onSwitchMember={handleSwitchMember} />

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Daily Reel Schedule
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              GTA 6 Content Team · 3 daily slots · PKT (Asia/Karachi)
            </p>
          </div>
          <span className="font-mono text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
            {currentMonthRange.fromDate} – {currentMonthRange.toDate}
          </span>
        </div>

        {combinedError && (
          <ErrorBanner
            message={combinedError}
            onRetry={() => {
              setActionError(null);
              void loadMembers();
              void refetchRecent();
              if (activeTab === "history") {
                void refetchHistory();
              }
            }}
            onDismiss={actionError ? () => setActionError(null) : undefined}
          />
        )}

        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <KpiCards
              monthTotal={monthTotal}
              monthLabel={monthLabel}
              todayCompleted={todayCompleted}
              dailyStreak={dailyStreak}
              topContributor={topContributor}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <MonthProgress monthLabel={monthLabel} stats={monthlyProgress} />
              </div>
              <div>
                <Leaderboard entries={leaderboardEntries} monthLabel={monthLabel} />
              </div>
            </div>

            <section aria-label="Schedule views" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Schedule timeframe"
                  className="inline-flex rounded-xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-[#111111]"
                >
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "upcoming", label: "Upcoming" },
                      { id: "history", label: "History" },
                    ] as const
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] ${
                          active
                            ? "bg-[#0071e3] text-white"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {activeTab === "history" && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2 py-1 dark:border-white/10 dark:bg-[#111111]">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() => setSelectedMonth(addMonths(effectiveMonth, -1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:text-neutral-200 dark:hover:bg-white/10"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-[130px] text-center text-xs font-semibold text-neutral-900 dark:text-white">
                      {formatMonthTitle(effectiveMonth)}
                    </span>
                    <button
                      type="button"
                      aria-label="Next month"
                      disabled={!canGoNextMonth}
                      onClick={() => {
                        if (canGoNextMonth) {
                          setSelectedMonth(addMonths(effectiveMonth, 1));
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-white/10"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {activeTab === "today" && (
                <DayCard
                  dateStr={todayStr}
                  todayStr={todayStr}
                  now={now}
                  postMap={mergedRecentMap}
                  membersById={membersById}
                  currentMemberId={currentMember.id}
                  onOpenMarkModal={(postDate, slot) => setModalTarget({ postDate, slot })}
                  onUndo={handleUndoPost}
                />
              )}

              {activeTab === "upcoming" && (
                <div className="space-y-4">
                  {upcomingDates.map((dateStr) => (
                    <DayCard
                      key={dateStr}
                      dateStr={dateStr}
                      todayStr={todayStr}
                      now={now}
                      postMap={mergedRecentMap}
                      membersById={membersById}
                      currentMemberId={currentMember.id}
                      disabled
                      onOpenMarkModal={(d, s) => setModalTarget({ postDate: d, slot: s })}
                      onUndo={handleUndoPost}
                    />
                  ))}
                </div>
              )}

              {activeTab === "history" && (
                <>
                  {historyLoading && historyPosts.length === 0 ? (
                    <DashboardSkeleton />
                  ) : historyPastDates.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-[#111111] dark:text-neutral-400">
                      No past days in {formatMonthTitle(effectiveMonth)} yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {historyPastDates.map((dateStr) => (
                        <DayCard
                          key={dateStr}
                          dateStr={dateStr}
                          todayStr={todayStr}
                          now={now}
                          postMap={mergedHistoryMap}
                          membersById={membersById}
                          currentMemberId={currentMember.id}
                          onOpenMarkModal={(d, s) => setModalTarget({ postDate: d, slot: s })}
                          onUndo={handleUndoPost}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {modalTarget && (
        <PostModal
          postDate={modalTarget.postDate}
          slot={modalTarget.slot}
          currentMember={currentMember}
          onClose={() => setModalTarget(null)}
          onConfirm={handleConfirmPost}
        />
      )}
    </div>
  );
}
