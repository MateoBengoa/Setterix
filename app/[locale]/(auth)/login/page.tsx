import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t("login")}</h1>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            {t("signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
