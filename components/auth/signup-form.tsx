"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserAppOrigin } from "@/lib/app-url";

function formatSignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("email rate limit")) {
    return "Límite de correos de Supabase alcanzado: espera unos minutos u horas, o desactiva la confirmación por email en desarrollo (Authentication → Providers → Email). También puedes configurar SMTP propio en Project Settings → Auth.";
  }
  return message;
}

export function SignupForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const businessName = String(form.get("businessName") ?? "").trim();

    if (!businessName) {
      setError("Business name is required");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signErr) {
      setLoading(false);
      setError(formatSignUpError(signErr.message));
      return;
    }

    const sessionUser = data.session?.user;
    if (!sessionUser) {
      setLoading(false);
      setError(
        "No hay sesión activa todavía. Si Supabase pide confirmar el email, confírmalo e inicia sesión; o desactiva “Confirm email” en Authentication → Providers (solo desarrollo). Luego crea la organización desde onboarding."
      );
      return;
    }

    let slug = slugify(businessName);
    if (!slug) slug = "org";

    const { data: orgId, error: orgErr } = await supabase.rpc(
      "create_organization_with_owner",
      {
        p_name: businessName,
        p_slug: `${slug}-${sessionUser.id.slice(0, 8)}`,
      }
    );

    if (orgErr) {
      setLoading(false);
      setError(orgErr.message);
      return;
    }
    if (!orgId) {
      setLoading(false);
      setError("No se pudo crear la organización.");
      return;
    }

    setLoading(false);
    router.push("/connect-meta");
    router.refresh();
  }

  async function signUpGoogle() {
    setError(null);
    const supabase = createClient();
    const origin = getBrowserAppOrigin();
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/${locale}/connect-meta`,
        skipBrowserRedirect: true,
      },
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (data.url) {
      window.location.assign(data.url);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" name="businessName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tCommon("loading") : t("signup")}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signUpGoogle}
      >
        {t("google")}
      </Button>
    </form>
  );
}
