"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/context/org-context";
import { Card, CardContent } from "@/components/ui/card";

type Row = Record<string, unknown> | null;

export function AgentConfigForm({
  initial,
  organizationId,
  plan,
}: {
  initial: Row;
  organizationId: string;
  plan: string;
}) {
  const { isPro, isAgency } = usePlan();
  const [agentName, setAgentName] = useState(String(initial?.agent_name ?? "Assistant"));
  const [businessName, setBusinessName] = useState(
    String(initial?.business_name ?? "")
  );
  const [businessDescription, setBusinessDescription] = useState(
    String(initial?.business_description ?? "")
  );
  const [tone, setTone] = useState(String(initial?.tone ?? "professional"));
  const [language, setLanguage] = useState(String(initial?.language ?? "en"));
  const [bookingEnabled, setBookingEnabled] = useState(
    Boolean(initial?.booking_enabled ?? true)
  );
  const [calendarProvider, setCalendarProvider] = useState(
    String(initial?.calendar_provider ?? "")
  );
  const [faqText, setFaqText] = useState(
    JSON.stringify(initial?.faqs ?? [], null, 2)
  );
  const [qualText, setQualText] = useState(
    JSON.stringify(initial?.qualification_questions ?? [], null, 2)
  );
  const [override, setOverride] = useState(
    String(initial?.system_prompt_override ?? "")
  );
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus(null);
    let faqs: unknown = [];
    let qualification_questions: unknown = [];
    try {
      faqs = JSON.parse(faqText);
      qualification_questions = JSON.parse(qualText);
    } catch {
      setStatus("Invalid JSON in FAQ or qualification fields");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("agent_configs")
      .update({
        agent_name: agentName,
        business_name: businessName,
        business_description: businessDescription || null,
        tone,
        language,
        faqs,
        qualification_questions,
        booking_enabled: bookingEnabled,
        calendar_provider: calendarProvider || null,
        system_prompt_override:
          isPro || isAgency ? override || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
    if (error) setStatus(error.message);
    else setStatus("Saved");
  }

  return (
    <Tabs defaultValue="basics">
      <p className="text-xs text-muted-foreground">Plan: {plan}</p>
      <TabsList className="flex-wrap">
        <TabsTrigger value="basics">Basics</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="qual">Qualification</TabsTrigger>
        <TabsTrigger value="booking">Booking</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="basics" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Agent name</Label>
          <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Business name</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Tone</Label>
          <Select
            value={tone}
            onValueChange={(v) => {
              if (v) setTone(v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">professional</SelectItem>
              <SelectItem value="casual">casual</SelectItem>
              <SelectItem value="friendly">friendly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
      </TabsContent>
      <TabsContent value="faq" className="pt-4">
        <p className="mb-2 text-sm text-muted-foreground">
          JSON array: max 20 items {"[{question, answer}]"}
        </p>
        <Textarea value={faqText} onChange={(e) => setFaqText(e.target.value)} rows={12} />
      </TabsContent>
      <TabsContent value="qual" className="pt-4">
        <p className="mb-2 text-sm text-muted-foreground">
          JSON array: {"[{question, field_key, required?}]"}
        </p>
        <Textarea value={qualText} onChange={(e) => setQualText(e.target.value)} rows={12} />
      </TabsContent>
      <TabsContent value="booking" className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <Switch checked={bookingEnabled} onCheckedChange={setBookingEnabled} />
          <Label>Booking enabled</Label>
        </div>
        <Select
          value={calendarProvider || undefined}
          onValueChange={(v) => setCalendarProvider(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Calendar provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cal_com">cal_com</SelectItem>
            <SelectItem value="google_calendar">google_calendar</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Store API keys / OAuth tokens in calendar_config via Integrations (Vault in production).
        </p>
      </TabsContent>
      <TabsContent value="advanced" className="pt-4">
        {isPro || isAgency ? (
          <Textarea
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            rows={10}
            placeholder="System prompt override"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pro or Agency plan required for prompt override.
          </p>
        )}
      </TabsContent>
      <TabsContent value="preview" className="pt-4">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Hook this tab to a server action calling the same prompt builder as
            <code className="mx-1 rounded bg-muted px-1">generateAgentReply</code>
            with a mock thread.
          </CardContent>
        </Card>
      </TabsContent>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <Button type="button" className="mt-4" onClick={() => void save()}>
        Save
      </Button>
    </Tabs>
  );
}
