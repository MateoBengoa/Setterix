/**
 * Google Calendar booking — exchange refresh token server-side and create events.
 * Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and stored refresh_token in calendar_config.
 */

export type GoogleCalendarEventInput = {
  accessToken: string;
  summary: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
};

export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<{ id?: string; htmlLink?: string; error?: string }> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
        attendees: input.attendeeEmail
          ? [{ email: input.attendeeEmail }]
          : undefined,
      }),
    }
  );
  const json = (await res.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
  if (!res.ok) {
    return { error: json.error?.message ?? res.statusText };
  }
  return { id: json.id, htmlLink: json.htmlLink };
}
