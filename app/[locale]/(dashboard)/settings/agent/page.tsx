import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { AgentConfigForm } from "@/components/agent/agent-config-form";

export default async function AgentSettingsPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();

  const [{ data: config }, { data: { user } }, { data: metaAccounts }] = await Promise.all([
    supabase.from("agent_configs").select("*").eq("organization_id", org.id).maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("meta_accounts")
      .select("page_name, meta_user_id, platform, oauth_provider")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .limit(1),
  ]);

  const meta = metaAccounts?.[0];
  const userProfile = {
    email: user?.email ?? null,
    name:
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      null,
    // Instagram connected account display name / username
    igName: meta?.page_name ?? null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Agente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurá la identidad, voz y comportamiento de tu asistente.
        </p>
      </div>
      <AgentConfigForm
        initial={config}
        organizationId={org.id}
        plan={org.plan}
        userProfile={userProfile}
      />
    </div>
  );
}
