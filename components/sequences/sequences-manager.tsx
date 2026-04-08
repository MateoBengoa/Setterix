"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Seq = {
  id: string;
  name: string;
  trigger: string;
  is_active: boolean | null;
  steps: unknown;
};

export function SequencesManager({
  organizationId,
  sequences: initial,
}: {
  organizationId: string;
  sequences: Seq[];
}) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("Follow-up");
  const [trigger, setTrigger] = useState("no_reply_1d");

  async function addSequence() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sequences")
      .insert({
        organization_id: organizationId,
        name,
        trigger,
        is_active: true,
        steps: [{ delay_hours: 24, message_template: "Just checking in!" }],
      })
      .select("*")
      .single();
    if (!error && data) setRows((r) => [data as Seq, ...r]);
  }

  async function toggle(id: string, active: boolean) {
    const supabase = createClient();
    await supabase.from("sequences").update({ is_active: active }).eq("id", id);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, is_active: active } : x)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create sequence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select
              value={trigger}
              onValueChange={(v) => {
                if (v) setTrigger(v);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_reply_1d">no_reply_1d</SelectItem>
                <SelectItem value="no_reply_3d">no_reply_3d</SelectItem>
                <SelectItem value="no_reply_7d">no_reply_7d</SelectItem>
                <SelectItem value="after_post_comment">after_post_comment</SelectItem>
                <SelectItem value="after_story_reply">after_story_reply</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="self-end" type="button" onClick={() => void addSequence()}>
            Add
          </Button>
        </CardContent>
      </Card>
      <ul className="space-y-2">
        {rows.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.trigger}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch
                checked={Boolean(s.is_active)}
                onCheckedChange={(v) => void toggle(s.id, v)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
