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
      "id, platform, page_id, meta_user_id, is_active, oauth_provider"
    )
    .eq("organization_id", orgId);

  const { count: conversationCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  return NextResponse.json({
    serviceRoleConfigured,
    webhookCallbackUrl: webhookUrl || null,
    verifyTokenConfigured: Boolean(
      process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
    ),
    metaAccounts: accounts ?? [],
    metaAccountsLoadError: accErr?.message ?? null,
    conversationCount: conversationCount ?? 0,
    hints: [
      !serviceRoleConfigured &&
        "Set SUPABASE_SERVICE_ROLE_KEY on Vercel — webhooks cannot write to the DB without it.",
      !webhookUrl && "Set NEXT_PUBLIC_APP_URL so the webhook URL is known.",
      !(accounts?.length) &&
        "No meta_accounts rows — connect Instagram in Settings → Integrations.",
      serviceRoleConfigured &&
        (accounts?.length ?? 0) > 0 &&
        (conversationCount ?? 0) === 0 &&
        "Meta may not be POSTing yet: in Meta App → Webhooks, send a test or DM your IG from another account; check Vercel logs for [meta-webhook].",
    ].filter(Boolean),
  });
}
