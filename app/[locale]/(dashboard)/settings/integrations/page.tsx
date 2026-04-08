import { getLocale, getTranslations } from "next-intl/server";
import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { IntegrationsForm } from "@/components/settings/integrations-form";

function oauthFlashFromParams(
  searchParams: Record<string, string | string[] | undefined>,
  t: Awaited<ReturnType<typeof getTranslations>>
): { variant: "success" | "error"; message: string } | null {
  const connected = searchParams.connected;
  if (typeof connected === "string" && connected !== "") {
    return {
      variant: "success",
      message: t("oauthConnected", { count: connected }),
    };
  }
  const err = searchParams.error;
  if (typeof err !== "string") return null;
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

  const locale = await getLocale();
  const t = await getTranslations("settings.integrations");
  const flash = oauthFlashFromParams(searchParams, t);
  const tSettings = await getTranslations("settings");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{tSettings("integrationsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("prodTokensNote")}</p>
      <IntegrationsForm
        organizationId={org.id}
        accounts={accounts ?? []}
        locale={locale}
        oauthFlash={flash}
      />
    </div>
  );
}
