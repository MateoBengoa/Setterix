import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { SequencesManager } from "@/components/sequences/sequences-manager";

export default async function SequencesPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: sequences } = await supabase
    .from("sequences")
    .select("*")
    .eq("organization_id", org.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sequences</h1>
      <p className="text-sm text-muted-foreground">
        Hourly processing: schedule a Supabase pg_cron job or Edge Function to
        evaluate triggers (no_reply_1d, no_reply_3d, no_reply_7d, after_post_comment,
        after_story_reply) and enqueue sends with Meta rate limits.
      </p>
      <SequencesManager organizationId={org.id} sequences={sequences ?? []} />
    </div>
  );
}
