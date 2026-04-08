"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserAppOrigin } from "@/lib/app-url";

function safeNextPath(raw: string | null, locale: string): string {
  const fallback = `/${locale}/dashboard`;
  if (!raw) return fallback;
  try {
    const path = decodeURIComponent(raw).trim();
    if (
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.includes("://")
    ) {
      return path;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const afterLoginPath = safeNextPath(searchParams.get("next"), locale);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(afterLoginPath);
    router.refresh();
  }

  async function signInGoogle() {
    setError(null);
    const supabase = createClient();
    const origin = getBrowserAppOrigin();
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/${locale}/dashboard`,
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
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tCommon("loading") : t("login")}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInGoogle}
      >
        {t("google")}
      </Button>
    </form>
  );
}
