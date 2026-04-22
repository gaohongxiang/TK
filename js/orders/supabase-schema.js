window.ORDER_TRACKER_SUPABASE_SCHEMA = String.raw`create extension if not exists pgcrypto;

create table if not exists public.order_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists order_accounts_name_key
  on public.order_accounts (name);

create index if not exists order_accounts_updated_idx
  on public.order_accounts (updated_at desc);

create table if not exists public.orders (
  id text primary key,
  account_name text null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists orders_updated_idx
  on public.orders (updated_at desc);

create index if not exists orders_deleted_idx
  on public.orders (deleted_at);

create table if not exists public.sync_state (
  scope text primary key,
  updated_at timestamptz not null default now(),
  last_client_id text null
);

alter table public.order_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.sync_state enable row level security;

drop policy if exists "project owner manages order_accounts" on public.order_accounts;
create policy "project owner manages order_accounts"
on public.order_accounts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "project owner manages orders" on public.orders;
create policy "project owner manages orders"
on public.orders
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "project owner manages sync_state" on public.sync_state;
create policy "project owner manages sync_state"
on public.sync_state
for all
to anon, authenticated
using (true)
with check (true);
`;
