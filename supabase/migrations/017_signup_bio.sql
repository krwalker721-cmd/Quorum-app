-- ---------------------------------------------------------------------------
-- 017 — bio at signup
--
-- Onboarding, now retired, was the only place a member wrote a bio. The signup
-- form asks for it instead, as optional user metadata, and handle_new_user()
-- copies it onto the profile alongside the other signup fields. Capped at 280
-- characters to match the form.
--
-- Everything else is identical to the 014 definition. Safe in either order
-- with the deploy: until this runs, the function just ignores the bio key.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display_name text := nullif(trim(coalesce(meta->>'full_name', '')), '');
  claimed_stage text := meta->>'stage';
begin
  insert into public.profiles (
    id, full_name, email, what_they_are_building, stage, bio, status, username
  )
  values (
    new.id,
    display_name,
    new.email,
    nullif(trim(coalesce(meta->>'what_they_are_building', '')), ''),
    case when claimed_stage in ('idea','pre-seed','seed','series_a')
         then claimed_stage else 'idea' end,
    left(nullif(trim(coalesce(meta->>'bio', '')), ''), 280),
    'pending',
    public.generate_username(display_name, new.id)
  )
  on conflict (id) do nothing;

  return new;
end; $$;
