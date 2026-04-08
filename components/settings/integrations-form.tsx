"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Account = {
  id: string;
  platform: string;
  page_id: string | null;
  page_name: string | null;
  access_token: string;
  is_active: boolean | null;
};

function accountDisplayLine(a: Account): string {
  const name = a.page_name?.trim();
  const id = a.page_id?.trim();
  if (name && id) return `${name} (${id})`;
  return name || id || "—";
}

export function IntegrationsForm({
  organizationId,
  accounts: initial,
  locale,
  oauthFlash,
  webhookCallbackUrl,
}: {
  organizationId: string;
  accounts: Account[];
  locale: string;
  oauthFlash: { variant: "success" | "error"; message: string } | null;
  webhookCallbackUrl: string;
}) {
  const t = useTranslations("settings.integrations");
  const [accounts, setAccounts] = useState(initial);
  const [platform, setPlatform] = useState("instagram");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [token, setToken] = useState("");
  const [webhookDiag, setWebhookDiag] = useState<string | null>(null);

  async function runWebhookDiagnostics() {
    setWebhookDiag(t("webhookDiagLoading"));
    try {
      const res = await fetch("/api/integrations/meta/webhook-status");
      const json = (await res.json()) as unknown;
      setWebhookDiag(JSON.stringify(json, null, 2));
    } catch {
      setWebhookDiag(t("webhookDiagError"));
    }
  }

  function startNativeInstagramOAuth() {
    window.location.assign(
      `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}&flow=native_instagram`
    );
  }

  function startBusinessOAuth() {
    window.location.assign(
      `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}&flow=instagram`
    );
  }

  function startFacebookOAuth() {
    window.location.assign(
      `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}&flow=facebook`
    );
  }

  function startInstagramLoginPageOAuth() {
    window.location.assign(
      `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}&flow=instagram&entry=loginpage`
    );
  }

  async function addAccount() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meta_accounts")
      .insert({
        organization_id: organizationId,
        platform,
        meta_user_id: pageId || "page",
        page_id: pageId || null,
        page_name: pageName || null,
        access_token: token,
        is_active: true,
        oauth_provider: platform === "instagram" ? "instagram" : "facebook",
      })
      .select("*")
      .single();
    if (!error && data) {
      setAccounts((a) => [...a, data as Account]);
      setToken("");
    }
  }

  return (
    <div className="space-y-6">
      {oauthFlash ? (
        <div
          role="alert"
          className={
            oauthFlash.variant === "success"
              ? "rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground"
              : "rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {oauthFlash.message}
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <h2 className="font-medium text-foreground">{t("webhookDiagTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("webhookDiagHint")}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void runWebhookDiagnostics()}
        >
          {t("webhookDiagButton")}
        </Button>
        {webhookDiag ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs">
            {webhookDiag}
          </pre>
        ) : null}
      </div>

      {webhookCallbackUrl ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <h2 className="font-medium text-foreground">{t("liveSetupTitle")}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>{t("liveSetupWebhookLine", { url: webhookCallbackUrl })}</li>
            <li>{t("liveSetupVerifyLine")}</li>
            <li>{t("liveSetupSubscribeLine")}</li>
            <li>{t("liveSetupGeminiLine")}</li>
          </ol>
        </div>
      ) : (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          {t("liveSetupMissingAppUrl")}
        </p>
      )}

      {accounts.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">{t("connectedAccountsTitle")}</h2>
          <ul className="space-y-2 text-sm">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2"
              >
                <span className="font-medium text-foreground">
                  {accountDisplayLine(a)}
                </span>
                <span className="text-muted-foreground">
                  {a.platform}
                  {a.is_active ? "" : ` · ${t("inactiveSuffix")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">{t("connectInstagramNative")}</h2>
        <p className="text-sm text-muted-foreground">{t("oauthNativeBlurb")}</p>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={startNativeInstagramOAuth}
        >
          {t("connectInstagramNative")}
        </Button>

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-medium">{t("connectAlternativesTitle")}</h3>
          <p className="mb-2 text-sm text-muted-foreground">{t("oauthAccountPickerHint")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("oauthBlurb")}</p>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
            <button
              type="button"
              className="text-left text-primary underline-offset-4 hover:underline"
              onClick={startBusinessOAuth}
            >
              {t("connectViaBusinessLink")}
            </button>
            <button
              type="button"
              className="text-left text-primary underline-offset-4 hover:underline"
              onClick={startFacebookOAuth}
            >
              {t("connectViaFacebookLink")}
            </button>
            <button
              type="button"
              className="text-left text-primary underline-offset-4 hover:underline"
              onClick={startInstagramLoginPageOAuth}
            >
              {t("connectViaInstagramLoginPageLink")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">{t("manualSection")}</h2>
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select
            value={platform}
            onValueChange={(v) => {
              if (v) setPlatform(v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">instagram</SelectItem>
              <SelectItem value="facebook">facebook</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Page ID (webhook entry id)</Label>
          <Input value={pageId} onChange={(e) => setPageId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Page name</Label>
          <Input value={pageName} onChange={(e) => setPageName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Access token (dev only)</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="button" onClick={() => void addAccount()}>
          Save connection
        </Button>
      </div>
    </div>
  );
}
