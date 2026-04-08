import { Link } from "@/i18n/routing";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function HomePage({
  params,
}: {
  params: { locale: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations("auth");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {tCommon("appName")}
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          AI-powered sales agent for Instagram and Facebook DMs.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className={cn(buttonVariants())}>
          {t("login")}
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("signup")}
        </Link>
      </div>
    </div>
  );
}
