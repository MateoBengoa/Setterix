/**
 * Meta may POST a single object or a top-level array of { object, entry } payloads.
 */
export type WebhookEnvelope = {
  object?: string;
  entry?: WebhookEntry[] | WebhookEntry;
};

export type WebhookChange = {
  field?: string;
  value?: unknown;
};

export type WebhookEntry = {
  id?: string | number;
  /** When Meta omits `changes` values, only field names may appear here */
  changed_fields?: string[];
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

/** Meta sometimes sends a single entry object instead of an array. */
export function envelopeEntries(env: WebhookEnvelope): WebhookEntry[] {
  const e = env.entry;
  if (Array.isArray(e)) return e as WebhookEntry[];
  if (e && typeof e === "object") return [e as WebhookEntry];
  return [];
}

/** Instagram / Meta change[].field values that may carry DM-shaped payloads */
export const MESSAGE_CHANGE_FIELDS = new Set([
  "messages",
  "message_echoes",
  "messaging",
]);

/**
 * Turns one `changes[].value` (or nested shapes Meta uses) into 0..n messaging events.
 */
export function eventsFromChangeValue(v: unknown): WebhookMessagingEvent[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.flatMap((item) => eventsFromChangeValue(item));
  }
  if (typeof v !== "object") return [];
  const o = v as Record<string, unknown>;

  if (Array.isArray(o.messaging)) {
    return (o.messaging as WebhookMessagingEvent[]).filter(
      (x) => x && typeof x === "object"
    );
  }
  if (Array.isArray(o.messages)) {
    return (o.messages as unknown[]).flatMap((item) =>
      eventsFromChangeValue(item)
    );
  }

  const hasMsg = o.message != null && typeof o.message === "object";
  if (hasMsg) {
    return [v as WebhookMessagingEvent];
  }
  const hasParticipants = o.sender != null || o.recipient != null;

  const mid = o.mid ?? o.message_id;
  const senderRaw = o.sender_id ?? o.from;
  if (
    (typeof mid === "string" || typeof mid === "number") &&
    (senderRaw != null || o.sender != null)
  ) {
    const sender =
      o.sender != null && typeof o.sender === "object"
        ? (o.sender as WebhookMessagingEvent["sender"])
        : typeof senderRaw === "string" || typeof senderRaw === "number"
          ? { id: senderRaw }
          : undefined;
    return [
      {
        sender,
        recipient:
          o.recipient != null && typeof o.recipient === "object"
            ? (o.recipient as WebhookMessagingEvent["recipient"])
            : undefined,
        message: {
          mid: mid as string | number,
          text: typeof o.text === "string" ? o.text : undefined,
          attachments: Array.isArray(o.attachments)
            ? (o.attachments as unknown[])
            : undefined,
          is_echo: Boolean(o.is_echo),
        },
      },
    ];
  }

  if (
    hasParticipants &&
    typeof o.text === "string" &&
    (typeof mid === "string" ||
      typeof mid === "number" ||
      o.message != null)
  ) {
    return [v as WebhookMessagingEvent];
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
    if (!MESSAGE_CHANGE_FIELDS.has(field)) continue;
    fromChanges.push(...eventsFromChangeValue(ch.value));
  }
  return [...fromArrays, ...fromChanges];
}
