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

export function IntegrationsForm({
  organizationId,
  accounts: initial,
  locale,
  oauthFlash,
}: {
  organizationId: string;
  accounts: Account[];
  locale: string;
  oauthFlash: { variant: "success" | "error"; message: string } | null;
}) {
  const t = useTranslations("settings.integrations");
  const [accounts, setAccounts] = useState(initial);
  const [platform, setPlatform] = useState("instagram");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [token, setToken] = useState("");

  function startMetaOAuth() {
    window.location.assign(
      `/api/integrations/meta/oauth?locale=${encodeURIComponent(locale)}`
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

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">{t("connectInstagram")}</h2>
        <p className="text-sm text-muted-foreground">{t("oauthBlurb")}</p>
        <Button type="button" className="w-full sm:w-auto" onClick={startMetaOAuth}>
          {t("connectInstagram")}
        </Button>
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
      <ul className="space-y-2 text-sm">
        {accounts.map((a) => (
          <li key={a.id} className="rounded-lg border border-border px-3 py-2">
            {a.platform} — {a.page_name ?? a.page_id}{" "}
            {a.is_active ? "(active)" : "(inactive)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
