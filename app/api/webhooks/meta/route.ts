import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementAnalytics } from "@/lib/analytics/attribution";

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
  sender?: { id?: string };
  message?: { mid?: string; text?: string };
};

export async function POST(req: Request) {
  let body: {
    object?: string;
    entry?: { id?: string; messaging?: MessagingEvent[] }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  for (const entry of body.entry ?? []) {
    const pageId = entry.id ?? "";
    for (const evt of entry.messaging ?? []) {
      const metaUserId = evt.sender?.id;
      const text = evt.message?.text?.trim();
      const mid = evt.message?.mid;
      if (!metaUserId || !text || !mid) continue;

      const { data: dupe } = await supabase
        .from("messages")
        .select("id")
        .eq("meta_message_id", mid)
        .maybeSingle();
      if (dupe) continue;

      const platform =
        body.object === "instagram" ? "instagram" : "facebook";

      const { data: metaAcc } = await supabase
        .from("meta_accounts")
        .select("id, organization_id")
        .eq("page_id", pageId)
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();

      if (!metaAcc) continue;

      const orgId = metaAcc.organization_id;
      const threadKey = `${platform}:${metaUserId}`;

      const { data: leadRow } = await supabase
        .from("leads")
        .select("id")
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
          .select("id")
          .single();
        lead = inserted;
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
        const base = process.env.NEXT_PUBLIC_APP_URL;
        const secret = process.env.INTERNAL_AGENT_SECRET;
        const key = process.env.GEMINI_API_KEY;
        if (base && secret && key) {
          void fetch(`${base.replace(/\/$/, "")}/api/agent/reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ conversationId: conv.id }),
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
