create extension if not exists pgcrypto;

create table if not exists public.order_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

alter table public.order_accounts
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists order_accounts_name_key
  on public.order_accounts (name);

create index if not exists order_accounts_updated_idx
  on public.order_accounts (updated_at desc);

create table if not exists public.orders (
  id text primary key,
  seq bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  account_name text null,
  ordered_at date null,
  purchase_date date null,
  latest_warehouse_at date null,
  warning_text text null,
  order_no text null,
  product_name text null,
  quantity integer null,
  purchase_price numeric(12,2) null,
  weight_text text null,
  size_text text null,
  order_status text null,
  courier_company text null,
  tracking_no text null
);

alter table public.orders
  add column if not exists seq bigint;

alter table public.orders
  add column if not exists created_at timestamptz not null default now();

alter table public.orders
  add column if not exists account_name text null,
  add column if not exists ordered_at date null,
  add column if not exists purchase_date date null,
  add column if not exists latest_warehouse_at date null,
  add column if not exists warning_text text null,
  add column if not exists order_no text null,
  add column if not exists product_name text null,
  add column if not exists quantity integer null,
  add column if not exists purchase_price numeric(12,2) null,
  add column if not exists weight_text text null,
  add column if not exists size_text text null,
  add column if not exists order_status text null,
  add column if not exists courier_company text null,
  add column if not exists tracking_no text null;

create index if not exists orders_seq_idx
  on public.orders (seq desc nulls last);

create index if not exists orders_created_idx
  on public.orders (created_at desc);

create index if not exists orders_updated_idx
  on public.orders (updated_at desc);

create index if not exists orders_deleted_idx
  on public.orders (deleted_at);

create index if not exists orders_account_name_idx
  on public.orders (account_name);

create index if not exists orders_order_no_idx
  on public.orders (order_no);

create index if not exists orders_tracking_no_idx
  on public.orders (tracking_no);

create table if not exists public.sync_state (
  scope text primary key,
  updated_at timestamptz not null default now(),
  last_client_id text null,
  schema_version integer not null default 2
);

alter table public.sync_state
  add column if not exists schema_version integer not null default 2;

insert into public.sync_state (scope, updated_at, last_client_id, schema_version)
values ('orders', now(), null, 2)
on conflict (scope) do update
set schema_version = excluded.schema_version;

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
