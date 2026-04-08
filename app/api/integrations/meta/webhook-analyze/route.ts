import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeMetaWebhookAgainstAccounts } from "@/lib/meta/analyze-meta-webhook";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 120_000;

/**
 * Authenticated: paste JSON from Meta → Webhooks → Recent deliveries (or full POST body).
 * Explains whether Setterix would route the event to a connected account (no DB writes).
 */
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

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: "body_too_large", maxChars: MAX_BODY_CHARS },
      { status: 413 }
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { data: accounts, error: accErr } = await supabase
    .from("meta_accounts")
    .select("id, page_id, meta_user_id, facebook_page_id, oauth_provider, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (accErr) {
    return NextResponse.json(
      { error: "accounts_load_failed", message: accErr.message },
      { status: 500 }
    );
  }

  const analysis = analyzeMetaWebhookAgainstAccounts(raw, accounts ?? []);

  return NextResponse.json({
    ...analysis,
    connectedAccountCount: accounts?.length ?? 0,
    storedIdsForCompare: (accounts ?? []).map((a) => ({
      accountId: a.id,
      oauth_provider: a.oauth_provider,
      page_id: a.page_id,
      meta_user_id: a.meta_user_id,
      facebook_page_id: a.facebook_page_id ?? null,
    })),
    interpretation:
      analysis.messagingEventCount === 0
        ? "No processable messaging events — Setterix will log 'no envelopes' or skip."
        : analysis.accountMatches.length === 0
          ? "No connected account shares entry.id/recipient.id with this payload — real DMs would be dropped (see logs: no meta_accounts row for ids)."
          : "At least one account matches — inbound DMs with text/mid would create or update a conversation.",
  });
}
