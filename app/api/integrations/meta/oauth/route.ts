import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildInstagramAuthorizeUrl } from "@/lib/meta/instagram-oauth";
import {
  buildLoginForBusinessDirectUrl,
  buildMetaAuthorizeUrl,
  buildMetaBusinessLoginPageUrl,
  getMetaOAuthRedirectUri,
} from "@/lib/meta/oauth";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const COOKIE_FLOW = "meta_oauth_flow";
const FLOW_FB = "facebook_graph";
const FLOW_IG_NATIVE = "instagram_native";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const locale = reqUrl.searchParams.get("locale") ?? "en";
  const flow = reqUrl.searchParams.get("flow") ?? "native_instagram";
  const useFacebookLogin = flow === "facebook";
  const useNativeInstagram = flow === "native_instagram";
  /** Login for Business + config_id (`flow=instagram` kept for old links). */
  const useBusinessLogin = flow === "business" || flow === "instagram";

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return new NextResponse("Meta app not configured (META_APP_ID / META_APP_SECRET)", {
      status: 503,
    });
  }

  let redirectUri: string;
  try {
    redirectUri = getMetaOAuthRedirectUri();
  } catch {
    return new NextResponse("NEXT_PUBLIC_APP_URL is required", { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(`/${locale}/settings/integrations`);
    return NextResponse.redirect(
      new URL(`/${locale}/login?next=${next}`, reqUrl.origin)
    );
  }

  const { data: orgId } = await supabase.rpc("get_my_org_id");
  if (!orgId) {
    return new NextResponse("No organization", { status: 403 });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };

  cookieStore.set("meta_oauth_state", state, cookieOpts);
  cookieStore.set("meta_oauth_locale", locale, cookieOpts);

  if (useNativeInstagram) {
    cookieStore.set(COOKIE_FLOW, FLOW_IG_NATIVE, cookieOpts);
    const authUrl = buildInstagramAuthorizeUrl({
      clientId: appId,
      redirectUri,
      state,
    });
    return NextResponse.redirect(authUrl);
  }

  if (useFacebookLogin) {
    cookieStore.set(COOKIE_FLOW, FLOW_FB, cookieOpts);
    const authUrl = buildMetaAuthorizeUrl({
      clientId: appId,
      redirectUri,
      state,
    });
    return NextResponse.redirect(authUrl);
  }

  const useScopesOnly =
    process.env.META_OAUTH_INSTAGRAM_VIA_SCOPES?.trim() === "1" ||
    process.env.META_OAUTH_INSTAGRAM_VIA_SCOPES?.trim().toLowerCase() === "true";
  if (useBusinessLogin && useScopesOnly) {
    cookieStore.set(COOKIE_FLOW, FLOW_FB, cookieOpts);
    const authUrl = buildMetaAuthorizeUrl({
      clientId: appId,
      redirectUri,
      state,
    });
    return NextResponse.redirect(authUrl);
  }

  if (useBusinessLogin) {
    cookieStore.set(COOKIE_FLOW, FLOW_FB, cookieOpts);
    const configId = process.env.META_BUSINESS_LOGIN_CONFIG_ID?.trim();
    if (!configId) {
      const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? reqUrl.origin;
      return NextResponse.redirect(
        `${base}/${locale}/settings/integrations?error=missing_business_config`
      );
    }

    const entryParam = reqUrl.searchParams.get("entry");
    const entryEnv = process.env.META_BUSINESS_LOGIN_ENTRY?.trim().toLowerCase();
    const explicitLoginPage =
      entryParam === "loginpage" || entryParam === "instagram";
    const envWantsLoginPage =
      entryEnv === "loginpage" || entryEnv === "instagram";
    const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(
      redirectUri
    );
    const useLoginPage =
      explicitLoginPage || (envWantsLoginPage && !isLocalHttp);

    const authUrl = useLoginPage
      ? buildMetaBusinessLoginPageUrl({
          appId,
          configId,
          redirectUri,
          state,
        })
      : buildLoginForBusinessDirectUrl({
          clientId: appId,
          configId,
          redirectUri,
          state,
        });

    return NextResponse.redirect(authUrl);
  }

  cookieStore.set(COOKIE_FLOW, FLOW_IG_NATIVE, cookieOpts);
  const authUrl = buildInstagramAuthorizeUrl({
    clientId: appId,
    redirectUri,
    state,
  });
  return NextResponse.redirect(authUrl);
}
