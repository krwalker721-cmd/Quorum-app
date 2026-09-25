-- ---------------------------------------------------------------------------
-- 019 — Hackathon team rooms and the Sprint lobby
--
-- Each team gets a private room shaped like a Collab Board project room
-- (thread, docs, links, votes) so the room UI can be shared. The tables are
-- the Sprint's own; nothing here touches the Collab Board.
--
-- Rooms are SEALED: only the team's members (and admins) can read them, before,
-- during and after the reveal. Judges never get room access; they judge the
-- submission (020).
--
-- Who can write, and when:
--  * Team rooms: the team's members, from the moment the team exists until the
--    reveal, while the Sprint isn't paused or cancelled. After the reveal the
--    room is a read-only archive for its members.
--  * Lobby: the Sprint's participants, accepted judges and admins, until
--    lobby_closes_at (if set). It stays writable during a pause, so people
--    can talk; it turns read-only on cancel. After the reveal, a participant
--    needs to be an active member to keep posting (they can still read).
--  * Registered participants keep their room and lobby access through the
--    reveal even if their trial or subscription ends mid-Sprint.
--
-- Messages are soft-deleted: deleting blanks the text and keeps the row, so
-- the thread's shape survives and nothing deleted can be read back.
--
-- RUN AFTER 018. Idempotent.
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Tables
-- ============================================================================
create table if not exists public.hackathon_team_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.hackathon_teams(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  body       text not null default '',
  -- "Alice added a doc: …", written by triggers, as in the Collab room.
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz,
  constraint hackathon_team_messages_body check (
    deleted_at is not null or char_length(btrim(body)) between 1 and 4000
  )
);
create index if not exists hackathon_team_messages_team_idx
  on public.hackathon_team_messages (team_id, created_at);

create table if not exists public.hackathon_team_docs (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.hackathon_teams(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  content    text not null default '' check (char_length(content) <= 100000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hackathon_team_docs_team_idx
  on public.hackathon_team_docs (team_id, created_at desc);

create table if not exists public.hackathon_team_links (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.hackathon_teams(id) on delete cascade,
  url        text not null check (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2000),
  label      text check (label is null or char_length(label) <= 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hackathon_team_links_team_idx
  on public.hackathon_team_links (team_id, created_at desc);

-- Votes mirror the Collab Board's decisions: the options are a jsonb array of
-- strings on the vote, and each member's ballot names one of them. Unlike the
-- Collab room, closing is done here in the database: once every current member
-- has voted, the vote is decided (ties go to the option listed first).
create table if not exists public.hackathon_team_votes (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.hackathon_teams(id) on delete cascade,
  created_by     uuid references public.profiles(id) on delete set null,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  description    text check (description is null or char_length(description) <= 2000),
  options        jsonb not null check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10
  ),
  status         text not null default 'open' check (status in ('open', 'decided')),
  winning_option text,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);
create index if not exists hackathon_team_votes_team_idx
  on public.hackathon_team_votes (team_id, created_at desc);

create table if not exists public.hackathon_team_ballots (
  id            uuid primary key default gen_random_uuid(),
  vote_id       uuid not null references public.hackathon_team_votes(id) on delete cascade,
  -- Copied from the vote by trigger, so the policies need no join.
  team_id       uuid not null references public.hackathon_teams(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  option_chosen text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (vote_id, user_id)
);
create index if not exists hackathon_team_ballots_team_idx
  on public.hackathon_team_ballots (team_id);

create table if not exists public.hackathon_lobby_messages (
  id           uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  -- null for system messages (paused / resumed / cancelled)
  user_id      uuid references public.profiles(id) on delete set null,
  body         text not null default '',
  is_system    boolean not null default false,
  is_pinned    boolean not null default false,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  constraint hackathon_lobby_messages_body check (
    deleted_at is not null or char_length(btrim(body)) between 1 and 4000
  )
);
create index if not exists hackathon_lobby_messages_hackathon_idx
  on public.hackathon_lobby_messages (hackathon_id, created_at);

-- ============================================================================
-- Access helpers
-- ============================================================================

create or replace function private.can_read_team_room(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_team_member(p_team_id, uid) or private.is_admin(uid)
$$;

create or replace function private.can_write_team_room(p_team_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_team_member(p_team_id, uid)
    and private.hackathon_writable(h.id)
    and private.hackathon_phase(h.id) in ('registration', 'teams_locked', 'live', 'judging')
  from (select private.team_hackathon_id(p_team_id) as id) h
$$;

create or replace function private.can_read_lobby(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_admin(uid)
    or (
      coalesce((select h.is_published from public.hackathons h where h.id = p_hackathon_id), false)
      and (private.is_participant(p_hackathon_id, uid) or private.is_judge(p_hackathon_id, uid))
    )
$$;

create or replace function private.can_write_lobby(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select h.is_published
      and h.status_override is distinct from 'cancelled'
      and (h.lobby_closes_at is null or now() < h.lobby_closes_at)
      and (
        private.is_admin(uid)
        or private.is_judge(h.id, uid)
        or (
          private.is_participant(h.id, uid)
          and (private.hackathon_phase(h.id) <> 'revealed' or private.is_active_member(uid))
        )
      )
    from public.hackathons h
    where h.id = p_hackathon_id
  ), false)
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Chat messages (team thread and lobby). For a member's request: the author,
-- room and timestamps are fixed; only the text can be edited, by its author;
-- deleting blanks it for good. In the lobby, only an admin can pin, and an
-- admin can delete anyone's message.
create or replace function private.hackathon_chat_message_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  admin boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' and new.deleted_at is not null then
      new.body := '';
    end if;
    return new;
  end if;

  admin := private.is_admin(auth.uid());

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.edited_at := null;
    new.deleted_at := null;
    new.is_system := false;
    if tg_table_name = 'hackathon_lobby_messages' and not admin then
      new.is_pinned := false;
    end if;
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.is_system := old.is_system;
  new.created_at := old.created_at;
  if tg_table_name = 'hackathon_team_messages' then
    new.team_id := old.team_id;
  else
    new.hackathon_id := old.hackathon_id;
    if not admin then
      new.is_pinned := old.is_pinned;
    end if;
  end if;

  if old.deleted_at is not null then
    raise exception 'This message was deleted.' using hint = 'message_deleted';
  end if;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
    new.edited_at := old.edited_at;
  elsif new.body is distinct from old.body then
    if old.user_id is distinct from auth.uid() then
      raise exception 'You can only edit your own messages.' using errcode = '42501';
    end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;

drop trigger if exists hackathon_team_messages_guard_trigger on public.hackathon_team_messages;
create trigger hackathon_team_messages_guard_trigger
  before insert or update on public.hackathon_team_messages
  for each row execute function private.hackathon_chat_message_guard();

drop trigger if exists hackathon_lobby_messages_guard_trigger on public.hackathon_lobby_messages;
create trigger hackathon_lobby_messages_guard_trigger
  before insert or update on public.hackathon_lobby_messages
  for each row execute function private.hackathon_chat_message_guard();

-- Docs are shared: any member may edit. Who wrote and last edited it is the
-- system's to record.
create or replace function private.hackathon_team_docs_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.team_id := old.team_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      new.created_at := now();
    end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists hackathon_team_docs_guard_trigger on public.hackathon_team_docs;
create trigger hackathon_team_docs_guard_trigger
  before insert or update on public.hackathon_team_docs
  for each row execute function private.hackathon_team_docs_guard();

create or replace function private.hackathon_team_links_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.url := btrim(new.url);
  if current_user in ('anon', 'authenticated') then
    new.created_by := auth.uid();
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists hackathon_team_links_guard_trigger on public.hackathon_team_links;
create trigger hackathon_team_links_guard_trigger
  before insert on public.hackathon_team_links
  for each row execute function private.hackathon_team_links_guard();

-- Votes open as 'open' with trimmed, distinct, non-empty options.
create or replace function private.hackathon_team_votes_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from jsonb_array_elements(new.options) e
    where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = ''
  ) then
    raise exception 'Each option needs some text.' using hint = 'bad_options';
  end if;
  new.options := (
    select jsonb_agg(btrim(e #>> '{}') order by ord)
    from jsonb_array_elements(new.options) with ordinality as t(e, ord)
  );
  if (select count(distinct e) from jsonb_array_elements_text(new.options) e)
     <> jsonb_array_length(new.options) then
    raise exception 'Options must all be different.' using hint = 'bad_options';
  end if;
  if current_user in ('anon', 'authenticated') then
    new.created_by := auth.uid();
    new.created_at := now();
    new.status := 'open';
    new.winning_option := null;
    new.decided_at := null;
  end if;
  return new;
end $$;

drop trigger if exists hackathon_team_votes_guard_trigger on public.hackathon_team_votes;
create trigger hackathon_team_votes_guard_trigger
  before insert on public.hackathon_team_votes
  for each row execute function private.hackathon_team_votes_guard();

-- Ballots: pinned to their vote's team, only on an open vote, only for one of
-- its options.
create or replace function private.hackathon_team_ballots_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.hackathon_team_votes%rowtype;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.vote_id := old.vote_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();

  select * into v from public.hackathon_team_votes where id = new.vote_id;
  if not found then
    raise exception 'That vote doesn''t exist.';
  end if;
  new.team_id := v.team_id;
  if v.status <> 'open' then
    raise exception 'This vote is closed.' using hint = 'vote_closed';
  end if;
  if not jsonb_exists(v.options, new.option_chosen) then
    raise exception 'That isn''t one of the options.' using hint = 'bad_option';
  end if;
  return new;
end $$;

drop trigger if exists hackathon_team_ballots_guard_trigger on public.hackathon_team_ballots;
create trigger hackathon_team_ballots_guard_trigger
  before insert or update on public.hackathon_team_ballots
  for each row execute function private.hackathon_team_ballots_guard();

create or replace function private.hackathon_team_ballots_close_vote()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_winner text;
begin
  if exists (
    select 1 from public.hackathon_team_members m
    where m.team_id = new.team_id
      and not exists (
        select 1 from public.hackathon_team_ballots b
        where b.vote_id = new.vote_id and b.user_id = m.user_id
      )
  ) then
    return null;
  end if;

  select o.value into v_winner
  from public.hackathon_team_votes v
  cross join lateral jsonb_array_elements_text(v.options) with ordinality as o(value, ord)
  left join public.hackathon_team_ballots b on b.vote_id = v.id and b.option_chosen = o.value
  where v.id = new.vote_id
  group by o.value, o.ord
  order by count(b.id) desc, o.ord
  limit 1;

  update public.hackathon_team_votes
  set status = 'decided', winning_option = v_winner, decided_at = now()
  where id = new.vote_id and status = 'open';
  return null;
end $$;

drop trigger if exists hackathon_team_ballots_close_vote_trigger on public.hackathon_team_ballots;
create trigger hackathon_team_ballots_close_vote_trigger
  after insert or update on public.hackathon_team_ballots
  for each row execute function private.hackathon_team_ballots_close_vote();

-- System lines in the team thread, as the Collab room does for docs and
-- decisions.
create or replace function private.hackathon_team_room_system_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := new.created_by;
  v_name text;
  v_body text;
begin
  select coalesce(nullif(btrim(p.full_name), ''), p.username) into v_name
  from public.profiles p where p.id = v_actor;
  v_name := coalesce(v_name, 'Someone');

  if tg_table_name = 'hackathon_team_docs' then
    v_body := v_name || ' added a doc: ' || new.title;
  elsif tg_table_name = 'hackathon_team_links' then
    v_body := v_name || ' added a link: ' || coalesce(nullif(btrim(new.label), ''), new.url);
  else
    v_body := v_name || ' opened a vote: ' || new.title;
  end if;

  insert into public.hackathon_team_messages (team_id, user_id, body, is_system)
  values (new.team_id, v_actor, left(v_body, 4000), true);
  return null;
end $$;

drop trigger if exists hackathon_team_docs_system_message_trigger on public.hackathon_team_docs;
create trigger hackathon_team_docs_system_message_trigger
  after insert on public.hackathon_team_docs
  for each row execute function private.hackathon_team_room_system_message();

drop trigger if exists hackathon_team_links_system_message_trigger on public.hackathon_team_links;
create trigger hackathon_team_links_system_message_trigger
  after insert on public.hackathon_team_links
  for each row execute function private.hackathon_team_room_system_message();

drop trigger if exists hackathon_team_votes_system_message_trigger on public.hackathon_team_votes;
create trigger hackathon_team_votes_system_message_trigger
  after insert on public.hackathon_team_votes
  for each row execute function private.hackathon_team_room_system_message();

-- "2 h 14 min", for the resume message.
create or replace function private.format_duration(d interval)
returns text language sql immutable as $$
  select case
    when m / 60 > 0 and m % 60 > 0 then (m / 60)::text || ' h ' || (m % 60)::text || ' min'
    when m / 60 > 0 then (m / 60)::text || ' h'
    else greatest(m, 1)::text || ' min'
  end
  from (select floor(extract(epoch from d) / 60)::bigint as m) x
$$;

-- Pausing, resuming and cancelling announce themselves in the lobby.
create or replace function private.hackathons_announce_override()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_body text;
  v_shift text := nullif(current_setting('hackathon.resume_shift', true), '');
begin
  if new.status_override is not distinct from old.status_override then
    return null;
  end if;

  if new.status_override = 'paused' then
    v_body := 'The Sprint is paused. Team rooms and submissions are frozen until it resumes. The lobby stays open.';
  elsif new.status_override = 'cancelled' then
    v_body := 'This Sprint has been cancelled. The lobby is now read-only.';
  else
    v_body := 'The Sprint has resumed.';
    if v_shift is not null and v_shift::interval > interval '0' then
      v_body := v_body || ' Every deadline still ahead moved '
        || private.format_duration(v_shift::interval) || ' later to make up for the pause.';
    end if;
    perform set_config('hackathon.resume_shift', '', true);
  end if;

  insert into public.hackathon_lobby_messages (hackathon_id, user_id, body, is_system)
  values (new.id, null, v_body, true);
  return null;
end $$;

drop trigger if exists hackathons_announce_override_trigger on public.hackathons;
create trigger hackathons_announce_override_trigger
  after update of status_override on public.hackathons
  for each row execute function private.hackathons_announce_override();

-- ============================================================================
-- Row level security
-- ============================================================================
alter table public.hackathon_team_messages enable row level security;
alter table public.hackathon_team_docs enable row level security;
alter table public.hackathon_team_links enable row level security;
alter table public.hackathon_team_votes enable row level security;
alter table public.hackathon_team_ballots enable row level security;
alter table public.hackathon_lobby_messages enable row level security;

-- Team thread
drop policy if exists "hackathon_team_messages_read" on public.hackathon_team_messages;
create policy "hackathon_team_messages_read"
  on public.hackathon_team_messages for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_messages_insert" on public.hackathon_team_messages;
create policy "hackathon_team_messages_insert"
  on public.hackathon_team_messages for insert to authenticated
  with check (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_messages_update_own" on public.hackathon_team_messages;
create policy "hackathon_team_messages_update_own"
  on public.hackathon_team_messages for update to authenticated
  using (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()))
  with check (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

-- Docs
drop policy if exists "hackathon_team_docs_read" on public.hackathon_team_docs;
create policy "hackathon_team_docs_read"
  on public.hackathon_team_docs for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_docs_insert" on public.hackathon_team_docs;
create policy "hackathon_team_docs_insert"
  on public.hackathon_team_docs for insert to authenticated
  with check (created_by = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_docs_update" on public.hackathon_team_docs;
create policy "hackathon_team_docs_update"
  on public.hackathon_team_docs for update to authenticated
  using (private.can_write_team_room(team_id, auth.uid()))
  with check (private.can_write_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_docs_delete_own" on public.hackathon_team_docs;
create policy "hackathon_team_docs_delete_own"
  on public.hackathon_team_docs for delete to authenticated
  using (created_by = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

-- Links
drop policy if exists "hackathon_team_links_read" on public.hackathon_team_links;
create policy "hackathon_team_links_read"
  on public.hackathon_team_links for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_links_insert" on public.hackathon_team_links;
create policy "hackathon_team_links_insert"
  on public.hackathon_team_links for insert to authenticated
  with check (created_by = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_links_delete_own" on public.hackathon_team_links;
create policy "hackathon_team_links_delete_own"
  on public.hackathon_team_links for delete to authenticated
  using (created_by = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

-- Votes: opened by members; closed only by the ballot trigger.
drop policy if exists "hackathon_team_votes_read" on public.hackathon_team_votes;
create policy "hackathon_team_votes_read"
  on public.hackathon_team_votes for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_votes_insert" on public.hackathon_team_votes;
create policy "hackathon_team_votes_insert"
  on public.hackathon_team_votes for insert to authenticated
  with check (created_by = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

-- Ballots: your own, changeable while the vote is open.
drop policy if exists "hackathon_team_ballots_read" on public.hackathon_team_ballots;
create policy "hackathon_team_ballots_read"
  on public.hackathon_team_ballots for select to authenticated
  using (private.can_read_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_ballots_insert_own" on public.hackathon_team_ballots;
create policy "hackathon_team_ballots_insert_own"
  on public.hackathon_team_ballots for insert to authenticated
  with check (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

drop policy if exists "hackathon_team_ballots_update_own" on public.hackathon_team_ballots;
create policy "hackathon_team_ballots_update_own"
  on public.hackathon_team_ballots for update to authenticated
  using (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()))
  with check (user_id = auth.uid() and private.can_write_team_room(team_id, auth.uid()));

-- Lobby
drop policy if exists "hackathon_lobby_messages_read" on public.hackathon_lobby_messages;
create policy "hackathon_lobby_messages_read"
  on public.hackathon_lobby_messages for select to authenticated
  using (private.can_read_lobby(hackathon_id, auth.uid()));

drop policy if exists "hackathon_lobby_messages_insert" on public.hackathon_lobby_messages;
create policy "hackathon_lobby_messages_insert"
  on public.hackathon_lobby_messages for insert to authenticated
  with check (user_id = auth.uid() and private.can_write_lobby(hackathon_id, auth.uid()));

-- Authors edit or delete their own while the lobby is open; admins can pin
-- or remove anything, even after it closes.
drop policy if exists "hackathon_lobby_messages_update" on public.hackathon_lobby_messages;
create policy "hackathon_lobby_messages_update"
  on public.hackathon_lobby_messages for update to authenticated
  using (
    (user_id = auth.uid() and private.can_write_lobby(hackathon_id, auth.uid()))
    or private.is_admin(auth.uid())
  )
  with check (
    (user_id = auth.uid() and private.can_write_lobby(hackathon_id, auth.uid()))
    or private.is_admin(auth.uid())
  );

-- ============================================================================
-- Grants and realtime
-- ============================================================================
grant execute on all functions in schema private to anon, authenticated, service_role;

do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_docs;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_links;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_votes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_team_ballots;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.hackathon_lobby_messages;
exception when duplicate_object then null;
end $$;
