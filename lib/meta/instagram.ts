import { withMetaBackoff } from "./backoff";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendInstagramMessage(
  pageAccessToken: string,
  recipientIgsid: string,
  text: string
): Promise<{ message_id?: string; error?: string }> {
  const res = await withMetaBackoff(() =>
    fetch(`${GRAPH}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientIgsid },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: pageAccessToken,
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
