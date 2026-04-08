/**
 * Instagram API with Instagram Login — pantalla de login de Instagram (no Facebook).
 * @see https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/
 */
const IG_AUTHORIZE = "https://api.instagram.com/oauth/authorize";
const IG_ACCESS_TOKEN = "https://api.instagram.com/oauth/access_token";

export const INSTAGRAM_NATIVE_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
].join(",");

export function buildInstagramAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(IG_AUTHORIZE);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("scope", INSTAGRAM_NATIVE_OAUTH_SCOPES);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", params.state);
  return u.toString();
}

export async function exchangeInstagramCodeForShortLivedToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; userId?: string }> {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(IG_ACCESS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    user_id?: string | number;
    data?: Array<{ access_token?: string; user_id?: string | number }>;
    error_type?: string;
    error_message?: string;
  };
  const token =
    json.access_token ?? json.data?.[0]?.access_token;
  const userIdRaw = json.user_id ?? json.data?.[0]?.user_id;
  if (!res.ok || !token) {
    throw new Error(
      json.error_message ??
        json.error_type ??
        "Instagram token exchange failed"
    );
  }
  const userId =
    userIdRaw !== undefined ? String(userIdRaw) : undefined;
  return { accessToken: token, userId };
}

export async function exchangeInstagramForLongLivedToken(
  shortLivedUserToken: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const u = new URL("https://graph.instagram.com/access_token");
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  u.searchParams.set("access_token", shortLivedUserToken);
  const res = await fetch(u.toString());
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error?.message ?? "Instagram long-lived token exchange failed"
    );
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

const IG_GRAPH = "https://graph.instagram.com/v21.0";

export async function fetchInstagramMe(accessToken: string): Promise<{
  id: string;
  username?: string;
  name?: string;
}> {
  const u = new URL(`${IG_GRAPH}/me`);
  u.searchParams.set("fields", "id,username,name");
  u.searchParams.set("access_token", accessToken);
  const res = await fetch(u.toString());
  const json = (await res.json()) as {
    id?: string;
    username?: string;
    name?: string;
    error?: { message: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message ?? "Failed to load Instagram profile");
  }
  return { id: json.id, username: json.username, name: json.name };
}
