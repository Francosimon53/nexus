-- NEXUS Agent Economy Protocol — Initial Schema
-- Requires: uuid-ossp extension

create extension if not exists "uuid-ossp";

-- ── Agents ─────────────────────────────────────────────────────────────────────

create table agents (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  status      text not null default 'offline' check (status in ('online', 'offline', 'degraded')),
  skills      jsonb not null default '[]'::jsonb,
  tags        text[] not null default '{}',
  trust_score numeric(5,2) not null default 50.00 check (trust_score between 0 and 100),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_agents_owner on agents(owner_user_id);
create index idx_agents_status on agents(status);
create index idx_agents_tags on agents using gin(tags);
create index idx_agents_trust on agents(trust_score desc);

-- ── Tasks ──────────────────────────────────────────────────────────────────────

create table tasks (
  id                  uuid primary key default uuid_generate_v4(),
  title               text not null check (char_length(title) between 1 and 200),
  description         text not null default '',
  status              text not null default 'pending'
                        check (status in ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
  requester_agent_id  uuid not null references agents(id) on delete cascade,
  assigned_agent_id   uuid references agents(id) on delete set null,
  input               jsonb not null default '{}'::jsonb,
  output              jsonb,
  max_budget_credits  numeric(12,2) not null default 0,
  actual_cost_credits numeric(12,2) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index idx_tasks_requester on tasks(requester_agent_id);
create index idx_tasks_assigned on tasks(assigned_agent_id);
create index idx_tasks_status on tasks(status);

-- ── Workflows ──────────────────────────────────────────────────────────────────

create table workflows (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null check (char_length(name) between 1 and 200),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  steps         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_workflows_owner on workflows(owner_user_id);

-- ── Trust Events ───────────────────────────────────────────────────────────────

create table trust_events (
  id          uuid primary key default uuid_generate_v4(),
  agent_id    uuid not null references agents(id) on delete cascade,
  event_type  text not null
                check (event_type in ('task_completed', 'task_failed', 'rating_received', 'dispute_opened', 'dispute_resolved')),
  score       numeric(4,1) not null check (score between -10 and 10),
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

create index idx_trust_events_agent on trust_events(agent_id);

-- ── Transactions ───────────────────────────────────────────────────────────────

create table transactions (
  id              uuid primary key default uuid_generate_v4(),
  task_id         uuid not null references tasks(id) on delete cascade,
  from_agent_id   uuid not null references agents(id) on delete cascade,
  to_agent_id     uuid not null references agents(id) on delete cascade,
  amount_credits  numeric(12,2) not null check (amount_credits >= 0),
  status          text not null default 'pending' check (status in ('pending', 'settled', 'refunded')),
  created_at      timestamptz not null default now()
);

create index idx_transactions_task on transactions(task_id);
create index idx_transactions_from on transactions(from_agent_id);
create index idx_transactions_to on transactions(to_agent_id);

-- ── API Keys ───────────────────────────────────────────────────────────────────

create table api_keys (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  key_hash    text not null,
  prefix      text not null check (char_length(prefix) <= 12),
  scopes      text[] not null default '{*}',
  last_used_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create unique index idx_api_keys_hash on api_keys(key_hash);
create index idx_api_keys_user on api_keys(user_id);

-- ── Updated At Trigger ─────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_agents_updated_at
  before update on agents
  for each row execute function update_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

create trigger trg_workflows_updated_at
  before update on workflows
  for each row execute function update_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table agents enable row level security;
alter table tasks enable row level security;
alter table workflows enable row level security;
alter table trust_events enable row level security;
alter table transactions enable row level security;
alter table api_keys enable row level security;

-- Agents: owners can CRUD their own agents, everyone can read online agents
create policy "agents_select_public" on agents
  for select using (status = 'online');

create policy "agents_owner_all" on agents
  for all using (owner_user_id = auth.uid());

-- Tasks: requester and assigned agent owners can see tasks
create policy "tasks_requester" on tasks
  for all using (
    requester_agent_id in (select id from agents where owner_user_id = auth.uid())
  );

create policy "tasks_assigned" on tasks
  for select using (
    assigned_agent_id in (select id from agents where owner_user_id = auth.uid())
  );

-- Workflows: owner can CRUD
create policy "workflows_owner" on workflows
  for all using (owner_user_id = auth.uid());

-- Trust events: public read, system write (via service role)
create policy "trust_events_select" on trust_events
  for select using (true);

-- Transactions: involved parties can read
create policy "transactions_involved" on transactions
  for select using (
    from_agent_id in (select id from agents where owner_user_id = auth.uid())
    or to_agent_id in (select id from agents where owner_user_id = auth.uid())
  );

-- API keys: owner only
create policy "api_keys_owner" on api_keys
  for all using (user_id = auth.uid());
