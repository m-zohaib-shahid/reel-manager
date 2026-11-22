import { createClient, type InsForgeClient } from "@insforge/sdk";

let cachedClient: InsForgeClient | null = null;

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
  return cachedClient;
}
