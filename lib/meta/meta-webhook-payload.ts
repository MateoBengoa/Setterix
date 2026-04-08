/**
 * Meta may POST a single object or a top-level array of { object, entry } payloads.
 */
export type WebhookEnvelope = {
  object?: string;
  entry?: WebhookEntry[];
};

export type WebhookChange = {
  field?: string;
  value?: unknown;
};

export type WebhookEntry = {
  id?: string | number;
  /** Messenger Platform / some configs — DM events here */
  messaging?: WebhookMessagingEvent[];
  /** Handover / secondary app — same shape as messaging */
  standby?: WebhookMessagingEvent[];
  /**
   * Instagram Graph API (Instagram Login + subscribed_apps): Meta sends DM
   * notifications under changes[].field === "messages", not entry.messaging[].
   * @see https://developers.facebook.com/docs/instagram-platform/webhooks/examples/
   */
  changes?: WebhookChange[];
};

export type WebhookMessagingEvent = {
  sender?: { id?: string | number };
  recipient?: { id?: string | number };
  message?: {
    mid?: string | number;
    /** Some payloads use message_id instead of mid */
    message_id?: string | number;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
};

export function parseMetaWebhookPayload(raw: unknown): WebhookEnvelope[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is WebhookEnvelope => Boolean(x && typeof x === "object"));
  }
  if (raw && typeof raw === "object") {
    return [raw as WebhookEnvelope];
  }
  return [];
}

export function webhookAccountId(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

/** PostgREST filter value: Meta user/page ids are numeric strings (often 15–17 digits, sometimes longer). */
export function isSafeMetaNumericId(s: string): boolean {
  return /^\d{5,40}$/.test(s);
}

export function messageMidFromPayload(msg: {
  mid?: string | number;
  message_id?: string | number;
}): string | undefined {
  const m = msg.mid ?? msg.message_id;
  if (m === undefined || m === null) return undefined;
  if (typeof m === "number" && Number.isFinite(m)) return String(m);
  if (typeof m === "string" && m.length > 0) return m;
  return undefined;
}

/**
 * Collects messaging-shaped events from entry.messaging, entry.standby, and
 * Instagram Platform entry.changes (messages / message_echoes).
 */
export function messagingEventsFromEntry(entry: WebhookEntry): WebhookMessagingEvent[] {
  const fromArrays: WebhookMessagingEvent[] = [
    ...(entry.messaging ?? []),
    ...(entry.standby ?? []),
  ];
  const fromChanges: WebhookMessagingEvent[] = [];
  for (const ch of entry.changes ?? []) {
    const field = (ch.field ?? "").toLowerCase();
    if (field !== "messages" && field !== "message_echoes") continue;
    const v = ch.value;
    if (!v || typeof v !== "object") continue;
    fromChanges.push(v as WebhookMessagingEvent);
  }
  return [...fromArrays, ...fromChanges];
}
