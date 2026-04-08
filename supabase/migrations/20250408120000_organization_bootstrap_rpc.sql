-- Atomic org + owner membership + agent_config, bypassing RLS safely inside the function.
-- Still requires auth.uid() — you must have a valid session (disable email confirm for dev, or sign in after confirming).

create or replace function public.create_organization_with_owner (
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid ();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(p_name)) = 0 then
    raise exception 'Name required';
  end if;

  if length(trim(p_slug)) = 0 then
    raise exception 'Slug required';
  end if;

  insert into public.organizations (name, slug, owner_id, plan)
  values (trim(p_name), trim(p_slug), uid, 'trial')
  returning id into new_id;

  insert into public.org_members (organization_id, user_id, role)
  values (new_id, uid, 'owner');

  insert into public.agent_configs (organization_id, business_name, agent_name)
  values (new_id, trim(p_name), 'Assistant');

  return new_id;
end;
$$;

revoke all on function public.create_organization_with_owner (text, text) from public;
grant execute on function public.create_organization_with_owner (text, text) to authenticated;
grant execute on function public.create_organization_with_owner (text, text) to service_role;
