import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  owner_id: string | null;
  trial_ends_at: string | null;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
};

export async function getOrganizationForUser(): Promise<Organization | null> {
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("get_my_org_id");
  if (error || orgId == null) return null;
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, plan, owner_id, trial_ends_at, dodo_customer_id, dodo_subscription_id"
    )
    .eq("id", orgId)
    .single();
  return org as Organization | null;
}
