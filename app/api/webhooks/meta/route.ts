import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementAnalytics } from "@/lib/analytics/attribution";
import { generateAgentReply } from "@/lib/ai/agent";
import { findMetaAccountByWebhookIds } from "@/lib/meta/find-meta-account-webhook";
import { fetchMetaUserProfile } from "@/lib/meta/instagram";
import {
  envelopeEntries,
  messageMidFromPayload,
  messagingEventsFromEntry,
  parseMetaWebhookPayload,
  webhookAccountId,
  type WebhookEntry,
  type WebhookMessagingEvent,
} from "@/lib/meta/meta-webhook-payload";

export const dynamic = "force-dynamic";
/** Ensure Node runtime so stdout appears in Vercel Runtime Logs (not Edge). */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("health") === "1") {
    console.info("[meta-webhook] GET health check");
    return NextResponse.json({
      ok: true,
      route: "/api/webhooks/meta",
      verifyTokenConfigured: Boolean(
        process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
      ),
      serviceRoleConfigured: (() => {
        try {
          return Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
              process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
          );
        } catch {
          return false;
        }
      })(),
      ts: new Date().toISOString(),
      hint: "If you see this JSON, the route is deployed. Meta uses POST, not this URL.",
    });
  }

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    console.info("[meta-webhook] GET subscribe verify OK");
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

const REPLY_DELAY_MS = 8_000;

/**
 * Waits REPLY_DELAY_MS, then replies only if no newer inbound message arrived.
 * This lets the user finish typing a burst of messages before the AI responds.
 */
async function scheduleAgentReply(
  supabase: ReturnType<typeof createAdminClient>,
  convId: string,
  messageInsertedAt: string,
  geminiApiKey: string
): Promise<void> {
  await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));

  const { data: fresh } = await supabase
    .from("conversations")
    .select("last_message_at, is_ai_active")
    .eq("id", convId)
    .single();

  if (!fresh || fresh.is_ai_active === false) return;

  // If a newer message arrived while we were waiting, that invocation will reply.
  const lastMs = fresh.last_message_at ? new Date(fresh.last_message_at).getTime() : 0;
  const myMs = new Date(messageInsertedAt).getTime();
  if (lastMs > myMs + 500) {
    console.info("[meta-webhook] skipping reply — newer message arrived");
    return;
  }

  const result = await generateAgentReply(convId, { supabase, geminiApiKey });
  console.info("[meta-webhook] generateAgentReply result:", JSON.stringify(result));
}

async function processMessagingEvent(
  supabase: ReturnType<typeof createAdminClient>,
  objectType: string | undefined,
  entry: WebhookEntry,
  evt: WebhookMessagingEvent
) {
  const msg = evt.message;
  if (!msg || msg.is_echo) return;

  const mid = messageMidFromPayload(msg);
  if (!mid) return;

  const metaUserId = webhookAccountId(evt.sender?.id);
  const recipientId = webhookAccountId(evt.recipient?.id);
  const text =
    msg.text?.trim() ||
    (Array.isArray(msg.attachments) && msg.attachments.length > 0
      ? "[Attachment]"
      : "");
  if (!metaUserId || !text) return;

  const { data: dupe } = await supabase
    .from("messages")
    .select("id")
    .eq("meta_message_id", mid)
    .maybeSingle();
  if (dupe) return;

  const platform =
    (objectType ?? "").toLowerCase() === "instagram"
      ? "instagram"
      : "facebook";

  const entryAccountId = webhookAccountId(entry.id);
  const candidateIds = Array.from(
    new Set(
      [entryAccountId, recipientId].filter(
        (x): x is string => Boolean(x)
      )
    )
  );

  const metaAcc = await findMetaAccountByWebhookIds(supabase, candidateIds);
  if (!metaAcc) {
    console.warn(
      "[meta-webhook] no meta_accounts row for ids",
      candidateIds.join(", ")
    );
    return;
  }

  const orgId = metaAcc.organization_id;
  const threadKey = `${platform}:${metaUserId}`;

  const { data: leadRow } = await supabase
    .from("leads")
    .select("id, meta_account_id, name, username")
    .eq("organization_id", orgId)
    .eq("meta_user_id", metaUserId)
    .maybeSingle();

  let lead = leadRow;
  if (!lead) {
    const { data: inserted, error: insLeadErr } = await supabase
      .from("leads")
      .insert({
        organization_id: orgId,
        meta_account_id: metaAcc.id,
        meta_user_id: metaUserId,
        status: "qualifying",
      })
      .select("id, meta_account_id, name, username")
      .single();
    if (insLeadErr) {
      console.error("[meta-webhook] lead insert", insLeadErr.message);
      return;
    }
    lead = inserted;
  } else if (leadRow && !leadRow.meta_account_id) {
    await supabase
      .from("leads")
      .update({ meta_account_id: metaAcc.id })
      .eq("id", leadRow.id);
  }
  if (!lead) return;

  if (!lead.name && !lead.username) {
    void fetchMetaUserProfile(metaAcc.access_token, metaUserId, metaAcc.oauth_provider)
      .then((profile) => {
        if (!profile.name && !profile.username && !profile.profile_picture_url) return;
        return supabase.from("leads").update({
          ...(profile.name && { name: profile.name }),
          ...(profile.username && { username: profile.username }),
          ...(profile.profile_picture_url && { profile_picture_url: profile.profile_picture_url }),
        }).eq("id", lead!.id);
      })
      .catch((e) => console.error("[meta-webhook] fetchMetaUserProfile", String(e)));
  }

  const { data: convRow } = await supabase
    .from("conversations")
    .select("id, is_ai_active")
    .eq("organization_id", orgId)
    .eq("meta_thread_id", threadKey)
    .maybeSingle();

  let isNewConversation = false;
  let conv = convRow;
  if (!conv) {
    isNewConversation = true;
    const { data: inserted, error: convErr } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgId,
        lead_id: lead.id,
        meta_thread_id: threadKey,
        last_message_at: new Date().toISOString(),
      })
      .select("id, is_ai_active")
      .single();
    if (convErr) {
      console.error("[meta-webhook] conversation insert", convErr.message);
      return;
    }
    conv = inserted;
  }
  if (!conv) return;

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    direction: "inbound",
    sender: "lead",
    content: text,
    meta_message_id: mid,
  });
  if (msgErr) {
    console.error("[meta-webhook] message insert", msgErr.message);
    return;
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id);

  if (isNewConversation) {
    try {
      await incrementAnalytics(supabase, orgId, {
        conversations_started: 1,
      });
    } catch (e) {
      console.error("[meta-webhook] incrementAnalytics", String(e));
    }
  }

  console.info("[meta-webhook] is_ai_active:", conv.is_ai_active, "conv:", conv.id);
  if (conv.is_ai_active !== false) {
    const key = process.env.GEMINI_API_KEY;
    console.info("[meta-webhook] GEMINI_API_KEY present:", Boolean(key));
    if (key) {
      const insertedAt = new Date().toISOString();
      void scheduleAgentReply(supabase, conv.id, insertedAt, key).catch((e) =>
        console.error("[meta-webhook] scheduleAgentReply error:", String(e))
      );
    }
  }
}

export async function POST(req: Request) {
  // stderr + prefix: easier to spot in Vercel → project → Logs (Production)
  console.error("[meta-webhook] POST received", new Date().toISOString());

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("[meta-webhook] createAdminClient failed", String(e));
    return NextResponse.json({ ok: true });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (parseErr) {
    console.warn(
      "[meta-webhook] invalid JSON body",
      String(parseErr)
    );
    return NextResponse.json({ ok: true });
  }

  if (process.env.META_WEBHOOK_DEBUG === "1") {
    try {
      console.log(
        "[meta-webhook] debug payload keys",
        JSON.stringify(raw).slice(0, 4000)
      );
    } catch {
      console.log("[meta-webhook] debug payload (non-serializable)");
    }
  }

  const envelopes = parseMetaWebhookPayload(raw);
  if (envelopes.length === 0) {
    console.warn(
      "[meta-webhook] no envelopes; raw preview:",
      typeof raw === "object" && raw !== null
        ? JSON.stringify(raw).slice(0, 800)
        : String(raw).slice(0, 200)
    );
  } else {
    console.info(
      "[meta-webhook] envelopes:",
      JSON.stringify(
        envelopes.map((e) => ({
          object: e.object,
          entryCount: envelopeEntries(e).length,
        }))
      )
    );
  }

  for (const env of envelopes) {
    const objectType = env.object;
    for (const entry of envelopeEntries(env)) {
      const changeFields = (entry.changes ?? [])
        .map((c) => c.field)
        .filter(Boolean);
      if (changeFields.length > 0) {
        console.info(
          "[meta-webhook] entry.changes fields:",
          changeFields.join(", ")
        );
      }
      const events = messagingEventsFromEntry(entry);
      for (const evt of events) {
        try {
          await processMessagingEvent(supabase, objectType, entry, evt);
        } catch (e) {
          console.error("[meta-webhook] processMessagingEvent", String(e));
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
