import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendInstagramMessage, sendTypingIndicator } from "@/lib/meta/instagram";
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
  calendly_url?: string | null;
  system_prompt_override: string | null;
  // extended fields
  identity_mode?: string | null;
  emoji_usage?: string | null;
  message_length?: string | null;
  use_exclamations?: boolean | null;
  catchphrases?: string | null;
  writing_examples?: string | null;
  welcome_message?: string | null;
  operating_hours?: string | null;
  main_goal?: string | null;
  cta_message?: string | null;
  forbidden_topics?: string | null;
  price_handling?: string | null;
  forbidden_phrases?: string | null;
  objections?: { objection: string; response: string }[];
  handoff_instructions?: string | null;
}): string {
  const faqBlock = config.faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
  const qualBlock = config.qualification_questions
    .map((q, i) => `${i + 1}. (${q.field_key}) ${q.question}${q.required ? " (required)" : ""}`)
    .join("\n");
  const objBlock = (config.objections ?? [])
    .map((o) => `Objeción: "${o.objection}" → Respuesta: ${o.response}`)
    .join("\n");

  const emojiMap: Record<string, string> = {
    nunca: "No uses emojis bajo ninguna circunstancia.",
    poco:  "Usa emojis con moderación, solo cuando refuercen el mensaje.",
    normal:"Usa emojis de forma natural como lo haría un humano.",
    mucho: "Usá emojis frecuentemente para sonar cercano y expresivo.",
  };
  const lengthMap: Record<string, string> = {
    cortos: "Mensajes MUY cortos (1–2 líneas máximo).",
    medios: "Mensajes de longitud media (2–4 líneas).",
    largos: "Podés extenderte con explicaciones cuando sea útil.",
  };
  const toneMap: Record<string, string> = {
    formal:    "Tono formal y profesional.",
    casual:    "Tono casual y amigable.",
    callejero: "Tono callejero, muy informal, como un amigo cercano.",
    tecnico:   "Tono técnico y preciso.",
  };
  const goalMap: Record<string, string> = {
    agendar_llamada:  "Tu objetivo principal es conseguir que el lead agende una llamada.",
    link_de_pago:     "Tu objetivo principal es enviar el link de pago cuando el lead esté listo.",
    recolectar_email: "Tu objetivo principal es conseguir el email del lead.",
    calificar:        "Tu objetivo principal es calificar al lead con las preguntas de calificación.",
    otro:             config.cta_message ?? "Cerrar la conversación con el CTA configurado.",
  };

  const booking =
    config.booking_enabled && (config.calendly_url || config.calendar_provider)
      ? `Cuando el lead quiera agendar, enviá este link: ${config.calendly_url ?? "(link pendiente de configurar)"}. Activá booking en el JSON footer.`
      : `No ofrezcas ni prometás agendar citas a menos que el lead lo pida y esté configurado.`;

  const identity =
    config.identity_mode === "brand"
      ? `Sos ${config.agent_name}, asistente de ${config.business_name}.`
      : `Sos ${config.agent_name}.`;

  return `${identity}
${config.business_description ?? ""}

IDIOMA: Respondé siempre en ${config.language === "es" ? "español" : config.language === "pt" ? "portugués" : "inglés"}.

VOZ Y ESTILO:
- ${toneMap[config.tone] ?? config.tone}
- ${emojiMap[config.emoji_usage ?? "poco"]}
- ${lengthMap[config.message_length ?? "medios"]}
- Signos de exclamación: ${config.use_exclamations ? "sí, usá exclamaciones cuando corresponda" : "no uses signos de exclamación"}.
${config.catchphrases ? `- Muletillas y frases características tuyas: ${config.catchphrases}` : ""}
${config.writing_examples ? `\nEJEMPLOS DE TU ESTILO DE ESCRITURA (aprendé de estos):\n${config.writing_examples}` : ""}

NEGOCIO:
${config.business_description ?? "(sin descripción)"}

FAQs:
${faqBlock || "(ninguna)"}

Objeciones y cómo manejarlas:
${objBlock || "(ninguna)"}

PREGUNTAS DE CALIFICACIÓN (recopilalas en orden):
${qualBlock || "(ninguna)"}
Estado actual del lead: ${config.lead_status}
Datos ya recopilados: ${JSON.stringify(config.qualification_data)}

OBJETIVO: ${goalMap[config.main_goal ?? "calificar"]}
${config.cta_message ? `Mensaje de cierre: ${config.cta_message}` : ""}

${booking}

LÍMITES:
${config.forbidden_topics ? `- Temas prohibidos: ${config.forbidden_topics}` : ""}
${config.forbidden_phrases ? `- Frases/palabras prohibidas: ${config.forbidden_phrases}` : ""}
- Precio: ${config.price_handling === "escalar" ? "Si preguntan precio, decí que lo consulta con el equipo y activá handoff." : config.price_handling === "rango" ? "Si preguntan precio, da solo un rango aproximado sin comprometerte." : "Respondé preguntas de precio con la información de las FAQs."}
${config.handoff_instructions ? `- Escalar a humano cuando: ${config.handoff_instructions}` : "- Si no sabés algo o el lead se frustra, activá handoff en el JSON footer."}
- Horario: ${config.operating_hours ?? "24/7"}

FORMATO DE RESPUESTA:
Separar cada mensaje con ||| en su propia línea (2–4 mensajes cortos como humano en chat).
Al final, una línea exacta:
ACTIONS_JSON: {"qualified":boolean,"booking":boolean,"handoff":boolean}`;
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
    calendly_url: config.calendly_url as string | null | undefined,
    system_prompt_override: config.system_prompt_override,
    identity_mode: config.identity_mode as string | null | undefined,
    emoji_usage: config.emoji_usage as string | null | undefined,
    message_length: config.message_length as string | null | undefined,
    use_exclamations: config.use_exclamations as boolean | null | undefined,
    catchphrases: config.catchphrases as string | null | undefined,
    writing_examples: config.writing_examples as string | null | undefined,
    operating_hours: config.operating_hours as string | null | undefined,
    main_goal: config.main_goal as string | null | undefined,
    cta_message: config.cta_message as string | null | undefined,
    forbidden_topics: config.forbidden_topics as string | null | undefined,
    price_handling: config.price_handling as string | null | undefined,
    forbidden_phrases: config.forbidden_phrases as string | null | undefined,
    objections: config.objections as { objection: string; response: string }[] | undefined,
    handoff_instructions: config.system_prompt_override as string | null | undefined,
  });

  const metaRow = await resolveMetaAccountForLead(
    supabase,
    conv.organization_id,
    lead?.meta_account_id
  );

  if (metaRow?.access_token && lead?.meta_user_id) {
    void sendTypingIndicator(
      metaRow.access_token,
      metaRow.page_id,
      lead.meta_user_id,
      metaRow.oauth_provider
    );
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { maxOutputTokens: 400 },
    systemInstruction: system,
  });

  const result = await model.generateContent(
    `Conversation:\n${history}\n\nReply as the assistant.`
  );

  const raw = result.response.text() ?? "";
  const { reply, qualified, booking, handoff } = parseActions(raw);
  if (!reply) return { ok: false, error: "empty_reply" };

  // Split on ||| to get individual chat bubbles.
  const parts = reply
    .split(/\|\|\|/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [reply];

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

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        direction: "outbound",
        sender: "ai",
        content: chunk,
      })
      .select("id")
      .single();

    if (metaRow?.access_token && lead?.meta_user_id) {
      // Show typing before each chunk (except the first — already shown before Gemini).
      if (i > 0) {
        await sendTypingIndicator(
          metaRow.access_token,
          metaRow.page_id,
          lead.meta_user_id,
          metaRow.oauth_provider
        );
        await new Promise((r) => setTimeout(r, 1200));
      }

      const send =
        metaRow.platform === "instagram"
          ? sendInstagramMessage(
              metaRow.access_token,
              metaRow.page_id,
              lead.meta_user_id,
              chunk,
              metaRow.oauth_provider
            )
          : sendMessengerMessage(metaRow.access_token, lead.meta_user_id, chunk);
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
  }

  await incrementAnalytics(supabase, conv.organization_id, {
    messages_sent: chunks.length,
  });

  if (booking && config.booking_enabled) {
    // Booking flow triggered — consumer can call /api/calendar/book from UI or queue
  }

  return { ok: true };
}
