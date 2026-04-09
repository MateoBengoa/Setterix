"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  User,
  Mic2,
  Briefcase,
  GitBranch,
  Target,
  ShieldOff,
  Plug,
  Plus,
  Trash2,
  Check,
} from "lucide-react";

type Row = Record<string, unknown> | null;

// ── tiny helpers ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-white/5">
          <Icon className="size-4 text-[#e36887]" strokeWidth={1.8} />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4 pl-0">{children}</div>
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
            value === o.value
              ? "border-[#e36887]/60 bg-[#e36887]/15 text-[#f3d98f]"
              : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 space-y-0.5">
      <Label className="text-xs font-medium text-white/80">{children}</Label>
      {hint && <p className="text-[11px] text-white/35">{hint}</p>}
    </div>
  );
}

// ── dynamic list helpers ──────────────────────────────────────────────────────

type FaqItem = { question: string; answer: string };
type QualItem = { question: string; field_key: string; required?: boolean };
type ObjItem  = { objection: string; response: string };

// ─────────────────────────────────────────────────────────────────────────────

type UserProfile = {
  email: string | null;
  name: string | null;
  igName: string | null;
};

export function AgentConfigForm({
  initial,
  organizationId,
  userProfile,
}: {
  initial: Row;
  organizationId: string;
  plan: string;
  userProfile?: UserProfile;
}) {
  // 1 — Identidad
  const [identityMode, setIdentityMode] = useState(String(initial?.identity_mode ?? "personal"));
  const [agentName,    setAgentName]    = useState(String(initial?.agent_name ?? ""));
  const [businessName, setBusinessName] = useState(String(initial?.business_name ?? ""));

  // Derived: best available personal name from profile
  const profileName =
    userProfile?.igName ??
    userProfile?.name ??
    userProfile?.email?.split("@")[0] ??
    null;

  // 2 — Voz
  const [tone,            setTone]            = useState(String(initial?.tone ?? "casual"));
  const [emojiUsage,      setEmojiUsage]      = useState(String(initial?.emoji_usage ?? "poco"));
  const [messageLength,   setMessageLength]   = useState(String(initial?.message_length ?? "medios"));
  const [useExclamations, setUseExclamations] = useState(Boolean(initial?.use_exclamations ?? true));
  const [catchphrases,    setCatchphrases]    = useState(String(initial?.catchphrases ?? ""));
  const [writingExamples, setWritingExamples] = useState(String(initial?.writing_examples ?? ""));

  // 3 — Negocio
  const [businessDescription, setBusinessDescription] = useState(String(initial?.business_description ?? ""));
  const [language,             setLanguage]             = useState(String(initial?.language ?? "es"));
  const [faqs,                 setFaqs]                 = useState<FaqItem[]>(
    (initial?.faqs as FaqItem[]) ?? []
  );
  const [objections, setObjections] = useState<ObjItem[]>(
    (initial?.objections as ObjItem[]) ?? []
  );

  // 4 — Flujo
  const [welcomeMessage,      setWelcomeMessage]      = useState(String(initial?.welcome_message ?? ""));
  const [qualQuestions,       setQualQuestions]       = useState<QualItem[]>(
    (initial?.qualification_questions as QualItem[]) ?? []
  );
  const [handoffInstructions, setHandoffInstructions] = useState(
    String(initial?.system_prompt_override ?? "")
  );
  const [operatingHours, setOperatingHours] = useState(String(initial?.operating_hours ?? "24/7"));

  // 5 — Objetivo
  const [mainGoal,   setMainGoal]   = useState(String(initial?.main_goal ?? "agendar_llamada"));
  const [ctaMessage, setCtaMessage] = useState(String(initial?.cta_message ?? ""));

  // 6 — Límites
  const [forbiddenTopics,   setForbiddenTopics]   = useState(String(initial?.forbidden_topics ?? ""));
  const [priceHandling,     setPriceHandling]     = useState(String(initial?.price_handling ?? "responder"));
  const [forbiddenPhrases,  setForbiddenPhrases]  = useState(String(initial?.forbidden_phrases ?? ""));

  // 7 — Integraciones
  const [bookingEnabled,   setBookingEnabled]   = useState(Boolean(initial?.booking_enabled ?? false));
  const [calendarProvider, setCalendarProvider] = useState(String(initial?.calendar_provider ?? ""));
  const [calendlyUrl,      setCalendlyUrl]      = useState(String(initial?.calendly_url ?? ""));
  const [crmWebhookUrl,    setCrmWebhookUrl]    = useState(String(initial?.crm_webhook_url ?? ""));

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("agent_configs").upsert(
      {
        organization_id: organizationId,
        identity_mode: identityMode,
        agent_name: identityMode === "personal" && profileName ? profileName : (agentName || "Asistente"),
        business_name: businessName,
        tone,
        emoji_usage: emojiUsage,
        message_length: messageLength,
        use_exclamations: useExclamations,
        catchphrases: catchphrases || null,
        writing_examples: writingExamples || null,
        business_description: businessDescription || null,
        language,
        faqs,
        objections,
        welcome_message: welcomeMessage || null,
        qualification_questions: qualQuestions,
        system_prompt_override: handoffInstructions || null,
        operating_hours: operatingHours,
        main_goal: mainGoal,
        cta_message: ctaMessage || null,
        forbidden_topics: forbiddenTopics || null,
        price_handling: priceHandling,
        forbidden_phrases: forbiddenPhrases || null,
        booking_enabled: bookingEnabled,
        calendar_provider: calendarProvider || null,
        calendly_url: calendlyUrl || null,
        crm_webhook_url: crmWebhookUrl || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    );
    setSaving(false);
    if (err) setError(err.message);
    else setSaved(true);
  }

  return (
    <div className="space-y-10 pb-16">

      {/* ── 1 Identidad ─────────────────────────────────────────── */}
      <Section icon={User} title="Identidad">
        <div>
          <FieldLabel>Modo</FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "personal", label: "Soy yo", sub: "Cuenta personal" },
              { value: "brand",    label: `Asistente de marca`, sub: "Empresa u organización" },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setIdentityMode(m.value)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  identityMode === m.value
                    ? "border-[#e36887]/60 bg-[#e36887]/10"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-[11px] text-white/40">{m.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {identityMode === "personal" && profileName ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#e36887]/30 bg-[#e36887]/5 px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e36887]/20 text-sm font-semibold text-[#f3d98f]">
              {profileName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{profileName}</p>
              <p className="text-[11px] text-white/40">
                {userProfile?.igName ? "Cuenta de Instagram conectada" : "Tu perfil"}
                {userProfile?.email ? ` · ${userProfile.email}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel hint="Cómo se presentará en la primera respuesta">
              Nombre del agente
            </FieldLabel>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ej: Lucas, Sofía, Asistente de Mateo"
            />
          </div>
        )}

        {identityMode === "brand" && (
          <div>
            <FieldLabel>Nombre de la marca / negocio</FieldLabel>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Studio Mateo, AgencyX"
            />
          </div>
        )}
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 2 Voz & Estilo ──────────────────────────────────────── */}
      <Section icon={Mic2} title="Voz & Estilo de escritura">
        <div>
          <FieldLabel>Tono</FieldLabel>
          <Chips
            value={tone}
            onChange={setTone}
            options={[
              { value: "formal",    label: "Formal" },
              { value: "casual",    label: "Casual" },
              { value: "callejero", label: "Callejero" },
              { value: "tecnico",   label: "Técnico" },
            ]}
          />
        </div>

        <div>
          <FieldLabel>Uso de emojis</FieldLabel>
          <Chips
            value={emojiUsage}
            onChange={setEmojiUsage}
            options={[
              { value: "nunca",  label: "Nunca" },
              { value: "poco",   label: "Poco" },
              { value: "normal", label: "Normal" },
              { value: "mucho",  label: "Mucho" },
            ]}
          />
        </div>

        <div>
          <FieldLabel>Longitud de mensajes</FieldLabel>
          <Chips
            value={messageLength}
            onChange={setMessageLength}
            options={[
              { value: "cortos", label: "Cortos" },
              { value: "medios", label: "Medios" },
              { value: "largos", label: "Largos" },
            ]}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
          <div>
            <p className="text-xs font-medium">Signos de exclamación</p>
            <p className="text-[11px] text-white/35">¡Hola! vs Hola</p>
          </div>
          <Switch checked={useExclamations} onCheckedChange={setUseExclamations} />
        </div>

        <div>
          <FieldLabel hint='Ej: "dale", "obvio", "100%", "che"'>
            Muletillas o frases características
          </FieldLabel>
          <Input
            value={catchphrases}
            onChange={(e) => setCatchphrases(e.target.value)}
            placeholder="dale, obvio, 100%, che..."
          />
        </div>

        <div>
          <FieldLabel hint="Pegá ejemplos reales de cómo escribís para que el agente aprenda tu estilo">
            Ejemplos de conversación real
          </FieldLabel>
          <Textarea
            value={writingExamples}
            onChange={(e) => setWritingExamples(e.target.value)}
            rows={5}
            placeholder={"Cliente: ¿cuánto sale?\nYo: dale, mirá te paso los precios..."}
          />
        </div>
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 3 Negocio ───────────────────────────────────────────── */}
      <Section icon={Briefcase} title="Contexto del negocio">
        <div>
          <FieldLabel hint="Qué vendés, a quién, cuánto cuesta, por qué te eligen">
            Descripción del negocio
          </FieldLabel>
          <Textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            rows={4}
            placeholder="Soy fotógrafo de bodas en CABA. Paquetes desde $1500 USD. Me especializo en fotos naturales..."
          />
        </div>

        <div>
          <FieldLabel>Idioma de respuesta</FieldLabel>
          <Chips
            value={language}
            onChange={setLanguage}
            options={[
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
              { value: "pt", label: "Português" },
            ]}
          />
        </div>

        <DynamicList
          label="Preguntas frecuentes (FAQs)"
          hint="Pregunta y respuesta que el agente usará"
          items={faqs}
          onAdd={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
          onRemove={(i) => setFaqs((f) => f.filter((_, idx) => idx !== i))}
          renderItem={(item, i) => (
            <div className="space-y-2">
              <Input
                placeholder="Pregunta"
                value={item.question}
                onChange={(e) =>
                  setFaqs((f) =>
                    f.map((x, idx) => idx === i ? { ...x, question: e.target.value } : x)
                  )
                }
              />
              <Textarea
                placeholder="Respuesta"
                rows={2}
                value={item.answer}
                onChange={(e) =>
                  setFaqs((f) =>
                    f.map((x, idx) => idx === i ? { ...x, answer: e.target.value } : x)
                  )
                }
              />
            </div>
          )}
        />

        <DynamicList
          label="Objeciones comunes"
          hint="Cómo manejar cuando el cliente pone resistencia"
          items={objections}
          onAdd={() => setObjections((o) => [...o, { objection: "", response: "" }])}
          onRemove={(i) => setObjections((o) => o.filter((_, idx) => idx !== i))}
          renderItem={(item, i) => (
            <div className="space-y-2">
              <Input
                placeholder="Objeción (Ej: es muy caro)"
                value={item.objection}
                onChange={(e) =>
                  setObjections((o) =>
                    o.map((x, idx) => idx === i ? { ...x, objection: e.target.value } : x)
                  )
                }
              />
              <Textarea
                placeholder="Cómo responderla"
                rows={2}
                value={item.response}
                onChange={(e) =>
                  setObjections((o) =>
                    o.map((x, idx) => idx === i ? { ...x, response: e.target.value } : x)
                  )
                }
              />
            </div>
          )}
        />
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 4 Flujo ─────────────────────────────────────────────── */}
      <Section icon={GitBranch} title="Flujo de conversación">
        <div>
          <FieldLabel hint="Primer mensaje que manda el agente cuando alguien escribe por primera vez">
            Mensaje de bienvenida
          </FieldLabel>
          <Textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            placeholder="Hola! Soy Lucas, asistente de Mateo. ¿En qué te puedo ayudar hoy?"
          />
        </div>

        <DynamicList
          label="Preguntas de calificación"
          hint="Preguntas para calificar al lead antes de cerrar"
          items={qualQuestions}
          onAdd={() =>
            setQualQuestions((q) => [
              ...q,
              { question: "", field_key: `q${q.length + 1}`, required: true },
            ])
          }
          onRemove={(i) => setQualQuestions((q) => q.filter((_, idx) => idx !== i))}
          renderItem={(item, i) => (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Pregunta"
                value={item.question}
                className="col-span-2"
                onChange={(e) =>
                  setQualQuestions((q) =>
                    q.map((x, idx) => idx === i ? { ...x, question: e.target.value } : x)
                  )
                }
              />
              <Input
                placeholder="Clave (ej: presupuesto)"
                value={item.field_key}
                onChange={(e) =>
                  setQualQuestions((q) =>
                    q.map((x, idx) => idx === i ? { ...x, field_key: e.target.value } : x)
                  )
                }
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.required ?? true}
                  onCheckedChange={(v) =>
                    setQualQuestions((q) =>
                      q.map((x, idx) => idx === i ? { ...x, required: v } : x)
                    )
                  }
                />
                <span className="text-xs text-white/50">Requerida</span>
              </div>
            </div>
          )}
        />

        <div>
          <FieldLabel hint="En qué situación el agente debe dejar de responder y avisar al humano">
            Cuándo escalar a humano
          </FieldLabel>
          <Textarea
            value={handoffInstructions}
            onChange={(e) => setHandoffInstructions(e.target.value)}
            rows={3}
            placeholder="Escalar si: el cliente pregunta algo que no está en las FAQs, si hay queja, o si pide hablar con una persona."
          />
        </div>

        <div>
          <FieldLabel>Horario de operación</FieldLabel>
          <Chips
            value={operatingHours}
            onChange={setOperatingHours}
            options={[
              { value: "24/7",   label: "24/7" },
              { value: "negocio", label: "Horario de negocio" },
              { value: "custom", label: "Personalizado" },
            ]}
          />
          {operatingHours === "custom" && (
            <Input
              className="mt-2"
              placeholder="Ej: Lunes a Viernes 9–18hs (GMT-3)"
              value={operatingHours === "custom" ? "" : operatingHours}
            />
          )}
        </div>
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 5 Objetivo ──────────────────────────────────────────── */}
      <Section icon={Target} title="Objetivo del agente">
        <div>
          <FieldLabel>Meta principal</FieldLabel>
          <Chips
            value={mainGoal}
            onChange={setMainGoal}
            options={[
              { value: "agendar_llamada", label: "Agendar llamada" },
              { value: "link_de_pago",    label: "Link de pago" },
              { value: "recolectar_email", label: "Recolectar email" },
              { value: "calificar",        label: "Solo calificar" },
              { value: "otro",             label: "Otro" },
            ]}
          />
        </div>

        <div>
          <FieldLabel hint="Mensaje final o CTA que manda el agente cuando el lead está listo">
            Mensaje de cierre / CTA
          </FieldLabel>
          <Textarea
            value={ctaMessage}
            onChange={(e) => setCtaMessage(e.target.value)}
            rows={3}
            placeholder="Perfecto! Te mando el link para agendar tu sesión ahora: ..."
          />
        </div>
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 6 Límites ───────────────────────────────────────────── */}
      <Section icon={ShieldOff} title="Límites y restricciones">
        <div>
          <FieldLabel hint="Temas que el agente debe ignorar o derivar">
            Temas prohibidos
          </FieldLabel>
          <Textarea
            value={forbiddenTopics}
            onChange={(e) => setForbiddenTopics(e.target.value)}
            rows={2}
            placeholder="Política, competidores, precios de otros, información personal..."
          />
        </div>

        <div>
          <FieldLabel>Si preguntan el precio</FieldLabel>
          <Chips
            value={priceHandling}
            onChange={setPriceHandling}
            options={[
              { value: "responder", label: "Responder directamente" },
              { value: "escalar",   label: "Escalar a humano" },
              { value: "rango",     label: "Dar solo rango" },
            ]}
          />
        </div>

        <div>
          <FieldLabel>Frases o palabras prohibidas</FieldLabel>
          <Input
            value={forbiddenPhrases}
            onChange={(e) => setForbiddenPhrases(e.target.value)}
            placeholder="gratis, garantía, lo más barato..."
          />
        </div>
      </Section>

      <div className="border-t border-white/[0.06]" />

      {/* ── 7 Integraciones ─────────────────────────────────────── */}
      <Section icon={Plug} title="Integraciones">
        <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
          <div>
            <p className="text-xs font-medium">Booking / Agenda</p>
            <p className="text-[11px] text-white/35">El agente puede ofrecer agendar una llamada</p>
          </div>
          <Switch checked={bookingEnabled} onCheckedChange={setBookingEnabled} />
        </div>

        {bookingEnabled && (
          <div className="space-y-3 rounded-xl border border-white/10 p-4">
            <div>
              <FieldLabel>Proveedor</FieldLabel>
              <Chips
                value={calendarProvider}
                onChange={setCalendarProvider}
                options={[
                  { value: "calendly",         label: "Calendly" },
                  { value: "google_calendar",   label: "Google Calendar" },
                  { value: "cal_com",           label: "Cal.com" },
                ]}
              />
            </div>
            <div>
              <FieldLabel hint="El agente enviará este link cuando el lead quiera agendar">
                URL de booking
              </FieldLabel>
              <Input
                value={calendlyUrl}
                onChange={(e) => setCalendlyUrl(e.target.value)}
                placeholder="https://calendly.com/tu-usuario/30min"
              />
            </div>
          </div>
        )}

        <div>
          <FieldLabel hint="Webhook para guardar leads en CRM o Google Sheets (POST con datos del lead)">
            CRM / Google Sheets webhook
          </FieldLabel>
          <Input
            value={crmWebhookUrl}
            onChange={(e) => setCrmWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/..."
          />
        </div>
      </Section>

      {/* ── Save ────────────────────────────────────────────────── */}
      <div className="sticky bottom-6 flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-[#e36887] text-white hover:bg-[#e36887]/80"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-[#f3d98f]">
            <Check className="size-3.5" /> Guardado
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

// ── DynamicList ───────────────────────────────────────────────────────────────

function DynamicList<T>({
  label,
  hint,
  items,
  onAdd,
  onRemove,
  renderItem,
}: {
  label: string;
  hint?: string;
  items: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  renderItem: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {items.map((item, i) => (
        <div key={i} className="relative rounded-xl border border-white/10 p-3">
          {renderItem(item, i)}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-2 top-2 rounded-md p-1 text-white/30 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        <Plus className="size-3.5" /> Agregar
      </button>
    </div>
  );
}
