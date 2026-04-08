import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getOrganizationForUser } from "@/lib/org";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ConnectMetaPage() {
  const t = await getTranslations("onboarding");
  const tCommon = await getTranslations("common");
  const tIntegrations = await getTranslations("settings.integrations");
  const locale = await getLocale();
  const org = await getOrganizationForUser();
  const oauthHref = `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}`;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
      <ol className="flex gap-2 text-sm text-muted-foreground">
        <li className="font-semibold text-primary">{t("step", { n: 1 })}</li>
        <li>→</li>
        <li>{t("step", { n: 2 })}</li>
        <li>→</li>
        <li>{t("step", { n: 3 })}</li>
      </ol>
      <div>
        <h1 className="text-2xl font-semibold">{t("meta")}</h1>
        <p className="mt-2 text-muted-foreground">
          {tIntegrations("oauthBlurb")} You can also add a manual token under
          Settings → Integrations if needed.
        </p>
      </div>
      {!org ? (
        <CreateOrgForm />
      ) : (
        <div className="flex flex-col gap-3">
          <a href={oauthHref} className={cn(buttonVariants(), "w-full text-center")}>
            {tIntegrations("connectInstagram")}
          </a>
          <p className="text-sm text-muted-foreground">
            Or open{" "}
            <Link href="/settings/integrations" className="text-primary underline-offset-4 hover:underline">
              Integrations
            </Link>{" "}
            in settings.
          </p>
        </div>
      )}
      <Link
        href="/configure-agent"
        className={cn(buttonVariants({ variant: "secondary" }))}
      >
        {tCommon("continue")}
      </Link>
    </div>
  );
}
