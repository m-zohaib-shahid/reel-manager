import {
  applyInsforgeAuthSession,
  clearInsforgeAuthSession,
  getInsforgeClient,
} from "../insforge";
import type { DailyPost, MarkPostedInput, SlotNumber, TeamMember } from "../types";
import type { DataAdapter } from "./types";

interface TeamMemberRow {
  id: string;
  name: string;
  avatar_color: string;
  sort_order: number;
}

interface DailyPostRow {
  id: string;
  post_date: string;
  slot: number;
  member_id: string;
  posted: boolean;
  posted_at: string | null;
  reel_url: string | null;
  caption_ref: string | null;
}

interface PinLoginResponse {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string | null;
  error?: string;
}

const REALTIME_CHANNEL = "reel-tracker:posts";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const localListeners = new Set<() => void>();
let realtimeActiveCount = 0;
let realtimeHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let focusHandler: (() => void) | null = null;
let lastMissedSyncAt = 0;
let missedSyncPromise: Promise<void> | null = null;

function formatErrorMessage(err: { message?: string } | null | undefined, fallback: string): string {
  const raw = err?.message?.trim();
  if (!raw) {
    return fallback;
  }
  if (raw.startsWith("<!DOCTYPE") || raw.startsWith("<html")) {
    return `${fallback} (server returned an unexpected response)`;
  }
  return raw;
}

function isAuthError(err: { statusCode?: number; message?: string; code?: string } | null | undefined): boolean {
  if (!err) {
    return false;
  }
  if (err.statusCode === 401 || err.statusCode === 403) {
    return true;
  }
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("token");
}

function mapPostRow(row: DailyPostRow): DailyPost {
  return {
    id: row.id,
    postDate: String(row.post_date).slice(0, 10),
    slot: row.slot as SlotNumber,
    posted: Boolean(row.posted),
    postedBy: row.member_id ?? null,
    postedAt: row.posted_at ?? null,
    reelUrl: row.reel_url ?? null,
    captionRef: row.caption_ref ?? null,
  };
}

function notifyLocalListeners(): void {
  localListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  });
}

async function ensureMissedTasksSynced(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastMissedSyncAt < SYNC_INTERVAL_MS) {
    return;
  }
  if (missedSyncPromise) {
    return missedSyncPromise;
  }
  missedSyncPromise = (async () => {
    try {
      const insforge = getInsforgeClient();
      const { error } = await insforge.database.rpc("sync_missed_tasks", {
        p_days_back: 7,
      });
      if (!error) {
        lastMissedSyncAt = Date.now();
      }
    } catch {
      // Non-fatal: dashboard reads remain unaffected
    } finally {
      missedSyncPromise = null;
    }
  })();
  return missedSyncPromise;
}

async function ensureRealtimeSubscribed(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const insforge = getInsforgeClient();

  if (!realtimeHandler) {
    realtimeHandler = () => {
      notifyLocalListeners();
    };
  }

  try {
    await insforge.realtime.connect();
    const res = await insforge.realtime.subscribe(REALTIME_CHANNEL);
    if (res.ok) {
      insforge.realtime.off("posts_changed", realtimeHandler);
      insforge.realtime.on("posts_changed", realtimeHandler);
    }
  } catch {
    // Non-fatal: app remains functional via focus/visibility refresh
  }
}

async function runWithStaleTokenRecovery<T>(
  operation: () => Promise<{ data: T | null; error: { statusCode?: number; message?: string; code?: string } | null }>
): Promise<{ data: T | null; error: { statusCode?: number; message?: string; code?: string } | null }> {
  const first = await operation();
  if (first.error && isAuthError(first.error)) {
    await clearInsforgeAuthSession(false);
    return operation();
  }
  return first;
}

export const insforgeAdapter: DataAdapter = {
  async getMembers(): Promise<TeamMember[]> {
    const insforge = getInsforgeClient();
    const { data, error } = await runWithStaleTokenRecovery(async () =>
      insforge.database
        .from("team_members")
        .select("id, name, avatar_color, sort_order")
        .order("sort_order", { ascending: true })
        .limit(20)
    );

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to load team members."));
    }

    const rows = (data ?? []) as TeamMemberRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarColor: row.avatar_color,
    }));
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    const insforge = getInsforgeClient();
    await clearInsforgeAuthSession(false);

    const { data, error } = await insforge.functions.invoke<PinLoginResponse>("pin-login", {
      body: {
        memberId,
        pin: pin.trim(),
      },
    });

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to verify PIN."));
    }

    if (!data?.ok) {
      if (data?.error) {
        throw new Error(data.error);
      }
      return false;
    }

    if (data.accessToken) {
      applyInsforgeAuthSession(data.accessToken, data.refreshToken ?? null);
    }

    return true;
  },

  async getPosts(fromDate: string, toDate: string): Promise<DailyPost[]> {
    const insforge = getInsforgeClient();
    void ensureMissedTasksSynced();

    const { data, error } = await runWithStaleTokenRecovery(async () =>
      insforge.database
        .from("daily_posts")
        .select("id, post_date, slot, member_id, posted, posted_at, reel_url, caption_ref")
        .gte("post_date", fromDate)
        .lte("post_date", toDate)
        .order("post_date", { ascending: true })
        .order("slot", { ascending: true })
        .limit(500)
    );

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to load posts."));
    }

    const rows = (data ?? []) as DailyPostRow[];
    return rows.map(mapPostRow);
  },

  async markPosted(input: MarkPostedInput): Promise<DailyPost> {
    const insforge = getInsforgeClient();
    const { data, error } = await runWithStaleTokenRecovery(async () =>
      insforge.database.rpc("mark_reel_posted", {
        p_post_date: input.postDate,
        p_slot: input.slot,
        p_member_id: input.memberId,
        p_reel_url: input.reelUrl && input.reelUrl.trim() ? input.reelUrl.trim() : null,
        p_caption_ref: input.captionRef && input.captionRef.trim() ? input.captionRef.trim() : null,
      })
    );

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to save reel post."));
    }

    const row = (Array.isArray(data) ? data[0] : data) as DailyPostRow | null;
    if (!row) {
      throw new Error("No post returned from server.");
    }

    notifyLocalListeners();
    return mapPostRow(row);
  },

  async undoPost(postDate: string, slot: SlotNumber, memberId: string): Promise<DailyPost> {
    const insforge = getInsforgeClient();
    const { data, error } = await runWithStaleTokenRecovery(async () =>
      insforge.database.rpc("undo_reel_post", {
        p_post_date: postDate,
        p_slot: slot,
        p_member_id: memberId,
      })
    );

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to undo post."));
    }

    notifyLocalListeners();
    const cleared = data as DailyPost | null;
    if (cleared && cleared.id) {
      return cleared;
    }

    return {
      id: `${postDate}-${slot}-${memberId}`,
      postDate,
      slot,
      posted: false,
      postedBy: null,
      postedAt: null,
      reelUrl: null,
      captionRef: null,
    };
  },

  subscribe(onChange: () => void): () => void {
    localListeners.add(onChange);
    realtimeActiveCount += 1;

    if (realtimeActiveCount === 1) {
      void ensureRealtimeSubscribed();

      if (typeof window !== "undefined") {
        focusHandler = () => {
          notifyLocalListeners();
        };
        visibilityHandler = () => {
          if (document.visibilityState === "visible") {
            notifyLocalListeners();
          }
        };
        window.addEventListener("focus", focusHandler);
        document.addEventListener("visibilitychange", visibilityHandler);
      }
    }

    return () => {
      localListeners.delete(onChange);
      realtimeActiveCount = Math.max(0, realtimeActiveCount - 1);

      if (realtimeActiveCount === 0 && typeof window !== "undefined") {
        if (focusHandler) {
          window.removeEventListener("focus", focusHandler);
          focusHandler = null;
        }
        if (visibilityHandler) {
          document.removeEventListener("visibilitychange", visibilityHandler);
          visibilityHandler = null;
        }
        try {
          const insforge = getInsforgeClient();
          if (realtimeHandler) {
            insforge.realtime.off("posts_changed", realtimeHandler);
          }
          insforge.realtime.unsubscribe(REALTIME_CHANNEL);
          insforge.realtime.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  },

  async signOut(): Promise<void> {
    await clearInsforgeAuthSession(true);
  },
};
