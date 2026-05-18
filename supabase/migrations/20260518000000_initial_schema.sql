create extension if not exists "pgcrypto";
create extension if not exists "postgis";

create type public.privacy_level as enum ('public', 'friends', 'private');
create type public.book_condition as enum ('new', 'like_new', 'good', 'fair');
create type public.book_status as enum ('available', 'pending', 'borrowed', 'hidden');
create type public.borrow_status as enum ('pending', 'accepted', 'borrowed', 'return_requested', 'returned', 'rejected', 'canceled');
create type public.friendship_status as enum ('pending', 'accepted', 'rejected', 'blocked');
create type public.conversation_type as enum ('direct', 'borrow');
create type public.message_type as enum ('text', 'system', 'borrow_card');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  home_lat double precision,
  home_lng double precision,
  visible_radius_km numeric not null default 3 check (visible_radius_km > 0 and visible_radius_km <= 50),
  privacy_level public.privacy_level not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  author text not null,
  isbn text,
  cover_url text,
  description text,
  category text not null default '未分类',
  language text not null default '中文',
  condition public.book_condition not null default 'good',
  publish_year integer check (publish_year is null or publish_year between 1400 and 2200),
  status public.book_status not null default 'available',
  location_lat double precision,
  location_lng double precision,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, '') || ' ' || coalesce(category, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  lender_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status public.borrow_status not null default 'pending',
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  borrowed_at timestamptz,
  returned_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint borrow_requests_not_self check (borrower_id <> lender_id)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> receiver_id),
  constraint friendships_unique_pair unique (requester_id, receiver_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null default 'direct',
  borrow_request_id uuid references public.borrow_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  type public.message_type not null default 'text',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  borrow_request_id uuid not null references public.borrow_requests(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_not_self check (reviewer_id <> reviewee_id),
  constraint reviews_one_per_borrow unique (reviewer_id, borrow_request_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_unique unique (user_id, book_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  reason text not null check (reason in ('spam', 'unsafe', 'inappropriate', 'copyright', 'other')),
  detail text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_has_target check (reported_user_id is not null or book_id is not null)
);

create index books_owner_id_idx on public.books(owner_id);
create index books_status_idx on public.books(status);
create index books_search_idx on public.books using gin(search_vector);
create index books_location_idx
on public.books
using gist(st_setsrid(st_makepoint(location_lng, location_lat), 4326))
where location_lat is not null and location_lng is not null;
create index borrow_requests_borrower_idx on public.borrow_requests(borrower_id);
create index borrow_requests_lender_idx on public.borrow_requests(lender_id);
create index borrow_requests_book_idx on public.borrow_requests(book_id);
create index friendships_receiver_idx on public.friendships(receiver_id);
create index conversation_members_user_idx on public.conversation_members(user_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index favorites_user_idx on public.favorites(user_id);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_status_idx on public.reports(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create trigger borrow_requests_set_updated_at
before update on public.borrow_requests
for each row execute function public.set_updated_at();

create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), '新邻居'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.nearby_books(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision default 3
)
returns table (
  id uuid,
  owner_id uuid,
  title text,
  author text,
  isbn text,
  cover_url text,
  description text,
  category text,
  language text,
  condition public.book_condition,
  status public.book_status,
  publish_year integer,
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz,
  updated_at timestamptz,
  distance_km double precision
)
language sql
stable
as $$
  select
    b.id,
    b.owner_id,
    b.title,
    b.author,
    b.isbn,
    b.cover_url,
    b.description,
    b.category,
    b.language,
    b.condition,
    b.status,
    b.publish_year,
    b.location_lat,
    b.location_lng,
    b.created_at,
    b.updated_at,
    st_distance(
      st_setsrid(st_makepoint(b.location_lng, b.location_lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) / 1000 as distance_km
  from public.books b
  where b.status = 'available'
    and b.location_lat is not null
    and b.location_lng is not null
    and st_dwithin(
      st_setsrid(st_makepoint(b.location_lng, b.location_lat), 4326)::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  order by distance_km asc;
$$;

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.borrow_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;

create policy "Profiles are readable"
on public.profiles for select
using (true);

create policy "Users update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Available books are publicly readable"
on public.books for select
using (status = 'available' or auth.uid() = owner_id);

create policy "Users create their own books"
on public.books for insert
with check (auth.uid() = owner_id);

create policy "Users update their own books"
on public.books for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users delete their own books"
on public.books for delete
using (auth.uid() = owner_id);

create policy "Borrow participants can read requests"
on public.borrow_requests for select
using (auth.uid() = borrower_id or auth.uid() = lender_id);

create policy "Borrowers create requests"
on public.borrow_requests for insert
with check (auth.uid() = borrower_id);

create policy "Borrow participants update requests"
on public.borrow_requests for update
using (auth.uid() = borrower_id or auth.uid() = lender_id)
with check (auth.uid() = borrower_id or auth.uid() = lender_id);

create policy "Friendship participants can read"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "Users create outgoing friendship requests"
on public.friendships for insert
with check (auth.uid() = requester_id);

create policy "Friendship participants can update"
on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = receiver_id)
with check (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "Members can read conversations"
on public.conversations for select
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

create policy "Authenticated users create conversations"
on public.conversations for insert
with check (auth.uid() is not null);

create policy "Members can read conversation members"
on public.conversation_members for select
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Users can add themselves to conversations"
on public.conversation_members for insert
with check (auth.uid() = user_id);

create policy "Members can read messages"
on public.messages for select
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Members can send messages"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Reviews are readable"
on public.reviews for select
using (true);

create policy "Borrow participants create reviews"
on public.reviews for insert
with check (auth.uid() = reviewer_id);

create policy "Users read their favorites"
on public.favorites for select
using (auth.uid() = user_id);

create policy "Users create their favorites"
on public.favorites for insert
with check (auth.uid() = user_id);

create policy "Users delete their favorites"
on public.favorites for delete
using (auth.uid() = user_id);

create policy "Users create reports"
on public.reports for insert
with check (auth.uid() = reporter_id);

create policy "Users read their own reports"
on public.reports for select
using (auth.uid() = reporter_id);

insert into storage.buckets (id, name, public)
values
  ('book-covers', 'book-covers', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public can read book covers"
on storage.objects for select
using (bucket_id = 'book-covers');

create policy "Users upload book covers"
on storage.objects for insert
with check (
  bucket_id = 'book-covers'
  and auth.uid() is not null
);

create policy "Users update book covers"
on storage.objects for update
using (
  bucket_id = 'book-covers'
  and auth.uid() is not null
);

create policy "Public can read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users upload avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid() is not null
);
