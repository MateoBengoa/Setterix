import {
  envelopeEntries,
  isSafeMetaNumericId,
  MESSAGE_CHANGE_FIELDS,
  messageMidFromPayload,
  messagingEventsFromEntry,
  parseMetaWebhookPayload,
  webhookAccountId,
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
    for (const entry of envelopeEntries(env)) {
      const entryId = webhookAccountId(entry.id);
      const events = messagingEventsFromEntry(entry);
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

function collectPayloadInspectionNotes(raw: unknown, eventCount: number): string[] {
  if (eventCount > 0) return [];

  const notes: string[] = [];

  for (const env of parseMetaWebhookPayload(raw)) {
    for (const entry of envelopeEntries(env)) {
      const changes = entry.changes ?? [];
      const changeFields = Array.from(
        new Set(
          changes
            .map((c) => (c.field != null ? String(c.field) : ""))
            .filter(Boolean)
        )
      );
      if (changeFields.length > 0) {
        notes.push(
          `This payload has entry.changes fields: ${changeFields.join(", ")}. If messagingEventCount is still 0, Meta may use a nested shape we do not unwrap yet — set META_WEBHOOK_DEBUG=1 on the server and check logs, or paste the same JSON into support.`
        );
      }

      const cfRaw = entry.changed_fields;
      const changedFieldsList = Array.isArray(cfRaw)
        ? cfRaw.map((x) => String(x).toLowerCase())
        : [];

      const mentionsMessages = changedFieldsList.some((f) =>
        Array.from(MESSAGE_CHANGE_FIELDS).some((m) => f === m || f.includes(m))
      );

      const messageChangeMissingValue = changes.some((c) => {
        const f = (c.field ?? "").toLowerCase();
        return MESSAGE_CHANGE_FIELDS.has(f) && c.value == null;
      });

      if (messageChangeMissingValue) {
        notes.push(
          "A messages-related change has no `value` object — in Meta → Webhooks enable including payload values, or copy the raw POST JSON from Recent deliveries (not the short UI preview)."
        );
      }

      if (
        mentionsMessages &&
        changes.length === 0 &&
        (entry.messaging?.length ?? 0) === 0
      ) {
        notes.push(
          "entry.changed_fields references messaging but there is no changes[] or messaging[] — enable \"Include values\" for Webhooks or paste the full delivery body."
        );
      }

      const hasPayloadArrays =
        changes.length > 0 ||
        (entry.messaging?.length ?? 0) > 0 ||
        (entry.standby?.length ?? 0) > 0;

      if (!hasPayloadArrays && webhookAccountId(entry.id)) {
        notes.push(
          "Only entry id/time (no changes/messaging) — that is not a DM body. Open Meta → Webhooks → Recent deliveries → open the POST → copy the full Request body after a real DM (or use Test with full sample)."
        );
      }
    }
  }

  return Array.from(new Set(notes));
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
      "Envelopes present but no processable inbound DM events — comments/mentions/read receipts use other shapes."
    );
  }

  const inspection = collectPayloadInspectionNotes(raw, events.length);
  const allNotes = Array.from(new Set([...notes, ...inspection]));

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
    allNotes.push("A stored page_id is not a plain numeric string — lookup may fail.");
  }

  return {
    envelopeCount: envelopes.length,
    messagingEventCount: events.length,
    events,
    accountMatches,
    unmatchedEvents,
    notes: Array.from(new Set(allNotes)),
  };
}
