import { getLocale, getTranslations } from "next-intl/server";
import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { IntegrationsForm } from "@/components/settings/integrations-form";

type MetaAccountRow = {
  platform: string | null;
  page_id: string | null;
  page_name: string | null;
};

function formatInstagramAccountLabel(a: MetaAccountRow): string {
  const name = a.page_name?.trim();
  const id = a.page_id?.trim();
  if (name && id) return `${name} (${id})`;
  return name || id || "—";
}

function oauthFlashFromParams(
  searchParams: Record<string, string | string[] | undefined>,
  t: Awaited<ReturnType<typeof getTranslations>>,
  accounts: MetaAccountRow[]
): { variant: "success" | "error"; message: string } | null {
  const connected = searchParams.connected;
  if (typeof connected === "string" && connected !== "") {
    const instagramRows = accounts.filter((a) => a.platform === "instagram");
    const labels = instagramRows.map(formatInstagramAccountLabel);
    if (labels.length > 0) {
      return {
        variant: "success",
        message: t("oauthConnectedNames", { names: labels.join(" · ") }),
      };
    }
    return {
      variant: "success",
      message: t("oauthConnected", { count: connected }),
    };
  }
  const err = searchParams.error;
  if (typeof err !== "string") return null;
  if (err === "missing_business_config") {
    return { variant: "error", message: t("errorMissingBusinessConfig") };
  }
  if (err === "instagram_native_app") {
    const d = typeof searchParams.detail === "string" ? searchParams.detail : "";
    return {
      variant: "error",
      message: d ? `${t("errorInstagramNativeApp")} ${d}` : t("errorInstagramNativeApp"),
    };
  }
  const detail =
    typeof searchParams.detail === "string" ? searchParams.detail : "";
  const hint = typeof searchParams.hint === "string" ? searchParams.hint : "";

  const keyMap: Record<string, string> = {
    invalid_oauth_state: "errorInvalidState",
    not_signed_in: "errorNotSignedIn",
    no_org: "errorNoOrg",
    no_instagram_linked: "errorNoInstagram",
    meta_denied: "errorDenied",
    missing_app_url: "errorMissingAppUrl",
    meta_oauth: "errorGeneric",
  };
  const msgKey = keyMap[err] ?? "errorGeneric";
  let message = t(msgKey);
  if (err === "meta_oauth" && detail) {
    message = `${message} ${detail}`;
  }
  if (err === "meta_denied" && detail) {
    message = `${t("errorDenied")} (${detail})`;
  }
  if (err === "no_instagram_linked" && hint) {
    message = `${message} ${hint}`;
  }
  return { variant: "error", message };
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("meta_accounts")
    .select("*")
    .eq("organization_id", org.id);

  const accountRows = (accounts ?? []) as MetaAccountRow[];
  const locale = await getLocale();
  const t = await getTranslations("settings.integrations");
  const flash = oauthFlashFromParams(searchParams, t, accountRows);
  const tSettings = await getTranslations("settings");

  const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const webhookCallbackUrl = appBase ? `${appBase}/api/webhooks/meta` : "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{tSettings("integrationsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("prodTokensNote")}</p>
      <IntegrationsForm
        organizationId={org.id}
        accounts={accounts ?? []}
        locale={locale}
        oauthFlash={flash}
        webhookCallbackUrl={webhookCallbackUrl}
      />
    </div>
  );
}
