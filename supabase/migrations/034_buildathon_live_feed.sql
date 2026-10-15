-- ---------------------------------------------------------------------------
-- 034 — The Sprint's feed: the lobby, readable by every member
--
-- The lobby stops being its own page and becomes the feed on the Sprint page
-- (owner, 2026-10-14). Every active member can now READ it, so a member who
-- isn't in the Sprint can follow along; who can POST is unchanged
-- (participants, accepted judges, admins: private.can_write_lobby, 019).
--
-- private.can_read_lobby (019) also gates hackathon_lobby_welcome (the pinned
-- welcome note) and hackathon_lobby_people (names and teams of the people in
-- it, 029), so both follow. Nothing in the lobby is sealed: teams keep their
-- work in their own rooms.
--
-- Still not readable: drafts (unpublished Sprints, except by admins), signed-
-- out visitors, and lapsed members who aren't in the Sprint.
--
-- RUN AFTER 033. Idempotent.
-- ---------------------------------------------------------------------------

create or replace function private.can_read_lobby(p_hackathon_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_admin(uid)
    or (
      coalesce((select h.is_published from public.hackathons h where h.id = p_hackathon_id), false)
      and (
        private.is_participant(p_hackathon_id, uid)
        or private.is_judge(p_hackathon_id, uid)
        or private.is_active_member(uid)
      )
    )
$$;
