import { withMetaBackoff } from "./backoff";

const FB_GRAPH = "https://graph.facebook.com/v21.0";
const IG_GRAPH = "https://graph.instagram.com/v21.0";

export type MetaUserProfile = {
  name?: string;
  username?: string;
  profile_picture_url?: string;
};

/**
 * Fetches name, username and profile pic for a sender IGSID or PSID.
 * Returns partial data — callers should handle missing fields gracefully.
 */
export async function fetchMetaUserProfile(
  accessToken: string,
  userId: string,
  oauthProvider?: string | null
): Promise<MetaUserProfile> {
  try {
    if (oauthProvider === "instagram") {
      const u = new URL(`${IG_GRAPH}/${userId}`);
      u.searchParams.set("fields", "name,username,profile_pic");
      const res = await fetch(u.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return {};
      const json = (await res.json()) as {
        name?: string;
        username?: string;
        profile_pic?: string;
      };
      return {
        name: json.name,
        username: json.username,
        profile_picture_url: json.profile_pic,
      };
    }

    // Facebook Messenger / Facebook OAuth
    const u = new URL(`${FB_GRAPH}/${userId}`);
    u.searchParams.set("fields", "name,profile_pic");
    u.searchParams.set("access_token", accessToken);
    const res = await fetch(u.toString());
    if (!res.ok) return {};
    const json = (await res.json()) as { name?: string; profile_pic?: string };
    return {
      name: json.name,
      profile_picture_url: json.profile_pic,
    };
  } catch {
    return {};
  }
}

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
