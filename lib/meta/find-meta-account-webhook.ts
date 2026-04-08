import type { SupabaseClient } from "@supabase/supabase-js";
import { isSafeMetaNumericId } from "@/lib/meta/meta-webhook-payload";

/**
 * Looks up meta_accounts by webhook id candidates.
 * Queries page_id / meta_user_id first, then facebook_page_id separately so a missing
 * DB column (migration not applied) does not break the whole lookup.
 */
export async function findMetaAccountByWebhookIds(
  supabase: SupabaseClient,
  candidateIds: string[]
): Promise<{ id: string; organization_id: string } | null> {
  for (const pid of candidateIds) {
    if (!isSafeMetaNumericId(pid)) continue;

    const { data: byIg, error: errIg } = await supabase
      .from("meta_accounts")
      .select("id, organization_id")
      .eq("is_active", true)
      .or(`page_id.eq.${pid},meta_user_id.eq.${pid}`)
      .limit(1);

    if (errIg) {
      console.error("[meta-webhook] meta_accounts ig lookup", errIg.message);
    } else if (byIg?.[0]) {
      return byIg[0];
    }

    const { data: byPage, error: errPage } = await supabase
      .from("meta_accounts")
      .select("id, organization_id")
      .eq("is_active", true)
      .eq("facebook_page_id", pid)
      .limit(1);

    if (errPage) {
      if (
        errPage.message.includes("facebook_page_id") ||
        errPage.message.includes("column") ||
        errPage.code === "42703"
      ) {
        continue;
      }
      console.error("[meta-webhook] meta_accounts page lookup", errPage.message);
      continue;
    }
    if (byPage?.[0]) return byPage[0];
  }
  return null;
}
