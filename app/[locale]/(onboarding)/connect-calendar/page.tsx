import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ConnectCalendarPage() {
  const t = await getTranslations("onboarding");
  const tCommon = await getTranslations("common");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
      <ol className="flex gap-2 text-sm text-muted-foreground">
        <li>{t("step", { n: 1 })}</li>
        <li>→</li>
        <li>{t("step", { n: 2 })}</li>
        <li>→</li>
        <li className="font-semibold text-primary">{t("step", { n: 3 })}</li>
      </ol>
      <div>
        <h1 className="text-2xl font-semibold">{t("calendar")}</h1>
        <p className="mt-2 text-muted-foreground">
          Connect Cal.com (API key + event type) or Google Calendar from
          Settings → Integrations. You can skip for now.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={cn(buttonVariants())}>
          {tCommon("continue")} → Dashboard
        </Link>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {tCommon("skip")}
        </Link>
      </div>
    </div>
  );
}
