import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Authenticated diagnostics: why webhooks may not create inbox rows (no secrets exposed).
 */
export async function GET() {
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

  let serviceRoleConfigured = false;
  try {
    createAdminClient();
    serviceRoleConfigured = true;
  } catch {
    serviceRoleConfigured = false;
  }

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const webhookUrl = appBase ? `${appBase}/api/webhooks/meta` : "";

  const { data: accounts, error: accErr } = await supabase
    .from("meta_accounts")
    .select(
      "id, platform, page_id, meta_user_id, facebook_page_id, is_active, oauth_provider"
    )
    .eq("organization_id", orgId);

  const { count: conversationCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  const healthUrl = webhookUrl ? `${webhookUrl}?health=1` : null;
  const igPageId = accounts?.[0]?.page_id?.trim();
  const testMid = `setterix-manual-${Date.now()}`;
  const copyPastePostTest =
    webhookUrl && igPageId
      ? {
          url: webhookUrl,
          method: "POST" as const,
          headers: { "Content-Type": "application/json" },
          body: {
            object: "instagram",
            entry: [
              {
                id: igPageId,
                messaging: [
                  {
                    sender: { id: "1000000000000001" },
                    recipient: { id: igPageId },
                    message: {
                      mid: testMid,
                      text: "Manual test — safe to delete this thread in app",
                    },
                  },
                ],
              },
            ],
          },
          note: "Send this from Postman or curl. You should see [meta-webhook] POST in Vercel Logs and conversationCount should increase. Change message.mid if you run twice.",
        }
      : null;

  const nativeIg = (accounts ?? []).some(
    (a) => a.oauth_provider === "instagram" && a.platform === "instagram"
  );

  return NextResponse.json({
    serviceRoleConfigured,
    webhookCallbackUrl: webhookUrl || null,
    healthUrl,
    verifyTokenConfigured: Boolean(
      process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
    ),
    metaWebhookDebugEnabled: process.env.META_WEBHOOK_DEBUG === "1",
    metaWebhookDebugHint:
      "Set META_WEBHOOK_DEBUG=1 on Vercel and redeploy — next POST logs the first ~4k chars of the raw body (check Logs for [meta-webhook] debug). Remove when done.",
    analyzeDeliveryEndpoint:
      "POST /api/integrations/meta/webhook-analyze with Content-Type: application/json and the raw JSON body copied from Meta Webhooks → Recent deliveries (same session). Explains ID matching without writing to the DB.",
    metaAccounts: accounts ?? [],
    metaAccountsLoadError: accErr?.message ?? null,
    conversationCount: conversationCount ?? 0,
    copyPastePostTest,
    instagramNativeIdNote:
      "Instagram Login (native): webhooks use the Instagram professional account id. Setterix now stores graph.instagram.com/me user_id when Meta returns it. If you connected before this fix, reconnect once so page_id matches webhook entry.id / recipient.id.",
    whereToSeeVercelLogs:
      "Vercel dashboard → your project → Logs tab (select Production). Or: Deployments → latest → Functions. Search filter: meta-webhook. If still empty, Meta is not POSTing to your URL.",
    metaSubscribeHint:
      "In developers.facebook.com: App → Instagram → API setup with Instagram login (or Webhooks) → subscribe to messaging/messages for your Instagram account. Page-only webhooks use a different object id — reconnect with Facebook OAuth if needed.",
    hints: [
      !serviceRoleConfigured &&
        "Set SUPABASE_SERVICE_ROLE_KEY on Vercel — webhooks cannot write to the DB without it.",
      !webhookUrl && "Set NEXT_PUBLIC_APP_URL so the webhook URL is known.",
      !(accounts?.length) &&
        "No meta_accounts rows — connect Instagram in Settings → Integrations.",
      healthUrl &&
        "Open healthUrl in a browser — you should see JSON and a [meta-webhook] GET line in Logs.",
      copyPastePostTest &&
        "If Meta shows no deliveries: use copyPastePostTest to prove POST logging and DB writes work.",
      serviceRoleConfigured &&
        (accounts?.length ?? 0) > 0 &&
        (conversationCount ?? 0) === 0 &&
        "Zero conversations + zero [meta-webhook] POST logs usually means Meta never calls your callback — fix subscription product/fields in Meta, or URL mismatch (www vs non-www).",
      nativeIg &&
        "Connected via Instagram-native OAuth? If simulate works but real DMs do not, paste a delivery into POST /api/integrations/meta/webhook-analyze — if accountMatches is empty, reconnect Instagram so stored page_id matches Meta’s entry.id.",
    ].filter(Boolean),
  });
}
