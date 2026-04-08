const GRAPH = "https://graph.facebook.com/v21.0";
const DIALOG = "https://www.facebook.com/v21.0";

/**
 * Scopes for www.facebook.com/dialog/oauth (classic Facebook Login).
 * instagram_business_* is NOT valid on this dialog — Meta ignores/rejects it.
 * Instagram DMs for a Page use the Messenger Platform with a Page token; pages_messaging + pages_show_list + pages_manage_metadata is the usual set.
 * @see https://developers.facebook.com/docs/facebook-login/permissions
 * @see https://developers.facebook.com/docs/messenger-platform/instagram
 */
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
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

/**
 * Facebook Login for Business with config_id — single top-level redirect (no business/loginpage).
 * Uses business.facebook.com (same host as Meta’s inner OAuth URLs) + display=page + ret=login.
 * www.facebook.com/vX/dialog/oauth with config_id can still send some apps through account_switch.
 * Set META_OAUTH_DIALOG_HOST=www to force the versioned www dialog.
 * @see https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
 */
export function buildLoginForBusinessDirectUrl(params: {
  clientId: string;
  configId: string;
  redirectUri: string;
  state: string;
}): string {
  const useWww =
    process.env.META_OAUTH_DIALOG_HOST?.trim().toLowerCase() === "www";
  const endpoint = useWww
    ? `${DIALOG}/dialog/oauth`
    : "https://business.facebook.com/dialog/oauth";
  const u = new URL(endpoint);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("config_id", params.configId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("override_default_response_type", "1");
  u.searchParams.set("state", params.state);
  u.searchParams.set("display", "page");
  u.searchParams.set("ret", "login");
  return u.toString();
}

/**
 * ManyChat-style: business/loginpage with "Log in with Instagram" first.
 * Can fail with account_switch on http://localhost — prefer direct flow for dev.
 */
export function buildMetaBusinessLoginPageUrl(params: {
  appId: string;
  configId: string;
  redirectUri: string;
  state: string;
}): string {
  const dialog = new URL("https://business.facebook.com/dialog/oauth");
  dialog.searchParams.set("client_id", params.appId);
  dialog.searchParams.set("config_id", params.configId);
  dialog.searchParams.set("redirect_uri", params.redirectUri);
  dialog.searchParams.set("response_type", "code");
  dialog.searchParams.set("override_default_response_type", "1");
  dialog.searchParams.set("state", params.state);
  dialog.searchParams.set("display", "page");
  dialog.searchParams.set("ret", "login");

  const page = new URL("https://business.facebook.com/business/loginpage/");
  page.searchParams.set("next", dialog.toString());
  page.searchParams.set("login_options[0]", "IG");
  page.searchParams.set("app", params.appId);
  page.searchParams.set("is_ig_oidc_with_redirect", "1");
  page.searchParams.set("display", "page");
  page.searchParams.set("full_page_redirect_experimental", "1");
  page.searchParams.set("show_back_button", "0");
  return page.toString();
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
