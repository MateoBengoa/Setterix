import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookCalcomEvent } from "@/lib/calendar/calcom";
import { createGoogleCalendarEvent } from "@/lib/calendar/google";
import { rollupMeetingRevenue } from "@/lib/analytics/attribution";

export const dynamic = "force-dynamic";

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

  let body: {
    conversationId?: string;
    leadId?: string;
    start?: string;
    attendeeEmail?: string;
    revenueAttributed?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { data: config } = await supabase
    .from("agent_configs")
    .select("calendar_provider, calendar_config, booking_enabled")
    .eq("organization_id", orgId)
    .single();

  if (!config?.booking_enabled) {
    return NextResponse.json({ error: "booking_disabled" }, { status: 400 });
  }

  const start = body.start ?? new Date().toISOString();
  const end = new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString();
  let calendarEventId: string | null = null;
  let bookingUrl: string | null = null;

  const calCfg = (config.calendar_config ?? {}) as Record<string, string>;

  if (config.calendar_provider === "cal_com") {
    const r = await bookCalcomEvent({
      apiKey: calCfg.api_key ?? process.env.CALCOM_API_KEY ?? "",
      eventTypeId: calCfg.event_type_id ?? "",
      start,
      attendeeEmail: body.attendeeEmail ?? user.email ?? "unknown@example.com",
    });
    if (r.error) {
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
    calendarEventId = r.uid ?? null;
    bookingUrl = r.bookingUrl ?? null;
  } else if (config.calendar_provider === "google_calendar") {
    const r = await createGoogleCalendarEvent({
      accessToken: calCfg.access_token ?? "",
      summary: "Sales call",
      startIso: start,
      endIso: end,
      attendeeEmail: body.attendeeEmail,
    });
    if (r.error) {
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
    calendarEventId = r.id ?? null;
    bookingUrl = r.htmlLink ?? null;
  } else {
    return NextResponse.json({ error: "no_calendar" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("meetings").insert({
    organization_id: orgId,
    lead_id: body.leadId ?? null,
    conversation_id: body.conversationId ?? null,
    calendar_event_id: calendarEventId,
    booking_url: bookingUrl,
    scheduled_at: start,
    status: "scheduled",
    revenue_attributed: body.revenueAttributed ?? null,
  });

  if (body.leadId) {
    await supabase
      .from("leads")
      .update({ status: "booked", updated_at: new Date().toISOString() })
      .eq("id", body.leadId);
  }

  await rollupMeetingRevenue(
    admin,
    orgId,
    Number(body.revenueAttributed ?? 0)
  );

  return NextResponse.json({ ok: true, calendarEventId, bookingUrl });
}
