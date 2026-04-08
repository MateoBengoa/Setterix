import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForShortLivedUserToken,
  exchangeForLongLivedUserToken,
  fetchPagesWithInstagram,
  getMetaOAuthRedirectUri,
} from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

function settingsRedirect(
  request: Request,
  locale: string,
  query: Record<string, string>
) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  const q = new URLSearchParams(query).toString();
  return NextResponse.redirect(
    `${base}/${locale}/settings/integrations${q ? `?${q}` : ""}`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("meta_oauth_state")?.value;
  const locale = cookieStore.get("meta_oauth_locale")?.value ?? "en";

  cookieStore.delete("meta_oauth_state");
  cookieStore.delete("meta_oauth_locale");

  if (errParam) {
    return settingsRedirect(request, locale, {
      error: "meta_denied",
      detail: errParam.slice(0, 200),
    });
  }

  if (!code || !state || !storedState || state !== storedState) {
    return settingsRedirect(request, locale, { error: "invalid_oauth_state" });
  }

  let redirectUri: string;
  try {
    redirectUri = getMetaOAuthRedirectUri();
  } catch {
    return settingsRedirect(request, locale, { error: "missing_app_url" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return settingsRedirect(request, locale, { error: "not_signed_in" });
  }

  const { data: orgId } = await supabase.rpc("get_my_org_id");
  if (!orgId) {
    return settingsRedirect(request, locale, { error: "no_org" });
  }

  try {
    const short = await exchangeCodeForShortLivedUserToken(code, redirectUri);
    const { accessToken: userToken } = await exchangeForLongLivedUserToken(short);
    const pages = await fetchPagesWithInstagram(userToken);

    if (pages.length === 0) {
      return settingsRedirect(request, locale, {
        error: "no_instagram_linked",
        hint: "Link an Instagram Business account to a Facebook Page, then try again.",
      });
    }

    for (const p of pages) {
      const ig = p.instagram;
      const display = ig.username
        ? `@${ig.username}`
        : ig.name ?? p.pageName;
      const pageIdForWebhook = ig.id;

      const { data: existing } = await supabase
        .from("meta_accounts")
        .select("id")
        .eq("organization_id", orgId)
        .eq("page_id", pageIdForWebhook)
        .eq("platform", "instagram")
        .maybeSingle();

      const row = {
        organization_id: orgId,
        platform: "instagram" as const,
        meta_user_id: ig.id,
        page_id: pageIdForWebhook,
        page_name: display,
        access_token: p.pageAccessToken,
        is_active: true,
      };

      if (existing?.id) {
        const { error: upErr } = await supabase
          .from("meta_accounts")
          .update(row)
          .eq("id", existing.id);
        if (upErr) {
          throw new Error(upErr.message);
        }
      } else {
        const { error: insErr } = await supabase.from("meta_accounts").insert(row);
        if (insErr) {
          throw new Error(insErr.message);
        }
      }
    }

    return settingsRedirect(request, locale, {
      connected: String(pages.length),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return settingsRedirect(request, locale, {
      error: "meta_oauth",
      detail: msg.slice(0, 180),
    });
  }
}
