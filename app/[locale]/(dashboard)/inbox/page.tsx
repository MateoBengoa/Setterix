import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/org";
import { InboxView } from "@/components/inbox/inbox-view";

export default async function InboxPage() {
  await getTranslations("inbox");
  const org = await getOrganizationForUser();
  if (!org) return null;

  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, is_ai_active, last_message_at, lead_id, leads ( name, username, status, qualification_data, estimated_value, notes )"
    )
    .eq("organization_id", org.id)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  return (
    <div className="space-y-4">
      <InboxView initialConversations={(conversations ?? []) as never} />
    </div>
  );
}
