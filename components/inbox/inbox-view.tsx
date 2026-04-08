"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BotIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";

const CONVERSATION_LIST_SELECT =
  "id, is_ai_active, last_message_at, lead_id, leads ( name, username, status, qualification_data, estimated_value, notes )";

export type ConvRow = {
  id: string;
  is_ai_active: boolean | null;
  last_message_at: string | null;
  lead_id: string;
  leads: {
    name: string | null;
    username: string | null;
    status: string | null;
    qualification_data: unknown;
    estimated_value: number | null;
    notes: string | null;
  } | null;
};

type MsgRow = {
  id: string;
  direction: string;
  sender: string;
  content: string;
  sent_at: string;
};

export function InboxView({
  organizationId,
  initialConversations,
}: {
  organizationId: string;
  initialConversations: ConvRow[];
}) {
  const t = useTranslations("inbox");
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [aiActive, setAiActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [confirmHandoff, setConfirmHandoff] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId);

  const refreshConversationList = useCallback(async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select(CONVERSATION_LIST_SELECT)
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) {
      console.error("[inbox] conversations load", error.message);
      return;
    }
    if (!data) return;
    const rows = data as unknown as ConvRow[];
    setConversations(rows);
    setSelectedId((prev) => {
      if (prev && rows.some((c) => c.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  }, [organizationId, supabase]);

  useEffect(() => {
    void refreshConversationList();
  }, [refreshConversationList]);

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`org-conversations:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void refreshConversationList();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, supabase, refreshConversationList]);

  useEffect(() => {
    if (!selectedId) return;
    const c = conversations.find((x) => x.id === selectedId);
    setAiActive(c?.is_ai_active !== false);
    setNotes(c?.leads?.notes ?? "");
  }, [selectedId, conversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, direction, sender, content, sent_at")
        .eq("conversation_id", selectedId)
        .order("sent_at", { ascending: true });
      if (!cancelled) setMessages((data as MsgRow[]) ?? []);
    })();
    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new as MsgRow;
          setMessages((m) => [...m, row]);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [selectedId, supabase]);

  async function sendHuman() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    const optimistic: MsgRow = {
      id: `temp-${Date.now()}`,
      direction: "outbound",
      sender: "human",
      content: text,
      sent_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    startTransition(async () => {
      const res = await fetch("/api/inbox/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, content: text }),
      });
      if (!res.ok) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
      }
    });
  }

  async function persistHandoff(next: boolean) {
    if (!selectedId) return;
    await fetch("/api/agent/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, isAiActive: next }),
    });
    setAiActive(next);
    setConversations((list) =>
      list.map((c) => (c.id === selectedId ? { ...c, is_ai_active: next } : c))
    );
  }

  async function saveNotes() {
    if (!selected?.lead_id) return;
    await supabase
      .from("leads")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", selected.lead_id);
  }

  async function bookMeeting() {
    if (!selectedId || !selected?.lead_id) return;
    await fetch("/api/calendar/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: selectedId,
        leadId: selected.lead_id,
      }),
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row lg:gap-0">
      <aside className="lg:w-72 lg:shrink-0 lg:border-r lg:border-border lg:pr-4">
        <h2 className="mb-2 text-lg font-semibold">{t("title")}</h2>
        <ScrollArea className="h-64 lg:h-[calc(100vh-10rem)]">
          {conversations.length === 0 ? (
            <div className="space-y-3 pr-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("emptyTitle")}</p>
              <p className="leading-relaxed">{t("emptyBody")}</p>
              <Link
                href="/settings/integrations"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {t("emptyIntegrations")}
              </Link>
              <p className="text-xs">{t("emptyRealtime")}</p>
            </div>
          ) : (
            <ul className="space-y-1 pr-2">
              {conversations.map((c) => {
                const title =
                  c.leads?.name ?? c.leads?.username ?? "Conversation";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        selectedId === c.id
                          ? "border-primary bg-muted"
                          : "border-transparent hover:bg-muted/60"
                      )}
                    >
                      <span className="font-medium">{title}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleString()
                          : "—"}
                      </span>
                      <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
                        {c.leads?.status ?? "—"}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col border border-border rounded-xl lg:border-0 lg:rounded-none lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-toggle" className="text-sm">
              {aiActive ? t("aiActive") : t("humanMode")}
            </Label>
            <Switch
              id="ai-toggle"
              checked={aiActive}
              onCheckedChange={(v) => {
                if (!v) {
                  setConfirmHandoff(true);
                } else {
                  void persistHandoff(true);
                }
              }}
            />
            <Dialog open={confirmHandoff} onOpenChange={setConfirmHandoff}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("handoffConfirm")}</DialogTitle>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConfirmHandoff(false);
                      setAiActive(true);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setConfirmHandoff(false);
                      void persistHandoff(false);
                    }}
                  >
                    Turn off AI
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1 py-4">
          <div className="space-y-3 pr-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2",
                  m.direction === "inbound" ? "justify-start" : "justify-end"
                )}
              >
                {m.direction === "inbound" ? (
                  <Avatar className="size-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                ) : null}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.direction === "inbound"
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <div className="mb-1 flex items-center gap-1 text-[10px] opacity-80">
                    {m.sender === "ai" ? (
                      <BotIcon className="size-3" />
                    ) : m.sender === "human" ? (
                      <UserIcon className="size-3" />
                    ) : null}
                    {m.sender}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex gap-2 border-t border-border pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("typeMessage")}
            className="min-h-[44px] resize-none"
            rows={2}
          />
          <Button type="button" onClick={() => void sendHuman()} disabled={pending}>
            {t("send")}
          </Button>
        </div>
      </section>

      <aside className="lg:w-72 lg:shrink-0 lg:border-l lg:border-border lg:pl-4">
        <h3 className="mb-2 font-medium">Lead</h3>
        {selected?.leads ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Status</span>
              <br />
              {selected.leads.status}
            </p>
            <div>
              <span className="text-muted-foreground">Qualification</span>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(selected.leads.qualification_data ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                type="number"
                defaultValue={selected.leads.estimated_value ?? undefined}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              <Button size="sm" className="mt-2" type="button" onClick={() => void saveNotes()}>
                Save notes
              </Button>
            </div>
            {selected.leads.status !== "booked" ? (
              <Button type="button" className="w-full" onClick={() => void bookMeeting()}>
                Book meeting
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a conversation</p>
        )}
      </aside>
    </div>
  );
}
