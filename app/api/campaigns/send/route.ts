import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInstagramMessage } from "@/lib/meta/instagram";
import { sendMessengerMessage } from "@/lib/meta/facebook";

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

  let body: { campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const campaignId = body.campaignId;
  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: metaAcc } = await admin
    .from("meta_accounts")
    .select("platform, access_token, page_id, oauth_provider")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!metaAcc?.access_token) {
    return NextResponse.json({ error: "no_meta_account" }, { status: 400 });
  }

  const template = campaign.message_template as string;
  const recipients = ((campaign.source_meta as { ids?: string[] })?.ids ??
    []) as string[];

  let sent = 0;
  for (const rid of recipients) {
    const msg = template
      .replace(/\{\{name\}\}/gi, "there")
      .replace(/\{\{business\}\}/gi, "");
    const r =
      metaAcc.platform === "instagram"
        ? await sendInstagramMessage(
            metaAcc.access_token,
            metaAcc.page_id,
            rid,
            msg,
            metaAcc.oauth_provider
          )
        : await sendMessengerMessage(metaAcc.access_token, rid, msg);
    if (!r.error) sent += 1;
  }

  await admin
    .from("campaigns")
    .update({
      sent_count: (campaign.sent_count ?? 0) + sent,
      status: "running",
    })
    .eq("id", campaignId);

  return NextResponse.json({ ok: true, sent });
}
