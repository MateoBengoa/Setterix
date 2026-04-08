/**
 * Meta may POST a single object or a top-level array of { object, entry } payloads.
 */
export type WebhookEnvelope = {
  object?: string;
  entry?: WebhookEntry[];
};

export type WebhookEntry = {
  id?: string | number;
  messaging?: WebhookMessagingEvent[];
};

export type WebhookMessagingEvent = {
  sender?: { id?: string | number };
  recipient?: { id?: string | number };
  message?: {
    mid?: string;
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

/** PostgREST .or() filter: only allow numeric Meta ids (no commas/quotes). */
export function isSafeMetaNumericId(s: string): boolean {
  return /^\d{3,32}$/.test(s);
}
