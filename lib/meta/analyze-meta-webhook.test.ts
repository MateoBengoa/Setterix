import { describe, expect, it } from "vitest";
import { analyzeMetaWebhookAgainstAccounts } from "./analyze-meta-webhook";

const sampleInstagramDm = {
  object: "instagram",
  entry: [
    {
      id: "17841400008460056",
      messaging: [
        {
          sender: { id: "9876543210987654" },
          recipient: { id: "17841400008460056" },
          message: {
            mid: "m_test_mid",
            text: "Hola",
          },
        },
      ],
    },
  ],
};

describe("analyzeMetaWebhookAgainstAccounts", () => {
  it("matches when page_id equals entry.id", () => {
    const r = analyzeMetaWebhookAgainstAccounts(sampleInstagramDm, [
      {
        id: "acc-1",
        page_id: "17841400008460056",
        meta_user_id: "17841400008460056",
      },
    ]);
    expect(r.envelopeCount).toBe(1);
    expect(r.messagingEventCount).toBe(1);
    expect(r.accountMatches).toHaveLength(1);
    expect(r.accountMatches[0].accountId).toBe("acc-1");
    expect(r.unmatchedEvents).toHaveLength(0);
  });

  it("matches facebook_page_id when Meta sends Page id as entry id", () => {
    const pagePayload = {
      object: "page",
      entry: [
        {
          id: "112233445566778",
          messaging: [
            {
              sender: { id: "9876543210987654" },
              recipient: { id: "112233445566778" },
              message: { mid: "m_page", text: "Hi" },
            },
          ],
        },
      ],
    };
    const r = analyzeMetaWebhookAgainstAccounts(pagePayload, [
      {
        id: "acc-2",
        page_id: "17841400008460056",
        meta_user_id: "17841400008460056",
        facebook_page_id: "112233445566778",
      },
    ]);
    expect(r.accountMatches).toHaveLength(1);
  });

  it("reports unmatched when stored ids differ from webhook", () => {
    const r = analyzeMetaWebhookAgainstAccounts(sampleInstagramDm, [
      {
        id: "wrong",
        page_id: "111111111111111",
        meta_user_id: "111111111111111",
      },
    ]);
    expect(r.accountMatches).toHaveLength(0);
    expect(r.unmatchedEvents.length).toBeGreaterThan(0);
  });

  it("matches Instagram Platform payload with entry.changes (not messaging[])", () => {
    const igChangesPayload = {
      object: "instagram",
      entry: [
        {
          id: "27389733270613577",
          time: 1744813777,
          changes: [
            {
              field: "messages",
              value: {
                sender: { id: "9876543210987654" },
                recipient: { id: "27389733270613577" },
                timestamp: 1527459824,
                message: { mid: "mid_from_changes", text: "Hola desde IG" },
              },
            },
          ],
        },
      ],
    };
    const r = analyzeMetaWebhookAgainstAccounts(igChangesPayload, [
      {
        id: "acc-ig",
        page_id: "27389733270613577",
        meta_user_id: "27389733270613577",
      },
    ]);
    expect(r.messagingEventCount).toBe(1);
    expect(r.accountMatches).toHaveLength(1);
    expect(r.unmatchedEvents).toHaveLength(0);
  });

  it("marks echo messages with skipReason", () => {
    const echo = {
      object: "instagram",
      entry: [
        {
          id: "17841400008460056",
          messaging: [
            {
              sender: { id: "17841400008460056" },
              recipient: { id: "9876543210987654" },
              message: { mid: "m_echo", text: "out", is_echo: true },
            },
          ],
        },
      ],
    };
    const r = analyzeMetaWebhookAgainstAccounts(echo, [
      {
        id: "acc",
        page_id: "17841400008460056",
        meta_user_id: "17841400008460056",
      },
    ]);
    expect(r.events[0].skipReason).toBe("is_echo");
  });
});
