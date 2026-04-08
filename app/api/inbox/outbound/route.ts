import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInstagramMessage } from "@/lib/meta/instagram";
import { sendMessengerMessage } from "@/lib/meta/facebook";
import { incrementAnalytics } from "@/lib/analytics/attribution";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: orgId } = await supabase.rpc("get_my_org_id");
  if (!orgId) {
    return NextResponse.json({ error: "no_org" }, { status: 403 });
  }

  let body: { conversationId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { conversationId, content } = body;
  if (!conversationId || !content?.trim()) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("id, organization_id, lead_id")
    .eq("id", conversationId)
    .eq("organization_id", orgId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: lead } = await admin
    .from("leads")
    .select("meta_user_id")
    .eq("id", conv.lead_id)
    .single();

  const { data: metaAcc } = await admin
    .from("meta_accounts")
    .select("platform, access_token")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const { data: inserted } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    sender: "human",
    content: content.trim(),
  }).select("id").single();

  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (metaAcc?.access_token && lead?.meta_user_id) {
    const send =
      metaAcc.platform === "instagram"
        ? sendInstagramMessage(metaAcc.access_token, lead.meta_user_id, content.trim())
        : sendMessengerMessage(metaAcc.access_token, lead.meta_user_id, content.trim());
    const r = await send;
    if (r.message_id && inserted?.id) {
      await admin
        .from("messages")
        .update({ meta_message_id: r.message_id })
        .eq("id", inserted.id);
    }
  }

  await incrementAnalytics(admin, orgId, { messages_sent: 1 });

  return NextResponse.json({ ok: true, messageId: inserted?.id });
}
