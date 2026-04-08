import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementAnalytics } from "@/lib/analytics/attribution";
import { generateAgentReply } from "@/lib/ai/agent";
import { findMetaAccountByWebhookIds } from "@/lib/meta/find-meta-account-webhook";
import {
  messageMidFromPayload,
  parseMetaWebhookPayload,
  webhookAccountId,
  type WebhookEntry,
  type WebhookMessagingEvent,
} from "@/lib/meta/meta-webhook-payload";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    .select("id, meta_account_id")
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
      .select("id, meta_account_id")
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

  if (conv.is_ai_active !== false) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      void generateAgentReply(conv.id, {
        supabase,
        geminiApiKey: key,
      }).catch((e) =>
        console.error("[meta-webhook] generateAgentReply", String(e))
      );
    }
  }
}

export async function POST(req: Request) {
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
  } catch {
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

  for (const env of envelopes) {
    const objectType = env.object;
    for (const entry of (env.entry ?? []) as WebhookEntry[]) {
      const events: WebhookMessagingEvent[] = [
        ...(entry.messaging ?? []),
        ...(entry.standby ?? []),
      ];
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
