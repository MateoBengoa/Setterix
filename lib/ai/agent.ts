import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendInstagramMessage } from "@/lib/meta/instagram";
import { sendMessengerMessage } from "@/lib/meta/facebook";
import { incrementAnalytics } from "@/lib/analytics/attribution";
import { resolveMetaAccountForLead } from "@/lib/meta/resolve-meta-account";

export type AgentDeps = {
  supabase: SupabaseClient;
  geminiApiKey: string;
};

type FAQ = { question: string; answer: string };
type QualQ = { question: string; field_key: string; required?: boolean };

function buildSystemPrompt(config: {
  agent_name: string;
  business_name: string;
  business_description: string | null;
  tone: string;
  language: string;
  faqs: FAQ[];
  qualification_questions: QualQ[];
  qualification_data: Record<string, unknown>;
  lead_status: string;
  booking_enabled: boolean;
  calendar_provider: string | null;
  system_prompt_override: string | null;
}): string {
  const faqBlock = config.faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
  const qualBlock = config.qualification_questions
    .map((q, i) => `${i + 1}. (${q.field_key}) ${q.question}${q.required ? " (required)" : ""}`)
    .join("\n");
  const booking =
    config.booking_enabled && config.calendar_provider
      ? `If the user wants to book, acknowledge and say you will send a booking link shortly. Set action booking in the JSON footer.`
      : `Do not promise booking unless configured.`;

  const base = config.system_prompt_override?.trim()
    ? config.system_prompt_override.trim()
    : `You are ${config.agent_name}, a ${config.tone} assistant for ${config.business_name}.
${config.business_description ?? ""}

Language: reply in ${config.language} when appropriate.

FAQs:
${faqBlock || "(none)"}

Qualification questions to collect in order (merge answers into context):
${qualBlock || "(none)"}

Current lead status: ${config.lead_status}
Known qualification data (JSON): ${JSON.stringify(config.qualification_data)}

Rules:
- Never invent prices, discounts, or guarantees not explicitly provided in FAQs or business description.
- If asked something outside your knowledge or scope, say you will connect them with the team and set action handoff in the JSON footer.
- Be concise and helpful.
${booking}

After your user-facing message, output a single line exactly in this format (machine-readable, do not show to user as separate message — it is stripped server-side):
ACTIONS_JSON: {"qualified":boolean,"booking":boolean,"handoff":boolean}`;

  return base;
}

function parseActions(text: string): {
  reply: string;
  qualified: boolean;
  booking: boolean;
  handoff: boolean;
} {
  const marker = "ACTIONS_JSON:";
  const idx = text.lastIndexOf(marker);
  if (idx === -1) {
    return { reply: text.trim(), qualified: false, booking: false, handoff: false };
  }
  const reply = text.slice(0, idx).trim();
  const jsonPart = text.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as {
      qualified?: boolean;
      booking?: boolean;
      handoff?: boolean;
    };
    return {
      reply,
      qualified: Boolean(parsed.qualified),
      booking: Boolean(parsed.booking),
      handoff: Boolean(parsed.handoff),
    };
  } catch {
    return { reply: text.trim(), qualified: false, booking: false, handoff: false };
  }
}

export async function generateAgentReply(
  conversationId: string,
  deps: AgentDeps
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, geminiApiKey } = deps;

  const { data: conv, error: cErr } = await supabase
    .from("conversations")
    .select("id, organization_id, lead_id, is_ai_active, meta_thread_id, last_outbound_at")
    .eq("id", conversationId)
    .single();
  if (cErr || !conv) return { ok: false, error: "conversation_not_found" };
  if (!conv.is_ai_active) return { ok: true };

  const now = Date.now();
  if (conv.last_outbound_at) {
    const last = new Date(conv.last_outbound_at).getTime();
    if (now - last < 2000) {
      return { ok: true };
    }
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", conv.lead_id)
    .single();

  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("organization_id", conv.organization_id)
    .single();

  if (!config) return { ok: false, error: "no_agent_config" };

  const { data: msgs } = await supabase
    .from("messages")
    .select("direction, sender, content, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(50);

  const history =
    msgs
      ?.map(
        (m) =>
          `${m.direction === "inbound" ? "User" : m.sender === "ai" ? "Assistant" : "Agent"}: ${m.content}`
      )
      .join("\n") ?? "";

  const system = buildSystemPrompt({
    agent_name: config.agent_name,
    business_name: config.business_name,
    business_description: config.business_description,
    tone: config.tone,
    language: config.language,
    faqs: (config.faqs as FAQ[]) ?? [],
    qualification_questions: (config.qualification_questions as QualQ[]) ?? [],
    qualification_data: (lead?.qualification_data as Record<string, unknown>) ?? {},
    lead_status: lead?.status ?? "new",
    booking_enabled: config.booking_enabled ?? false,
    calendar_provider: config.calendar_provider,
    system_prompt_override: config.system_prompt_override,
  });

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { maxOutputTokens: 400 },
    systemInstruction: system,
  });

  const result = await model.generateContent(
    `Conversation:\n${history}\n\nReply as the assistant.`
  );

  const raw = result.response.text() ?? "";
  const { reply, qualified, booking, handoff } = parseActions(raw);
  if (!reply) return { ok: false, error: "empty_reply" };

  const metaRow = await resolveMetaAccountForLead(
    supabase,
    conv.organization_id,
    lead?.meta_account_id
  );

  const { data: inserted } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      sender: "ai",
      content: reply,
    })
    .select("id")
    .single();

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (qualified && lead) {
    await supabase
      .from("leads")
      .update({ status: "qualified", updated_at: new Date().toISOString() })
      .eq("id", lead.id);
  }

  if (handoff) {
    await supabase.from("conversations").update({ is_ai_active: false }).eq("id", conversationId);
    if (lead) {
      await incrementAnalytics(supabase, conv.organization_id, {
        handoffs_to_human: 1,
      });
    }
  }

  if (metaRow?.access_token && lead?.meta_user_id) {
    const send =
      metaRow.platform === "instagram"
        ? sendInstagramMessage(
            metaRow.access_token,
            metaRow.page_id,
            lead.meta_user_id,
            reply,
            metaRow.oauth_provider
          )
        : sendMessengerMessage(metaRow.access_token, lead.meta_user_id, reply);
    const sent = await send;
    if (sent.error) {
      return { ok: false, error: sent.error };
    }
    if (inserted && sent.message_id) {
      await supabase
        .from("messages")
        .update({ meta_message_id: sent.message_id })
        .eq("id", inserted.id);
    }
  }

  await incrementAnalytics(supabase, conv.organization_id, {
    messages_sent: 1,
  });

  if (booking && config.booking_enabled) {
    // Booking flow triggered — consumer can call /api/calendar/book from UI or queue
  }

  return { ok: true };
}
