-- ==========================================
-- 부탁해 - Supabase 테이블 스키마
-- Supabase SQL Editor에서 실행하세요
-- ==========================================

-- 1. profiles 테이블
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '익명',
  avatar_url text,
  location text,
  lat float,
  lng float,
  rating float default 5.0,
  completed_count integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);

-- 회원가입 시 자동 프로필 생성 트리거
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '익명'),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. tasks 테이블
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price integer not null,
  category text not null,
  location text not null,
  lat float,
  lng float,
  is_urgent boolean default false,
  status text default 'open' check (status in ('open','in_progress','done','cancelled')),
  requester_id uuid references auth.users not null,
  helper_id uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "tasks_select" on tasks for select using (
  status = 'open' or requester_id = auth.uid() or helper_id = auth.uid()
);
create policy "tasks_insert" on tasks for insert with check (auth.uid() = requester_id);
create policy "tasks_update" on tasks for update using (
  auth.uid() = requester_id or auth.uid() = helper_id
);

-- 3. chat_rooms 테이블
create table chat_rooms (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade not null,
  requester_id uuid references auth.users not null,
  helper_id uuid references auth.users not null,
  last_message text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table chat_rooms enable row level security;
create policy "chat_rooms_select" on chat_rooms for select using (
  auth.uid() = requester_id or auth.uid() = helper_id
);
create policy "chat_rooms_insert" on chat_rooms for insert with check (
  auth.uid() = requester_id or auth.uid() = helper_id
);
create policy "chat_rooms_update" on chat_rooms for update using (
  auth.uid() = requester_id or auth.uid() = helper_id
);

-- 4. messages 테이블
create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_room_id uuid references chat_rooms on delete cascade not null,
  sender_id uuid references auth.users not null,
  content text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "messages_select" on messages for select using (
  exists (
    select 1 from chat_rooms
    where chat_rooms.id = messages.chat_room_id
    and (chat_rooms.requester_id = auth.uid() or chat_rooms.helper_id = auth.uid())
  )
);
create policy "messages_insert" on messages for insert with check (
  auth.uid() = sender_id
  and exists (
    select 1 from chat_rooms
    where chat_rooms.id = messages.chat_room_id
    and (chat_rooms.requester_id = auth.uid() or chat_rooms.helper_id = auth.uid())
  )
);

-- 5. reviews 테이블
create table reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade not null unique,
  reviewer_id uuid references auth.users not null,
  reviewee_id uuid references auth.users not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  content text,
  created_at timestamptz default now()
);

alter table reviews enable row level security;
create policy "reviews_select" on reviews for select using (true);
create policy "reviews_insert" on reviews for insert with check (auth.uid() = reviewer_id);

-- 6. payments 테이블
create table payments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks on delete cascade not null,
  payer_id uuid references auth.users not null,
  amount integer not null,
  payment_key text,
  order_id text not null unique,
  status text default 'pending' check (status in ('pending','confirmed','failed','cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

alter table payments enable row level security;
create policy "payments_select" on payments for select using (auth.uid() = payer_id);
create policy "payments_insert" on payments for insert with check (auth.uid() = payer_id);

-- 7. Realtime 활성화
alter publication supabase_realtime add table messages;

-- 8. 인덱스
create index idx_tasks_status on tasks(status);
create index idx_tasks_requester on tasks(requester_id);
create index idx_tasks_helper on tasks(helper_id);
create index idx_tasks_category on tasks(category);
create index idx_messages_chat_room on messages(chat_room_id);
create index idx_chat_rooms_participants on chat_rooms(requester_id, helper_id);
create index idx_reviews_reviewee on reviews(reviewee_id);
