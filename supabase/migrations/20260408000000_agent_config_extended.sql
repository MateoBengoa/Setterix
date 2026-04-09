-- Extended agent configuration fields
ALTER TABLE public.agent_configs
  ADD COLUMN IF NOT EXISTS identity_mode      text    DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS emoji_usage        text    DEFAULT 'poco',
  ADD COLUMN IF NOT EXISTS message_length     text    DEFAULT 'medios',
  ADD COLUMN IF NOT EXISTS use_exclamations   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS catchphrases       text,
  ADD COLUMN IF NOT EXISTS writing_examples   text,
  ADD COLUMN IF NOT EXISTS welcome_message    text,
  ADD COLUMN IF NOT EXISTS operating_hours    text    DEFAULT '24/7',
  ADD COLUMN IF NOT EXISTS main_goal          text    DEFAULT 'agendar_llamada',
  ADD COLUMN IF NOT EXISTS cta_message        text,
  ADD COLUMN IF NOT EXISTS forbidden_topics   text,
  ADD COLUMN IF NOT EXISTS price_handling     text    DEFAULT 'responder',
  ADD COLUMN IF NOT EXISTS forbidden_phrases  text,
  ADD COLUMN IF NOT EXISTS calendly_url       text,
  ADD COLUMN IF NOT EXISTS crm_webhook_url    text,
  ADD COLUMN IF NOT EXISTS objections         jsonb   DEFAULT '[]'::jsonb;
