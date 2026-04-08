-- Extensions (run in Supabase SQL editor if needed)
-- create extension if not exists "pgcrypto";

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid references auth.users (id) on delete cascade,
  plan text not null default 'trial',
  dodo_subscription_id text,
  dodo_customer_id text,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table public.meta_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null,
  meta_user_id text not null,
  page_id text,
  page_name text,
  access_token text not null,
  token_expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  agent_name text not null default 'Assistant',
  business_name text not null,
  business_description text,
  tone text not null default 'professional',
  language text not null default 'en',
  faqs jsonb default '[]'::jsonb,
  qualification_questions jsonb default '[]'::jsonb,
  booking_enabled boolean default true,
  calendar_provider text,
  calendar_config jsonb default '{}'::jsonb,
  handoff_threshold int default 3,
  system_prompt_override text,
  updated_at timestamptz default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meta_account_id uuid references public.meta_accounts (id),
  meta_user_id text not null,
  name text,
  username text,
  profile_picture_url text,
  status text not null default 'new',
  qualification_data jsonb default '{}'::jsonb,
  estimated_value numeric(10, 2),
  notes text,
  assigned_to uuid references auth.users (id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  meta_thread_id text not null,
  is_ai_active boolean default true,
  last_message_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz default now(),
  unique (organization_id, meta_thread_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null,
  sender text not null,
  content text not null,
  meta_message_id text,
  sent_at timestamptz default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id),
  conversation_id uuid references public.conversations (id),
  calendar_event_id text,
  booking_url text,
  scheduled_at timestamptz,
  duration_minutes int default 30,
  status text default 'scheduled',
  revenue_attributed numeric(10, 2),
  created_at timestamptz default now()
);

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger text not null,
  is_active boolean default true,
  steps jsonb not null default '[]'::jsonb
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  source text not null,
  source_meta jsonb default '{}'::jsonb,
  message_template text not null,
  status text default 'draft',
  sent_count int default 0,
  reply_count int default 0,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  date date not null,
  conversations_started int default 0,
  leads_qualified int default 0,
  meetings_booked int default 0,
  revenue_attributed numeric(10, 2) default 0,
  messages_sent int default 0,
  handoffs_to_human int default 0,
  unique (organization_id, date)
);

-- Indexes
create index idx_org_members_user on public.org_members (user_id);
create index idx_org_members_org on public.org_members (organization_id);
create index idx_meta_accounts_org on public.meta_accounts (organization_id);
create index idx_leads_org on public.leads (organization_id);
create unique index leads_org_meta_user_unique on public.leads (organization_id, meta_user_id);
create index idx_leads_status on public.leads (organization_id, status);
create index idx_conversations_org on public.conversations (organization_id);
create index idx_messages_conversation on public.messages (conversation_id, sent_at desc);
create index idx_messages_meta_id on public.messages (meta_message_id) where meta_message_id is not null;
create index idx_meetings_org on public.meetings (organization_id);
create index idx_sequences_org on public.sequences (organization_id);
create index idx_campaigns_org on public.campaigns (organization_id);
create index idx_analytics_org_date on public.analytics_daily (organization_id, date desc);

-- Resolve current user's organization (owner or member)
create or replace function public.get_my_org_id ()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select organization_id from public.org_members where user_id = auth.uid () limit 1),
    (select id from public.organizations where owner_id = auth.uid () limit 1)
  );
$$;

grant execute on function public.get_my_org_id () to authenticated;
grant execute on function public.get_my_org_id () to service_role;

-- RLS
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.meta_accounts enable row level security;
alter table public.agent_configs enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.meetings enable row level security;
alter table public.sequences enable row level security;
alter table public.campaigns enable row level security;
alter table public.analytics_daily enable row level security;

-- organizations
create policy organizations_select on public.organizations for select using (
  id = public.get_my_org_id () or owner_id = auth.uid ()
);

create policy organizations_update on public.organizations for update using (
  id = public.get_my_org_id () and owner_id = auth.uid ()
);

create policy organizations_insert on public.organizations for insert with check (owner_id = auth.uid ());

-- org_members
create policy org_members_all on public.org_members for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

-- Tenant tables: same pattern
create policy meta_accounts_all on public.meta_accounts for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy agent_configs_all on public.agent_configs for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy leads_all on public.leads for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy conversations_all on public.conversations for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy messages_all on public.messages for all using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.organization_id = public.get_my_org_id ()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.organization_id = public.get_my_org_id ()
  )
);

create policy meetings_all on public.meetings for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy sequences_all on public.sequences for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy campaigns_all on public.campaigns for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

create policy analytics_daily_all on public.analytics_daily for all using (
  organization_id = public.get_my_org_id ()
)
with check (organization_id = public.get_my_org_id ());

-- Realtime: replication for messages/conversations (enable in dashboard UI or SQL)
-- alter publication supabase_realtime add table public.messages;
-- alter publication supabase_realtime add table public.conversations;

-- pg_cron: schedule in Supabase dashboard — e.g. hourly call to Edge Function URL for sequences
