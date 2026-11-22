import type { DailyPost, MarkPostedInput, SlotNumber, TeamMember } from "../types";
import type { DataAdapter } from "./types";

function getBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "";
  return raw.replace(/\/+$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL is not configured (set VITE_API_BASE_URL).");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      if (data.error) {
        message = data.error;
      } else if (data.message) {
        message = data.message;
      }
    } catch {
      // Fallback to status text when response body is not JSON
      if (res.statusText) {
        message = `${message}: ${res.statusText}`;
      }
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export const apiAdapter: DataAdapter = {
  async getMembers(): Promise<TeamMember[]> {
    return request<TeamMember[]>("/members");
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    const result = await request<{ ok: boolean }>("/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ memberId, pin }),
    });
    return Boolean(result.ok);
  },

  async getPosts(fromDate: string, toDate: string): Promise<DailyPost[]> {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    return request<DailyPost[]>(`/posts?${params.toString()}`);
  },

  async markPosted(input: MarkPostedInput): Promise<DailyPost> {
    return request<DailyPost>("/posts", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  async undoPost(postDate: string, slot: SlotNumber, memberId: string): Promise<DailyPost> {
    return request<DailyPost>("/posts", {
      method: "DELETE",
      body: JSON.stringify({ postDate, slot, memberId }),
    });
  },

  subscribe(onChange: () => void): () => void {
    const intervalId = window.setInterval(() => {
      onChange();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  },
};
