import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ConfigureAgentMiniForm } from "@/components/onboarding/configure-agent-mini-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ConfigureAgentOnboardingPage() {
  const t = await getTranslations("onboarding");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
      <ol className="flex gap-2 text-sm text-muted-foreground">
        <li>{t("step", { n: 1 })}</li>
        <li>→</li>
        <li className="font-semibold text-primary">{t("step", { n: 2 })}</li>
        <li>→</li>
        <li>{t("step", { n: 3 })}</li>
      </ol>
      <div>
        <h1 className="text-2xl font-semibold">{t("agent")}</h1>
        <p className="mt-2 text-muted-foreground">
          Set your business context and three qualification questions. You can
          refine everything later under Settings → Agent.
        </p>
      </div>
      <ConfigureAgentMiniForm />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/connect-calendar"
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          {tCommon("continue")}
        </Link>
      </div>
    </div>
  );
}
