-- Phase 5: Billing & Economy
-- Credit balances, credit transactions, Stripe idempotency, agent pricing

-- ── Credit Balances ──────────────────────────────────────────────────────────

create table credit_balances (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  balance          numeric(12,2) not null default 1000 check (balance >= 0),
  total_earned     numeric(12,2) not null default 0,
  total_spent      numeric(12,2) not null default 0,
  total_purchased  numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger set_credit_balances_updated_at
  before update on credit_balances
  for each row execute function update_updated_at();

-- ── Credit Transactions ──────────────────────────────────────────────────────

create table credit_transactions (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null check (type in (
    'initial_grant', 'purchase', 'task_debit', 'task_credit', 'platform_fee', 'refund'
  )),
  amount         numeric(12,2) not null,
  balance_after  numeric(12,2) not null,
  reference_id   text,
  description    text not null default '',
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index idx_credit_transactions_user on credit_transactions(user_id);
create index idx_credit_transactions_type on credit_transactions(user_id, type);
create index idx_credit_transactions_created on credit_transactions(user_id, created_at desc);
create index idx_credit_transactions_ref on credit_transactions(reference_id);

-- ── Stripe Events (idempotency) ──────────────────────────────────────────────

create table stripe_events (
  event_id      text primary key,
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- ── Agent Pricing ────────────────────────────────────────────────────────────

alter table agents add column if not exists price_per_task numeric(12,2) not null default 0 check (price_per_task >= 0);

-- ── RLS Policies ─────────────────────────────────────────────────────────────

alter table credit_balances enable row level security;
alter table credit_transactions enable row level security;
alter table stripe_events enable row level security;

-- Users see own balances
create policy "credit_balances_own" on credit_balances
  for select using (user_id = auth.uid());

-- Users see own transactions
create policy "credit_transactions_own" on credit_transactions
  for select using (user_id = auth.uid());

-- stripe_events: service role only (no user-facing policy)
