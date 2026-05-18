-- Development seed data for LinkNest.
--
-- Before running this file, create at least three test users in Supabase Auth,
-- then replace the UUID values below with their auth.users.id values.
--
-- Recommended test accounts:
-- alice@example.com
-- bob@example.com
-- carol@example.com

begin;

with seed_users as (
  select *
  from (
    values
      ('00000000-0000-0000-0000-000000000001'::uuid, 'Alice', '喜欢文学、童书和城市散步。周末通常方便交接。', 43.6532, -79.3832, 3, 'public'::public.privacy_level),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'Bob', '科幻和商业类读者，愿意交换书单。', 43.6568, -79.3806, 3, 'public'::public.privacy_level),
      ('00000000-0000-0000-0000-000000000003'::uuid, 'Carol', '家里有很多儿童读物，也欢迎邻居推荐。', 43.6486, -79.3817, 3, 'public'::public.privacy_level)
  ) as t(id, display_name, bio, home_lat, home_lng, visible_radius_km, privacy_level)
)
insert into public.profiles (
  id,
  display_name,
  bio,
  home_lat,
  home_lng,
  visible_radius_km,
  privacy_level
)
select
  id,
  display_name,
  bio,
  home_lat,
  home_lng,
  visible_radius_km,
  privacy_level
from seed_users
on conflict (id) do update set
  display_name = excluded.display_name,
  bio = excluded.bio,
  home_lat = excluded.home_lat,
  home_lng = excluded.home_lng,
  visible_radius_km = excluded.visible_radius_km,
  privacy_level = excluded.privacy_level;

with seed_books as (
  select *
  from (
    values
      (
        '11111111-1111-1111-1111-111111111001'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        '小王子',
        '安托万·德·圣埃克苏佩里',
        null,
        '一本适合反复阅读的温柔寓言。封面有轻微使用痕迹，内页干净。',
        '文学',
        '中文',
        'good'::public.book_condition,
        2015,
        'available'::public.book_status,
        43.6538,
        -79.3828
      ),
      (
        '11111111-1111-1111-1111-111111111002'::uuid,
        '00000000-0000-0000-0000-000000000002'::uuid,
        '追风筝的人',
        '卡勒德·胡赛尼',
        null,
        '故事很有冲击力，适合想读长篇小说的邻居。',
        '小说',
        '中文',
        'like_new'::public.book_condition,
        2018,
        'available'::public.book_status,
        43.6571,
        -79.3812
      ),
      (
        '11111111-1111-1111-1111-111111111003'::uuid,
        '00000000-0000-0000-0000-000000000003'::uuid,
        '活着',
        '余华',
        null,
        '经典作品，页角有几处折痕。',
        '文学',
        '中文',
        'good'::public.book_condition,
        2012,
        'available'::public.book_status,
        43.6489,
        -79.3819
      ),
      (
        '11111111-1111-1111-1111-111111111004'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        '解忧杂货店',
        '东野圭吾',
        null,
        '借阅中，预计 5 天后可再次借出。',
        '小说',
        '中文',
        'like_new'::public.book_condition,
        2017,
        'borrowed'::public.book_status,
        43.6542,
        -79.384
      ),
      (
        '11111111-1111-1111-1111-111111111005'::uuid,
        '00000000-0000-0000-0000-000000000002'::uuid,
        '百年孤独',
        '加西亚·马尔克斯',
        null,
        '魔幻现实主义经典，适合慢慢读。',
        '文学',
        '中文',
        'good'::public.book_condition,
        2011,
        'available'::public.book_status,
        43.6558,
        -79.3798
      )
  ) as t(id, owner_id, title, author, isbn, description, category, language, condition, publish_year, status, location_lat, location_lng)
)
insert into public.books (
  id,
  owner_id,
  title,
  author,
  isbn,
  description,
  category,
  language,
  condition,
  publish_year,
  status,
  location_lat,
  location_lng
)
select
  id,
  owner_id,
  title,
  author,
  isbn,
  description,
  category,
  language,
  condition,
  publish_year,
  status,
  location_lat,
  location_lng
from seed_books
on conflict (id) do update set
  owner_id = excluded.owner_id,
  title = excluded.title,
  author = excluded.author,
  isbn = excluded.isbn,
  description = excluded.description,
  category = excluded.category,
  language = excluded.language,
  condition = excluded.condition,
  publish_year = excluded.publish_year,
  status = excluded.status,
  location_lat = excluded.location_lat,
  location_lng = excluded.location_lng;

insert into public.friendships (requester_id, receiver_id, status)
values
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'accepted'::public.friendship_status
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'pending'::public.friendship_status
  )
on conflict (requester_id, receiver_id) do update set
  status = excluded.status;

insert into public.borrow_requests (
  id,
  book_id,
  borrower_id,
  lender_id,
  message,
  status,
  requested_at,
  borrowed_at
)
values (
  '22222222-2222-2222-2222-222222222001'::uuid,
  '11111111-1111-1111-1111-111111111004'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '想借这本书，预计两周内归还。',
  'borrowed'::public.borrow_status,
  now() - interval '8 days',
  now() - interval '7 days'
)
on conflict (id) do update set
  message = excluded.message,
  status = excluded.status,
  requested_at = excluded.requested_at,
  borrowed_at = excluded.borrowed_at;

insert into public.reviews (
  reviewer_id,
  reviewee_id,
  book_id,
  borrow_request_id,
  rating,
  comment
)
values (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111004'::uuid,
  '22222222-2222-2222-2222-222222222001'::uuid,
  5,
  '沟通很顺利，书也保存得很好。'
)
on conflict (reviewer_id, borrow_request_id) do update set
  rating = excluded.rating,
  comment = excluded.comment;

commit;
