import { withMetaBackoff } from "./backoff";

const FB_GRAPH = "https://graph.facebook.com/v21.0";
const IG_GRAPH = "https://graph.instagram.com/v21.0";

/**
 * Instagram DMs: Instagram Login uses graph.instagram.com + Bearer token;
 * Facebook Login uses a Page access token on graph.facebook.com/me/messages.
 */
export async function sendInstagramMessage(
  accessToken: string,
  igAccountId: string | null | undefined,
  recipientIgsid: string,
  text: string,
  oauthProvider?: string | null
): Promise<{ message_id?: string; error?: string }> {
  if (oauthProvider === "instagram" && igAccountId) {
    const res = await withMetaBackoff(() =>
      fetch(`${IG_GRAPH}/${igAccountId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientIgsid },
          message: { text },
        }),
      })
    );
    const json = (await res.json()) as {
      message_id?: string;
      error?: { message: string };
    };
    if (!res.ok) {
      return { error: json.error?.message ?? res.statusText };
    }
    return { message_id: json.message_id };
  }

  const res = await withMetaBackoff(() =>
    fetch(`${FB_GRAPH}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientIgsid },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: accessToken,
      }),
    })
  );
  const json = (await res.json()) as {
    message_id?: string;
    error?: { message: string };
  };
  if (!res.ok) {
    return { error: json.error?.message ?? res.statusText };
  }
  return { message_id: json.message_id };
}
