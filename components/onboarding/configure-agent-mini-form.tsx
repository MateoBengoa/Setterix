"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConfigureAgentMiniForm() {
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const form = new FormData(e.currentTarget);
    const business_name = String(form.get("business_name") ?? "").trim();
    const business_description = String(form.get("business_description") ?? "");
    const q1 = String(form.get("q1") ?? "").trim();
    const q2 = String(form.get("q2") ?? "").trim();
    const q3 = String(form.get("q3") ?? "").trim();

    const supabase = createClient();
    const { data: orgId, error: oidErr } = await supabase.rpc("get_my_org_id");
    if (oidErr || !orgId) {
      setStatus("No organization");
      return;
    }

    const qualification_questions = [
      { question: q1, field_key: "q1", required: true },
      { question: q2, field_key: "q2", required: true },
      { question: q3, field_key: "q3", required: true },
    ].filter((q) => q.question);

    const { error } = await supabase
      .from("agent_configs")
      .update({
        business_name,
        business_description: business_description || null,
        qualification_questions,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId);

    if (error) setStatus(error.message);
    else setStatus("Saved");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" name="business_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="business_description">Description</Label>
        <Textarea id="business_description" name="business_description" rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="q1">Qualification question 1</Label>
        <Input id="q1" name="q1" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="q2">Qualification question 2</Label>
        <Input id="q2" name="q2" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="q3">Qualification question 3</Label>
        <Input id="q3" name="q3" required />
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}
