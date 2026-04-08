-- Webhooks with object "page" send Facebook Page ID in entry.id; we store IG id in page_id.
alter table public.meta_accounts
  add column if not exists facebook_page_id text;

create index if not exists idx_meta_accounts_facebook_page_id
  on public.meta_accounts (facebook_page_id)
  where facebook_page_id is not null;

comment on column public.meta_accounts.facebook_page_id is
  'Facebook Page ID when connected via Facebook OAuth; used to match Page webhooks.';
