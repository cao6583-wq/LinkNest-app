create unique index if not exists conversations_borrow_request_unique_idx
on public.conversations(borrow_request_id)
where borrow_request_id is not null;

create or replace function public.create_borrow_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation_id uuid;
begin
  select id into target_conversation_id
  from public.conversations
  where borrow_request_id = new.id
  limit 1;

  if target_conversation_id is null then
    insert into public.conversations (type, borrow_request_id)
    values ('borrow', new.id)
    returning id into target_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (target_conversation_id, new.borrower_id),
    (target_conversation_id, new.lender_id)
  on conflict do nothing;

  if new.message is not null and btrim(new.message) <> '' and new.message not like 'LINKNEST_CHAT_V1:%' then
    insert into public.messages (
      conversation_id,
      sender_id,
      type,
      body,
      metadata,
      created_at
    )
    select
      target_conversation_id,
      new.borrower_id,
      'text',
      new.message,
      jsonb_build_object('borrow_request_id', new.id, 'source', 'borrow_request'),
      new.requested_at
    where not exists (
      select 1
      from public.messages m
      where m.conversation_id = target_conversation_id
        and m.metadata->>'source' = 'borrow_request'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists borrow_requests_create_conversation on public.borrow_requests;

create trigger borrow_requests_create_conversation
after insert on public.borrow_requests
for each row execute function public.create_borrow_conversation();

insert into public.conversations (type, borrow_request_id)
select 'borrow', br.id
from public.borrow_requests br
where not exists (
  select 1
  from public.conversations c
  where c.borrow_request_id = br.id
);

insert into public.conversation_members (conversation_id, user_id)
select c.id, member_id
from public.conversations c
join public.borrow_requests br on br.id = c.borrow_request_id
cross join lateral (
  values (br.borrower_id), (br.lender_id)
) as members(member_id)
on conflict do nothing;

insert into public.messages (
  conversation_id,
  sender_id,
  type,
  body,
  metadata,
  created_at
)
select
  c.id,
  br.borrower_id,
  'text',
  br.message,
  jsonb_build_object('borrow_request_id', br.id, 'source', 'borrow_request'),
  br.requested_at
from public.borrow_requests br
join public.conversations c on c.borrow_request_id = br.id
where br.message is not null
  and btrim(br.message) <> ''
  and br.message not like 'LINKNEST_CHAT_V1:%'
  and not exists (
    select 1
    from public.messages m
    where m.conversation_id = c.id
      and m.metadata->>'source' = 'borrow_request'
  );
