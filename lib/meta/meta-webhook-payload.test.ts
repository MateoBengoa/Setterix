import { describe, expect, it } from "vitest";
import {
  isSafeMetaNumericId,
  messageMidFromPayload,
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

describe("messageMidFromPayload", () => {
  it("prefers mid over message_id", () => {
    expect(
      messageMidFromPayload({ mid: "a", message_id: "b" })
    ).toBe("a");
  });

  it("falls back to message_id", () => {
    expect(messageMidFromPayload({ message_id: "x" })).toBe("x");
  });
});
