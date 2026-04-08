/**
 * Deno Edge Function: invoke from Meta webhook or cron.
 * Forwards to the Next.js /api/agent/reply route with INTERNAL_AGENT_SECRET.
 *
 * Deploy: supabase functions deploy process-inbound-message --no-verify-jwt
 * Secrets: APP_URL, INTERNAL_AGENT_SECRET
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const conversationId = body.conversationId;
  if (!conversationId) {
    return new Response(JSON.stringify({ error: "missing_conversationId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appUrl = Deno.env.get("APP_URL") ?? "";
  const secret = Deno.env.get("INTERNAL_AGENT_SECRET") ?? "";
  if (!appUrl || !secret) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/agent/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ conversationId }),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
