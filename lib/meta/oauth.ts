const GRAPH = "https://graph.facebook.com/v21.0";
const DIALOG = "https://www.facebook.com/v21.0";

/**
 * Scopes for Facebook Login + Instagram Professional (Messaging).
 * Legacy names (instagram_basic, instagram_manage_messages, pages_read_engagement)
 * are rejected by the Login dialog as of 2025 — use instagram_business_* instead.
 * @see https://developers.facebook.com/docs/permissions/reference
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "business_management",
].join(",");

export function getMetaOAuthRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for Meta OAuth");
  }
  return `${base}/api/integrations/meta/callback`;
}

export function buildMetaAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(`${DIALOG}/dialog/oauth`);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  u.searchParams.set("scope", META_OAUTH_SCOPES);
  u.searchParams.set("response_type", "code");
  return u.toString();
}

export async function exchangeCodeForShortLivedUserToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const qp = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${qp.toString()}`);
  const json = (await res.json()) as { access_token?: string; error?: { message: string } };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? "Meta token exchange failed");
  }
  return json.access_token;
}

export async function exchangeForLongLivedUserToken(
  shortLivedUserToken: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const qp = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedUserToken,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${qp.toString()}`);
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? "Meta long-lived token failed");
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

export type PageWithInstagram = {
  facebookPageId: string;
  pageName: string;
  pageAccessToken: string;
  instagram: { id: string; username?: string; name?: string };
};

export async function fetchPagesWithInstagram(
  userAccessToken: string
): Promise<PageWithInstagram[]> {
  const fields = encodeURIComponent(
    "name,access_token,instagram_business_account{id,username,name}"
  );
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=${fields}&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string; name?: string };
    }>;
    error?: { message: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? "Failed to load Facebook Pages");
  }
  const out: PageWithInstagram[] = [];
  for (const row of json.data ?? []) {
    const ig = row.instagram_business_account;
    if (!ig?.id) continue;
    out.push({
      facebookPageId: row.id,
      pageName: row.name,
      pageAccessToken: row.access_token,
      instagram: ig,
    });
  }
  return out;
}
