import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedMetaAccount = {
  id: string;
  platform: string;
  access_token: string;
  page_id: string | null;
  oauth_provider: string | null;
};

/**
 * Prefer the Meta row linked on the lead (webhook sets meta_account_id).
 * Fallback: first active Instagram account for the org (single-tenant setups).
 */
export async function resolveMetaAccountForLead(
  supabase: SupabaseClient,
  organizationId: string,
  leadMetaAccountId: string | null | undefined
): Promise<ResolvedMetaAccount | null> {
  if (leadMetaAccountId) {
    const { data } = await supabase
      .from("meta_accounts")
      .select("id, platform, access_token, page_id, oauth_provider")
      .eq("id", leadMetaAccountId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.access_token) {
      return data as ResolvedMetaAccount;
    }
  }

  const { data: ig } = await supabase
    .from("meta_accounts")
    .select("id, platform, access_token, page_id, oauth_provider")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("platform", "instagram")
    .limit(1)
    .maybeSingle();

  if (ig?.access_token) {
    return ig as ResolvedMetaAccount;
  }

  const { data: anyAcc } = await supabase
    .from("meta_accounts")
    .select("id, platform, access_token, page_id, oauth_provider")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return anyAcc?.access_token ? (anyAcc as ResolvedMetaAccount) : null;
}

/** Campaigns / org-level sends: prefer Instagram, then any active account. */
export async function resolveMetaAccountForOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ResolvedMetaAccount | null> {
  const { data: ig } = await supabase
    .from("meta_accounts")
    .select("id, platform, access_token, page_id, oauth_provider")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("platform", "instagram")
    .limit(1)
    .maybeSingle();

  if (ig?.access_token) {
    return ig as ResolvedMetaAccount;
  }

  const { data: anyAcc } = await supabase
    .from("meta_accounts")
    .select("id, platform, access_token, page_id, oauth_provider")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return anyAcc?.access_token ? (anyAcc as ResolvedMetaAccount) : null;
}
