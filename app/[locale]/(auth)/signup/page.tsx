import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t("signup")}</h1>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
