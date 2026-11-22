import { createClient } from "npm:@insforge/sdk";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function deriveMemberPassword(secret: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(email));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 32)}Aa1!`;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const baseUrl = (Deno.env.get("INSFORGE_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  const anonKey = (Deno.env.get("ANON_KEY") ?? "").trim();
  const authSecret = (Deno.env.get("REEL_TEAM_AUTH_SECRET") ?? "").trim();

  if (!baseUrl || !anonKey || !authSecret) {
    return jsonResponse(
      { ok: false, error: "Server auth configuration is incomplete." },
      500
    );
  }

  let payload: { memberId?: string; pin?: string } = {};
  try {
    payload = (await req.json()) as { memberId?: string; pin?: string };
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON request body." }, 400);
  }

  const memberId = (payload.memberId ?? "").trim();
  const pin = (payload.pin ?? "").trim();

  if (!memberId || !pin) {
    return jsonResponse({ ok: false, error: "Member ID and PIN are required." }, 400);
  }

  const client = createClient({
    baseUrl,
    anonKey,
    isServerMode: true,
  });

  const { data: verified, error: verifyError } = await client.database.rpc(
    "verify_member_pin",
    {
      p_member_id: memberId,
      p_pin: pin,
    }
  );

  if (verifyError) {
    return jsonResponse(
      { ok: false, error: verifyError.message || "PIN verification failed." },
      500
    );
  }

  if (!verified) {
    return jsonResponse({ ok: false }, 200);
  }

  const { data: memberRow, error: memberError } = await client.database
    .from("team_members")
    .select("id, name, avatar_color, email")
    .eq("id", memberId)
    .single();

  if (memberError || !memberRow || !memberRow.email) {
    return jsonResponse(
      { ok: false, error: "Team member email record is missing." },
      500
    );
  }

  const password = await deriveMemberPassword(authSecret, memberRow.email);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: memberRow.email,
    password,
  });

  if (authError || !authData?.accessToken || !authData?.user) {
    return jsonResponse(
      {
        ok: false,
        error: authError?.message || "Failed to create InsForge Auth session.",
      },
      500
    );
  }

  return jsonResponse({
    ok: true,
    accessToken: authData.accessToken,
    refreshToken: authData.refreshToken ?? null,
    user: authData.user,
    member: {
      id: memberRow.id,
      name: memberRow.name,
      avatarColor: memberRow.avatar_color,
    },
  });
}
