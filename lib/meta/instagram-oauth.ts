/**
 * Instagram API with Instagram Login — pantalla de login de Instagram (no Facebook).
 * @see https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/
 *
 * Credenciales: por defecto META_APP_ID / META_APP_SECRET.
 * Si Meta te da un ID/secreto solo para Instagram distintos, usa META_IG_APP_ID / META_IG_APP_SECRET.
 */
export function instagramOAuthClientId(fallbackFacebookAppId: string): string {
  const v = process.env.META_IG_APP_ID?.trim();
  return v || fallbackFacebookAppId;
}

function instagramOAuthClientSecret(): string {
  const v = process.env.META_IG_APP_SECRET?.trim();
  return v || process.env.META_APP_SECRET || "";
}

/** Misma URL que muestra el panel de Meta (“URL de inserción”). */
const IG_AUTHORIZE = "https://www.instagram.com/oauth/authorize";
const IG_ACCESS_TOKEN = "https://api.instagram.com/oauth/access_token";

/** Scopes por defecto alineados con la URL de inserción de Instagram Business Login. */
export const INSTAGRAM_NATIVE_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

function instagramOAuthScopes(): string {
  const fromEnv = process.env.META_INSTAGRAM_OAUTH_SCOPES?.trim();
  return fromEnv || INSTAGRAM_NATIVE_OAUTH_SCOPES;
}

export function buildInstagramAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(IG_AUTHORIZE);
  u.searchParams.set("force_reauth", "true");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", instagramOAuthScopes());
  u.searchParams.set("state", params.state);
  return u.toString();
}

export async function exchangeInstagramCodeForShortLivedToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; userId?: string }> {
  const body = new URLSearchParams({
    client_id: instagramOAuthClientId(process.env.META_APP_ID || ""),
    client_secret: instagramOAuthClientSecret(),
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
  u.searchParams.set("client_secret", instagramOAuthClientSecret());
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

/**
 * Instagram Login: `id` on /me can be app-scoped; webhooks use the professional
 * account id (often in `user_id`). We prefer `user_id` for DB rows so lookup matches
 * entry.id / recipient.id in POST payloads.
 * @see https://stackoverflow.com/questions/79319817/mismatch-between-ids-in-instagram-webhooks-and-graph-api
 */
export async function fetchInstagramMe(accessToken: string): Promise<{
  id: string;
  username?: string;
  name?: string;
  /** Present when Meta returned both — same as `id` when we prefer user_id */
  appScopedId?: string;
}> {
  async function fetchFields(
    fields: string
  ): Promise<{
    id?: string;
    user_id?: string | number;
    username?: string;
    name?: string;
    error?: { message: string };
  }> {
    const u = new URL(`${IG_GRAPH}/me`);
    u.searchParams.set("fields", fields);
    u.searchParams.set("access_token", accessToken);
    const res = await fetch(u.toString());
    return (await res.json()) as {
      id?: string;
      user_id?: string | number;
      username?: string;
      name?: string;
      error?: { message: string };
    };
  }

  let json = await fetchFields("id,user_id,username,name");
  if (
    !json.id &&
    json.error?.message &&
    (json.error.message.includes("user_id") ||
      json.error.message.includes("(#100)"))
  ) {
    json = await fetchFields("id,username,name");
  }

  if (!json.id) {
    throw new Error(json.error?.message ?? "Failed to load Instagram profile");
  }

  const userIdRaw = json.user_id;
  const professionalId =
    userIdRaw !== undefined && userIdRaw !== null && String(userIdRaw).trim()
      ? String(userIdRaw)
      : json.id;

  return {
    id: professionalId,
    username: json.username,
    name: json.name,
    appScopedId: professionalId !== json.id ? json.id : undefined,
  };
}
