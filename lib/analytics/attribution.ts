import type { SupabaseClient } from "@supabase/supabase-js";

type Counters = Partial<{
  conversations_started: number;
  leads_qualified: number;
  meetings_booked: number;
  revenue_attributed: number;
  messages_sent: number;
  handoffs_to_human: number;
}>;

export async function incrementAnalytics(
  supabase: SupabaseClient,
  organizationId: string,
  deltas: Counters
) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: row } = await supabase
    .from("analytics_daily")
    .select("id, conversations_started, leads_qualified, meetings_booked, revenue_attributed, messages_sent, handoffs_to_human")
    .eq("organization_id", organizationId)
    .eq("date", today)
    .maybeSingle();

  if (!row) {
    await supabase.from("analytics_daily").insert({
      organization_id: organizationId,
      date: today,
      conversations_started: deltas.conversations_started ?? 0,
      leads_qualified: deltas.leads_qualified ?? 0,
      meetings_booked: deltas.meetings_booked ?? 0,
      revenue_attributed: deltas.revenue_attributed ?? 0,
      messages_sent: deltas.messages_sent ?? 0,
      handoffs_to_human: deltas.handoffs_to_human ?? 0,
    });
    return;
  }

  await supabase
    .from("analytics_daily")
    .update({
      conversations_started:
        row.conversations_started + (deltas.conversations_started ?? 0),
      leads_qualified: row.leads_qualified + (deltas.leads_qualified ?? 0),
      meetings_booked: row.meetings_booked + (deltas.meetings_booked ?? 0),
      revenue_attributed: Number(row.revenue_attributed) + (deltas.revenue_attributed ?? 0),
      messages_sent: row.messages_sent + (deltas.messages_sent ?? 0),
      handoffs_to_human: row.handoffs_to_human + (deltas.handoffs_to_human ?? 0),
    })
    .eq("id", row.id);
}

export async function rollupMeetingRevenue(
  supabase: SupabaseClient,
  organizationId: string,
  amount: number
) {
  await incrementAnalytics(supabase, organizationId, {
    meetings_booked: 1,
    revenue_attributed: amount,
  });
}
