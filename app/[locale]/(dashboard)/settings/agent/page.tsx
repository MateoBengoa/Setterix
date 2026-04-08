import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { AgentConfigForm } from "@/components/agent/agent-config-form";

export default async function AgentSettingsPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("organization_id", org.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Agent</h1>
      <AgentConfigForm initial={config} organizationId={org.id} plan={org.plan} />
    </div>
  );
}
