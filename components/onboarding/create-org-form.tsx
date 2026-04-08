"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateOrgForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const businessName = String(form.get("businessName") ?? "").trim();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Not signed in");
      return;
    }
    const slug = slugify(businessName) || "org";
    const { data: orgId, error: orgErr } = await supabase.rpc(
      "create_organization_with_owner",
      {
        p_name: businessName,
        p_slug: `${slug}-${user.id.slice(0, 8)}`,
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
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Create your workspace to continue onboarding.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" name="businessName" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Create organization"}
      </Button>
    </form>
  );
}
