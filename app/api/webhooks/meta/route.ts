import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementAnalytics } from "@/lib/analytics/attribution";
import { generateAgentReply } from "@/lib/ai/agent";

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

type MessagingEvent = {
  sender?: { id?: string | number };
  recipient?: { id?: string | number };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
};

function webhookAccountId(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

async function findMetaAccountForInbound(
  supabase: ReturnType<typeof createAdminClient>,
  candidatePageIds: string[],
  objectType: string | undefined
) {
  const platform = objectType === "instagram" ? "instagram" : "facebook";
  for (const pid of candidatePageIds) {
    if (!pid) continue;
    let { data: metaAcc } = await supabase
      .from("meta_accounts")
      .select("id, organization_id")
      .eq("page_id", pid)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();
    if (!metaAcc) {
      ({ data: metaAcc } = await supabase
        .from("meta_accounts")
        .select("id, organization_id")
        .eq("page_id", pid)
        .eq("is_active", true)
        .maybeSingle());
    }
    if (metaAcc) return metaAcc;
  }
  return null;
}

export async function POST(req: Request) {
  let body: {
    object?: string;
    entry?: { id?: string | number; messaging?: MessagingEvent[] }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  for (const entry of body.entry ?? []) {
    const entryAccountId = webhookAccountId(entry.id);

    for (const evt of entry.messaging ?? []) {
      const msg = evt.message;
      if (!msg?.mid || msg.is_echo) continue;

      const metaUserId = webhookAccountId(evt.sender?.id);
      const recipientId = webhookAccountId(evt.recipient?.id);
      const text =
        msg.text?.trim() ||
        (Array.isArray(msg.attachments) && msg.attachments.length > 0
          ? "[Attachment]"
          : "");
      if (!metaUserId || !text) continue;

      const mid = msg.mid;

      const { data: dupe } = await supabase
        .from("messages")
        .select("id")
        .eq("meta_message_id", mid)
        .maybeSingle();
      if (dupe) continue;

      const platform =
        body.object === "instagram" ? "instagram" : "facebook";

      const candidateIds = Array.from(
        new Set(
          [entryAccountId, recipientId].filter(
            (x): x is string => Boolean(x)
          )
        )
      );
      const metaAcc = await findMetaAccountForInbound(
        supabase,
        candidateIds,
        body.object
      );

      if (!metaAcc) continue;

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
        const { data: inserted } = await supabase
          .from("leads")
          .insert({
            organization_id: orgId,
            meta_account_id: metaAcc.id,
            meta_user_id: metaUserId,
            status: "qualifying",
          })
          .select("id, meta_account_id")
          .single();
        lead = inserted;
      } else if (leadRow && !leadRow.meta_account_id) {
        await supabase
          .from("leads")
          .update({ meta_account_id: metaAcc.id })
          .eq("id", leadRow.id);
      }
      if (!lead) continue;

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
        const { data: inserted } = await supabase
          .from("conversations")
          .insert({
            organization_id: orgId,
            lead_id: lead.id,
            meta_thread_id: threadKey,
            last_message_at: new Date().toISOString(),
          })
          .select("id, is_ai_active")
          .single();
        conv = inserted;
      }
      if (!conv) continue;

      await supabase.from("messages").insert({
        conversation_id: conv.id,
        direction: "inbound",
        sender: "lead",
        content: text,
        meta_message_id: mid,
      });

      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conv.id);

      if (isNewConversation) {
        await incrementAnalytics(supabase, orgId, {
          conversations_started: 1,
        });
      }

      if (conv.is_ai_active !== false) {
        const key = process.env.GEMINI_API_KEY;
        if (key) {
          void generateAgentReply(conv.id, {
            supabase,
            geminiApiKey: key,
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
