import { createClient } from "npm:@insforge/sdk";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const baseUrl = (Deno.env.get("INSFORGE_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  const anonKey = (Deno.env.get("ANON_KEY") ?? "").trim();

  if (!baseUrl || !anonKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = createClient({ baseUrl, anonKey, isServerMode: true });
  const { data, error } = await client.database.rpc("sync_missed_tasks", {
    p_days_back: 7,
  });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, updatedRows: data ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
