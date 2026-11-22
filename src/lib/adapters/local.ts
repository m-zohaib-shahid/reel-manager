import type { DailyPost, MarkPostedInput, SlotNumber, TeamMember } from "../types";
import type { DataAdapter } from "./types";

const POSTS_STORAGE_KEY = "reel-tracker-posts";
const MEMBERS_STORAGE_KEY = "reel-tracker-members";
const SESSION_STORAGE_KEY = "reel-tracker-session";
const DATA_VERSION_KEY = "reel-tracker-data-version";
const CURRENT_DATA_VERSION = "v2-huzaifa-hashir";
const CHANNEL_NAME = "reel-tracker";

const SEED_MEMBERS: TeamMember[] = [
  { id: "zohaib", name: "Zohaib", avatarColor: "#0071e3" },
  { id: "member-2", name: "Huzaifa", avatarColor: "#30d158" },
  { id: "member-3", name: "Hashir", avatarColor: "#ff9f0a" },
];

const PRIVATE_PINS: Record<string, string> = {
  zohaib: "1111",
  "member-2": "2222",
  "member-3": "3333",
};

const localListeners = new Set<() => void>();

function delay(ms = 150): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function ensureFreshLocalData(): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  try {
    if (window.localStorage.getItem(DATA_VERSION_KEY) === CURRENT_DATA_VERSION) {
      return;
    }
    window.localStorage.removeItem(POSTS_STORAGE_KEY);
    window.localStorage.removeItem(MEMBERS_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(SEED_MEMBERS));
    window.localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

function readJson<T>(key: string): T | null {
  if (!canUseBrowserStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseBrowserStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private browsing write failures
  }
}

function readMembers(): TeamMember[] {
  ensureFreshLocalData();
  const stored = readJson<TeamMember[]>(MEMBERS_STORAGE_KEY);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeJson(MEMBERS_STORAGE_KEY, SEED_MEMBERS);
  return SEED_MEMBERS;
}

function readPosts(): DailyPost[] {
  ensureFreshLocalData();
  const stored = readJson<DailyPost[]>(POSTS_STORAGE_KEY);
  if (Array.isArray(stored)) {
    return stored;
  }
  return [];
}

function writePosts(posts: DailyPost[]): void {
  writeJson(POSTS_STORAGE_KEY, posts);
}

function notifyChange(): void {
  localListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore subscriber callback errors
    }
  });

  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: "posts-updated", at: Date.now() });
      channel.close();
    } catch {
      // Ignore BroadcastChannel unavailability
    }
  }
}

export const localAdapter: DataAdapter = {
  async getMembers(): Promise<TeamMember[]> {
    await delay(120);
    return readMembers().map(({ id, name, avatarColor }) => ({
      id,
      name,
      avatarColor,
    }));
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    await delay(150);
    const expected = PRIVATE_PINS[memberId];
    return typeof expected === "string" && expected === pin.trim();
  },

  async getPosts(fromDate: string, toDate: string): Promise<DailyPost[]> {
    await delay(150);
    const allPosts = readPosts();
    return allPosts
      .filter((p) => p.postDate >= fromDate && p.postDate <= toDate)
      .sort((a, b) => {
        if (a.postDate !== b.postDate) {
          return a.postDate.localeCompare(b.postDate);
        }
        return a.slot - b.slot;
      });
  },

  async markPosted(input: MarkPostedInput): Promise<DailyPost> {
    await delay(150);
    const allPosts = readPosts();
    const id = `${input.postDate}-${input.slot}-${input.memberId}`;
    const existingIndex = allPosts.findIndex(
      (p) =>
        p.postDate === input.postDate &&
        p.slot === input.slot &&
        p.postedBy === input.memberId
    );

    if (existingIndex !== -1 && allPosts[existingIndex].posted) {
      throw new Error("You have already marked this slot as posted.");
    }

    const updated: DailyPost = {
      id,
      postDate: input.postDate,
      slot: input.slot,
      posted: true,
      postedBy: input.memberId,
      postedAt: new Date().toISOString(),
      reelUrl: input.reelUrl && input.reelUrl.trim() ? input.reelUrl.trim() : null,
      captionRef:
        input.captionRef && input.captionRef.trim() ? input.captionRef.trim() : null,
    };

    if (existingIndex !== -1) {
      allPosts[existingIndex] = updated;
    } else {
      allPosts.push(updated);
    }

    writePosts(allPosts);
    notifyChange();
    return updated;
  },

  async undoPost(postDate: string, slot: SlotNumber, memberId: string): Promise<DailyPost> {
    await delay(150);
    const allPosts = readPosts();
    const existingIndex = allPosts.findIndex(
      (p) =>
        p.postDate === postDate &&
        p.slot === slot &&
        p.postedBy === memberId
    );

    if (existingIndex === -1 || !allPosts[existingIndex].posted) {
      throw new Error("Slot is not currently posted by you.");
    }

    const existing = allPosts[existingIndex];
    const remaining = allPosts.filter((_, idx) => idx !== existingIndex);

    const cleared: DailyPost = {
      id: existing.id,
      postDate,
      slot,
      posted: false,
      postedBy: null,
      postedAt: null,
      reelUrl: null,
      captionRef: null,
    };

    writePosts(remaining);
    notifyChange();
    return cleared;
  },

  subscribe(onChange: () => void): () => void {
    localListeners.add(onChange);

    let channel: BroadcastChannel | null = null;
    const handleBroadcast = () => {
      onChange();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === POSTS_STORAGE_KEY || event.key === MEMBERS_STORAGE_KEY) {
        onChange();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      if (typeof BroadcastChannel !== "undefined") {
        try {
          channel = new BroadcastChannel(CHANNEL_NAME);
          channel.addEventListener("message", handleBroadcast);
        } catch {
          channel = null;
        }
      }
    }

    return () => {
      localListeners.delete(onChange);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
      if (channel) {
        try {
          channel.removeEventListener("message", handleBroadcast);
          channel.close();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  },
};
