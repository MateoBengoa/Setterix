export type CalcomBookInput = {
  apiKey: string;
  eventTypeId: string;
  start: string;
  attendeeEmail: string;
  attendeeName?: string;
};

/** Book via Cal.com API v2 — paths depend on your Cal.com version. */
export async function bookCalcomEvent(
  input: CalcomBookInput
): Promise<{ bookingUrl?: string; uid?: string; error?: string }> {
  const res = await fetch("https://api.cal.com/v2/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      eventTypeId: Number(input.eventTypeId),
      start: input.start,
      attendee: {
        email: input.attendeeEmail,
        name: input.attendeeName,
      },
    }),
  });
  const json = (await res.json()) as { data?: { uid?: string; url?: string }; message?: string };
  if (!res.ok) {
    return { error: json.message ?? res.statusText };
  }
  return {
    uid: json.data?.uid,
    bookingUrl: json.data?.url,
  };
}
