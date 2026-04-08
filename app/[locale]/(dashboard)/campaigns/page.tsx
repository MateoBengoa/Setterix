import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";

export default async function CampaignsPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <CampaignBuilder organizationId={org.id} campaigns={campaigns ?? []} />
    </div>
  );
}
