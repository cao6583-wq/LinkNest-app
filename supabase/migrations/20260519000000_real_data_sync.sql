drop policy if exists "Borrow participants can read requested books" on public.books;

create policy "Borrow participants can read requested books"
on public.books for select
using (
  exists (
    select 1
    from public.borrow_requests br
    where br.book_id = books.id
      and (br.borrower_id = auth.uid() or br.lender_id = auth.uid())
  )
);

create or replace function public.sync_book_status_from_borrow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'accepted') then
    update public.books
    set status = 'pending'
    where id = new.book_id
      and status <> 'hidden';
  elsif new.status in ('borrowed', 'return_requested') then
    update public.books
    set status = 'borrowed'
    where id = new.book_id
      and status <> 'hidden';
  elsif new.status in ('returned', 'rejected', 'canceled') then
    if not exists (
      select 1
      from public.borrow_requests br
      where br.book_id = new.book_id
        and br.id <> new.id
        and br.status in ('pending', 'accepted', 'borrowed', 'return_requested')
    ) then
      update public.books
      set status = 'available'
      where id = new.book_id
        and status <> 'hidden';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists borrow_requests_sync_book_status on public.borrow_requests;

create trigger borrow_requests_sync_book_status
after insert or update of status on public.borrow_requests
for each row execute function public.sync_book_status_from_borrow_request();
