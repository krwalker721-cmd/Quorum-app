-- DELETE policies for user-removable content.

alter table public.posts enable row level security;
drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

-- Notes already use `notes_all_own` (FOR ALL using user_id), but add an
-- explicit named delete policy too for installs that ran from spec.
drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Projects use `projects_write_owner` (FOR ALL using owner_id) which covers
-- DELETE — alias under the spec name. NB: schema uses owner_id; the user
-- prompt mentioned author_id which doesn't exist on the projects table.
drop policy if exists "Creators can delete own projects" on public.projects;
create policy "Creators can delete own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);
