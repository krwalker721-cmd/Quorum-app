-- Ensure messages are completely private:
-- - SELECT only when user is sender or recipient
-- - INSERT only when user is the sender
-- - UPDATE only when user is the recipient (used for read-receipts)
--
-- Drop any prior policy names so this is idempotent against installs created
-- from supabase/schema.sql (which used different policy names).

drop policy if exists "Users can view their own messages" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can update read status" on public.messages;
drop policy if exists "messages_read_party" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "messages_update_recipient" on public.messages;

alter table public.messages enable row level security;

create policy "Users can view their own messages" on public.messages
  for select using (
    auth.uid() = sender_id or auth.uid() = recipient_id
  );

create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

create policy "Users can update read status" on public.messages
  for update using (auth.uid() = recipient_id);
