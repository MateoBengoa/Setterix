import {
  isSafeMetaNumericId,
  messageMidFromPayload,
  parseMetaWebhookPayload,
  webhookAccountId,
  type WebhookEntry,
  type WebhookMessagingEvent,
} from "@/lib/meta/meta-webhook-payload";

export type StoredMetaAccountIds = {
  id: string;
  page_id: string | null;
  meta_user_id: string | null;
  facebook_page_id?: string | null;
};

export type AnalyzedMessagingEvent = {
  object?: string;
  entryId: string;
  senderId: string;
  recipientId: string;
  mid?: string;
  hasText: boolean;
  isEcho: boolean;
  candidateIdsForLookup: string[];
  /** Same ids filtered to safe numeric strings used in DB queries */
  safeCandidateIds: string[];
  skipReason?: string;
};

function collectEvents(raw: unknown): AnalyzedMessagingEvent[] {
  const out: AnalyzedMessagingEvent[] = [];
  for (const env of parseMetaWebhookPayload(raw)) {
    const objectType = env.object;
    for (const entry of (env.entry ?? []) as WebhookEntry[]) {
      const entryId = webhookAccountId(entry.id);
      const events: WebhookMessagingEvent[] = [
        ...(entry.messaging ?? []),
        ...(entry.standby ?? []),
      ];
      for (const evt of events) {
        const msg = evt.message;
        const mid = msg ? messageMidFromPayload(msg) : undefined;
        const isEcho = Boolean(msg?.is_echo);
        const text =
          msg?.text?.trim() ||
          (Array.isArray(msg?.attachments) && msg!.attachments!.length > 0
            ? "[Attachment]"
            : "");
        const senderId = webhookAccountId(evt.sender?.id);
        const recipientId = webhookAccountId(evt.recipient?.id);
        const candidateIds = Array.from(
          new Set([entryId, recipientId].filter(Boolean))
        );
        const safeCandidateIds = candidateIds.filter(isSafeMetaNumericId);

        let skipReason: string | undefined;
        if (!msg) skipReason = "no_message_object";
        else if (isEcho) skipReason = "is_echo";
        else if (!mid) skipReason = "no_mid";
        else if (!senderId || !text) skipReason = "missing_sender_or_text";

        out.push({
          object: objectType,
          entryId,
          senderId,
          recipientId,
          mid,
          hasText: Boolean(text),
          isEcho,
          candidateIdsForLookup: candidateIds,
          safeCandidateIds,
          skipReason,
        });
      }
    }
  }
  return out;
}

function accountIdSet(a: StoredMetaAccountIds): Set<string> {
  const s = new Set<string>();
  for (const v of [a.page_id, a.meta_user_id, a.facebook_page_id]) {
    if (v && String(v).trim()) s.add(String(v).trim());
  }
  return s;
}

export function analyzeMetaWebhookAgainstAccounts(
  raw: unknown,
  accounts: StoredMetaAccountIds[]
): {
  envelopeCount: number;
  messagingEventCount: number;
  events: AnalyzedMessagingEvent[];
  accountMatches: {
    accountId: string;
    matchedByEventIndex: number[];
    matchedCandidateId: string;
  }[];
  unmatchedEvents: { eventIndex: number; safeCandidateIds: string[] }[];
  notes: string[];
} {
  const envelopes = parseMetaWebhookPayload(raw);
  const events = collectEvents(raw);
  const notes: string[] = [];

  if (envelopes.length === 0) {
    notes.push("Payload did not parse to any webhook envelope (expected {object,entry} or an array of those).");
  }
  if (events.length === 0 && envelopes.length > 0) {
    notes.push(
      "Envelopes present but no messaging/standby events — Meta may have sent a different field (e.g. changes) or an empty entry."
    );
  }

  const accountMatches: {
    accountId: string;
    matchedByEventIndex: number[];
    matchedCandidateId: string;
  }[] = [];

  for (const acc of accounts) {
    const ids = accountIdSet(acc);
    const matchedByEventIndex: number[] = [];
    let matchedCandidateId = "";
    events.forEach((ev, idx) => {
      if (ev.skipReason) return;
      for (const c of ev.safeCandidateIds) {
        if (ids.has(c)) {
          if (!matchedByEventIndex.includes(idx)) matchedByEventIndex.push(idx);
          matchedCandidateId = c;
        }
      }
    });
    if (matchedByEventIndex.length > 0) {
      accountMatches.push({
        accountId: acc.id,
        matchedByEventIndex,
        matchedCandidateId,
      });
    }
  }

  const unmatchedEvents: { eventIndex: number; safeCandidateIds: string[] }[] =
    [];
  events.forEach((ev, idx) => {
    if (ev.skipReason) return;
    const any = ev.safeCandidateIds.some((c) =>
      accounts.some((a) => accountIdSet(a).has(c))
    );
    if (!any) unmatchedEvents.push({ eventIndex: idx, safeCandidateIds: ev.safeCandidateIds });
  });

  if (
    accounts.some((a) => a.page_id && !isSafeMetaNumericId(String(a.page_id)))
  ) {
    notes.push("A stored page_id is not a plain numeric string — lookup may fail.");
  }

  return {
    envelopeCount: envelopes.length,
    messagingEventCount: events.length,
    events,
    accountMatches,
    unmatchedEvents,
    notes,
  };
}
