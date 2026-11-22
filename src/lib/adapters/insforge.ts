import { getInsforgeClient } from "../insforge";
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

const REALTIME_CHANNEL = "reel-tracker:posts";
const localListeners = new Set<() => void>();
let realtimeActiveCount = 0;
let realtimeHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let focusHandler: (() => void) | null = null;

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

export const insforgeAdapter: DataAdapter = {
  async getMembers(): Promise<TeamMember[]> {
    const insforge = getInsforgeClient();
    const { data, error } = await insforge.database
      .from("team_members")
      .select("id, name, avatar_color, sort_order")
      .order("sort_order", { ascending: true })
      .limit(20);

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
    const { data, error } = await insforge.database.rpc("verify_member_pin", {
      p_member_id: memberId,
      p_pin: pin.trim(),
    });

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to verify PIN."));
    }

    return Boolean(data);
  },

  async getPosts(fromDate: string, toDate: string): Promise<DailyPost[]> {
    const insforge = getInsforgeClient();
    const { data, error } = await insforge.database
      .from("daily_posts")
      .select("id, post_date, slot, member_id, posted, posted_at, reel_url, caption_ref")
      .gte("post_date", fromDate)
      .lte("post_date", toDate)
      .order("post_date", { ascending: true })
      .order("slot", { ascending: true })
      .limit(500);

    if (error) {
      throw new Error(formatErrorMessage(error, "Failed to load posts."));
    }

    const rows = (data ?? []) as DailyPostRow[];
    return rows.map(mapPostRow);
  },

  async markPosted(input: MarkPostedInput): Promise<DailyPost> {
    const insforge = getInsforgeClient();
    const { data, error } = await insforge.database.rpc("mark_reel_posted", {
      p_post_date: input.postDate,
      p_slot: input.slot,
      p_member_id: input.memberId,
      p_reel_url: input.reelUrl && input.reelUrl.trim() ? input.reelUrl.trim() : null,
      p_caption_ref: input.captionRef && input.captionRef.trim() ? input.captionRef.trim() : null,
    });

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
    const { data, error } = await insforge.database.rpc("undo_reel_post", {
      p_post_date: postDate,
      p_slot: slot,
      p_member_id: memberId,
    });

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
};
