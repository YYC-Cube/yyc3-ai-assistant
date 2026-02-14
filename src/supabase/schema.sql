-- Enable Row Level Security
alter table if exists public.profiles enable row level security;
alter table if exists public.ai_configs enable row level security;
alter table if exists public.workflows enable row level security;
alter table if exists public.workflow_runs enable row level security;

-- Create tables
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  avatar_url text,
  theme_preference text check (theme_preference in ('cyan', 'red', 'dark')) default 'cyan',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.ai_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  provider text not null,
  model text not null,
  base_url text,
  settings jsonb default '{}'::jsonb,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.workflows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  definition jsonb not null default '{}'::jsonb,
  is_public boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.workflow_runs (
  id uuid default gen_random_uuid() primary key,
  workflow_id uuid references public.workflows on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  status text check (status in ('pending', 'running', 'completed', 'failed')) default 'pending',
  logs jsonb default '[]'::jsonb,
  started_at timestamp with time zone default timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  duration_ms integer
);

-- RLS Policies

-- Profiles: Public read, Self update
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- AI Configs: Private
create policy "Users can view own configs." on public.ai_configs
  for select using (auth.uid() = user_id);

create policy "Users can insert own configs." on public.ai_configs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own configs." on public.ai_configs
  for update using (auth.uid() = user_id);

create policy "Users can delete own configs." on public.ai_configs
  for delete using (auth.uid() = user_id);

-- Workflows: Private (unless public), Self update
create policy "Users can view own workflows." on public.workflows
  for select using (auth.uid() = user_id or is_public = true);

create policy "Users can insert own workflows." on public.workflows
  for insert with check (auth.uid() = user_id);

create policy "Users can update own workflows." on public.workflows
  for update using (auth.uid() = user_id);

create policy "Users can delete own workflows." on public.workflows
  for delete using (auth.uid() = user_id);

-- Workflow Runs: Private
create policy "Users can view own workflow runs." on public.workflow_runs
  for select using (auth.uid() = user_id);

create policy "Users can insert own workflow runs." on public.workflow_runs
  for insert with check (auth.uid() = user_id);

-- Functions
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
