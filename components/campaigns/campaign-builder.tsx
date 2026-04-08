"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
  source: string;
  message_template: string;
  status: string;
  sent_count: number | null;
  reply_count: number | null;
};

export function CampaignBuilder({
  organizationId,
  campaigns: initial,
}: {
  organizationId: string;
  campaigns: Campaign[];
}) {
  const [campaigns, setCampaigns] = useState(initial);
  const [name, setName] = useState("");
  const [source, setSource] = useState("followers");
  const [template, setTemplate] = useState("Hi {{name}}, …");

  async function createCampaign() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        organization_id: organizationId,
        name,
        source,
        message_template: template,
        status: "draft",
        source_meta: { ids: [] },
      })
      .select("*")
      .single();
    if (!error && data) setCampaigns((c) => [data as Campaign, ...c]);
  }

  async function sendNow(id: string) {
    await fetch("/api/campaigns/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id }),
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={source}
              onValueChange={(v) => {
                if (v) setSource(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="followers">followers</SelectItem>
                <SelectItem value="post_likers">post_likers</SelectItem>
                <SelectItem value="post_commenters">post_commenters</SelectItem>
                <SelectItem value="manual_list">manual_list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template ({"{{name}}"}, {"{{business}}"})</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
            />
          </div>
          <Button type="button" onClick={() => void createCampaign()}>
            Save draft
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{c.status}</span>
              <span>sent: {c.sent_count ?? 0}</span>
              <span>replies: {c.reply_count ?? 0}</span>
              <Button size="sm" type="button" onClick={() => void sendNow(c.id)}>
                Send now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
