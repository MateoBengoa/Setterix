import { describe, expect, it } from "vitest";
import {
  envelopeEntries,
  eventsFromChangeValue,
  isSafeMetaNumericId,
  messageMidFromPayload,
  messagingEventsFromEntry,
  parseMetaWebhookPayload,
  webhookAccountId,
} from "./meta-webhook-payload";

describe("parseMetaWebhookPayload", () => {
  it("wraps a single envelope object", () => {
    const raw = { object: "instagram", entry: [] };
    expect(parseMetaWebhookPayload(raw)).toEqual([raw]);
  });

  it("passes through an array of envelopes", () => {
    const a = { object: "instagram", entry: [{ id: "1" }] };
    const b = { object: "page", entry: [] };
    expect(parseMetaWebhookPayload([a, b])).toEqual([a, b]);
  });

  it("filters non-objects from array", () => {
    const a = { object: "instagram", entry: [] };
    expect(parseMetaWebhookPayload([null, a, 3])).toEqual([a]);
  });

  it("returns empty for primitives", () => {
    expect(parseMetaWebhookPayload(null)).toEqual([]);
    expect(parseMetaWebhookPayload("x")).toEqual([]);
  });
});

describe("webhookAccountId", () => {
  it("stringifies safe integers", () => {
    expect(webhookAccountId(12345678901234)).toBe("12345678901234");
  });
});

describe("isSafeMetaNumericId", () => {
  it("accepts typical Meta numeric strings", () => {
    expect(isSafeMetaNumericId("17841400008460056")).toBe(true);
    expect(isSafeMetaNumericId("12345")).toBe(true);
  });

  it("rejects short or non-numeric ids", () => {
    expect(isSafeMetaNumericId("1234")).toBe(false);
    expect(isSafeMetaNumericId("12a34")).toBe(false);
    expect(isSafeMetaNumericId("")).toBe(false);
  });
});

describe("envelopeEntries", () => {
  it("normalizes a single entry object into an array", () => {
    const env = {
      object: "instagram",
      entry: { id: "1", messaging: [] },
    };
    expect(envelopeEntries(env)).toHaveLength(1);
    expect(envelopeEntries(env)[0].id).toBe("1");
  });
});

describe("eventsFromChangeValue", () => {
  it("unwraps value.messages[]", () => {
    const ev = eventsFromChangeValue({
      messages: [
        {
          sender: { id: "1" },
          recipient: { id: "2" },
          message: { mid: "x", text: "hi" },
        },
      ],
    });
    expect(ev).toHaveLength(1);
    expect(ev[0].message?.text).toBe("hi");
  });
});

describe("messagingEventsFromEntry", () => {
  it("merges messaging, standby, and Instagram changes.messages", () => {
    const entry = {
      id: "27389733270613577",
      messaging: [{ sender: { id: "1" }, message: { mid: "a", text: "x" } }],
      changes: [
        {
          field: "messages",
          value: {
            sender: { id: "2" },
            recipient: { id: "27389733270613577" },
            message: { mid: "b", text: "from changes" },
          },
        },
        { field: "comments", value: { id: "ignore" } },
      ],
    };
    const ev = messagingEventsFromEntry(entry);
    expect(ev).toHaveLength(2);
    expect(ev[1].message?.text).toBe("from changes");
  });
});

describe("messageMidFromPayload", () => {
  it("prefers mid over message_id", () => {
    expect(
      messageMidFromPayload({ mid: "a", message_id: "b" })
    ).toBe("a");
  });

  it("falls back to message_id", () => {
    expect(messageMidFromPayload({ message_id: "x" })).toBe("x");
  });

  it("coerces numeric mid", () => {
    expect(messageMidFromPayload({ mid: 12345 })).toBe("12345");
  });
});
