/**
 * Meta may POST a single object or a top-level array of { object, entry } payloads.
 */
export type WebhookEnvelope = {
  object?: string;
  entry?: WebhookEntry[];
};

export type WebhookEntry = {
  id?: string | number;
  /** Primary DM channel */
  messaging?: WebhookMessagingEvent[];
  /** Handover / secondary app — same shape as messaging */
  standby?: WebhookMessagingEvent[];
};

export type WebhookMessagingEvent = {
  sender?: { id?: string | number };
  recipient?: { id?: string | number };
  message?: {
    mid?: string;
    /** Some payloads use message_id instead of mid */
    message_id?: string;
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
  mid?: string;
  message_id?: string;
}): string | undefined {
  const m = msg.mid ?? msg.message_id;
  return typeof m === "string" && m.length > 0 ? m : undefined;
}
