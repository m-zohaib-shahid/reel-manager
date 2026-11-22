import { createClient, type InsForgeClient } from "@insforge/sdk";

const AUTH_STORAGE_KEY = "reel-tracker-auth";

interface StoredAuthSession {
  accessToken: string;
  refreshToken: string | null;
}

let cachedClient: InsForgeClient | null = null;

function isJwtExpired(token: string, leewaySeconds = 60): boolean {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return true;
    }
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof parsed.exp !== "number") {
      return true;
    }
    return parsed.exp * 1000 <= Date.now() + leewaySeconds * 1000;
  } catch {
    return true;
  }
}

function restoreStoredAuth(client: InsForgeClient): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (!parsed.accessToken) {
      return;
    }
    const http = client.getHttpClient();
    if (!isJwtExpired(parsed.accessToken)) {
      http.setAuthToken(parsed.accessToken);
      http.setRefreshToken(parsed.refreshToken ?? null);
      return;
    }
    if (parsed.refreshToken) {
      http.setAuthToken(parsed.accessToken);
      http.setRefreshToken(parsed.refreshToken);
      return;
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage parse/access errors
  }
}

export function getInsforgeClient(): InsForgeClient {
  if (cachedClient) {
    return cachedClient;
  }

  const baseUrl = (import.meta.env.VITE_INSFORGE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY ?? "").trim();

  if (!baseUrl || !anonKey) {
    throw new Error(
      "InsForge environment variables are missing. Set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY in .env.local."
    );
  }

  cachedClient = createClient({ baseUrl, anonKey });
  restoreStoredAuth(cachedClient);
  return cachedClient;
}

export function applyInsforgeAuthSession(
  accessToken: string,
  refreshToken: string | null
): void {
  const client = getInsforgeClient();
  const http = client.getHttpClient();
  http.setAuthToken(accessToken);
  http.setRefreshToken(refreshToken);

  if (typeof window !== "undefined") {
    try {
      const payload: StoredAuthSession = { accessToken, refreshToken };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors
    }
  }
}

export async function clearInsforgeAuthSession(callRemoteSignOut = true): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage remove errors
    }
  }

  if (!cachedClient) {
    return;
  }

  if (callRemoteSignOut) {
    try {
      await cachedClient.auth.signOut();
    } catch {
      // Non-fatal
    }
  }

  const http = cachedClient.getHttpClient();
  http.setAuthToken(null);
  http.setRefreshToken(null);
}
