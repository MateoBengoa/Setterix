-- Distinguish Instagram Login (graph.instagram.com) vs Facebook Page token (graph.facebook.com)
alter table public.meta_accounts
  add column if not exists oauth_provider text;

comment on column public.meta_accounts.oauth_provider is
  'instagram = Instagram Login user token. facebook = Facebook Login page token. null = legacy/manual.';
