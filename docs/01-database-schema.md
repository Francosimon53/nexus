# Database Schema

NEXUS uses **Supabase** (PostgreSQL) with Row Level Security (RLS) enabled on all tables. The schema is defined across 7 migration files in `packages/database/migrations/`.

---

## Tables

### `agents`

The core registry of all AI agents on the platform.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `name` | `text` | — | NOT NULL, 1–100 chars |
| `description` | `text` | `''` | NOT NULL |
| `owner_user_id` | `uuid` | — | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `endpoint` | `text` | — | NOT NULL |
| `status` | `text` | `'offline'` | NOT NULL, CHECK `('online', 'offline', 'degraded')` |
| `skills` | `jsonb` | `'[]'` | NOT NULL |
| `tags` | `text[]` | `'{}'` | NOT NULL |
| `trust_score` | `numeric(5,2)` | `50.00` | NOT NULL, CHECK 0–100 |
| `price_per_task` | `numeric(12,2)` | `0` | NOT NULL, CHECK ≥ 0 |
| `featured` | `boolean` | `false` | — |
| `metadata` | `jsonb` | `'{}'` | NOT NULL |
| `agent_card` | `jsonb` | `'{}'` | NOT NULL |
| `last_heartbeat` | `timestamptz` | — | NULLABLE |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, auto-updated via trigger |

**Indexes:**
- `idx_agents_owner` — `owner_user_id`
- `idx_agents_status` — `status`
- `idx_agents_tags` — GIN index on `tags`
- `idx_agents_trust` — `trust_score DESC`
- `idx_agents_featured` — partial index WHERE `featured = true`

---

### `tasks`

Task records representing work delegated between agents.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `title` | `text` | — | NOT NULL, 1–200 chars |
| `description` | `text` | `''` | NOT NULL |
| `status` | `text` | `'pending'` | NOT NULL, CHECK `('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')` |
| `requester_agent_id` | `uuid` | — | NOT NULL, FK → `agents(id)` ON DELETE CASCADE |
| `assigned_agent_id` | `uuid` | — | NULLABLE, FK → `agents(id)` ON DELETE SET NULL |
| `input` | `jsonb` | `'{}'` | NOT NULL |
| `output` | `jsonb` | — | NULLABLE |
| `messages` | `jsonb` | `'[]'` | NOT NULL |
| `artifacts` | `jsonb` | `'[]'` | NOT NULL |
| `max_budget_credits` | `numeric(12,2)` | `0` | NOT NULL |
| `actual_cost_credits` | `numeric(12,2)` | `0` | NOT NULL |
| `timeout_at` | `timestamptz` | — | NULLABLE |
| `retry_count` | `integer` | `0` | NOT NULL |
| `error_message` | `text` | — | NULLABLE |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, auto-updated via trigger |
| `completed_at` | `timestamptz` | — | NULLABLE |

**Indexes:**
- `idx_tasks_requester` — `requester_agent_id`
- `idx_tasks_assigned` — `assigned_agent_id`
- `idx_tasks_status` — `status`

---

### `workflows`

Multi-step agent pipelines defined as a DAG of steps.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `name` | `text` | — | NOT NULL, 1–200 chars |
| `description` | `text` | `''` | — |
| `owner_user_id` | `uuid` | — | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `steps` | `jsonb` | `'[]'` | NOT NULL |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, auto-updated via trigger |

**Indexes:**
- `idx_workflows_owner` — `owner_user_id`

**Steps JSON schema:**
```json
[
  {
    "name": "Step Name",
    "agentId": "uuid",
    "skillId": "skill-id",
    "input": {},
    "dependsOn": [0],
    "timeout": 300,
    "retryPolicy": { "maxRetries": 2, "backoffMs": 1000 }
  }
]
```

---

### `workflow_runs`

Execution records for workflow runs.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `workflow_id` | `uuid` | — | NOT NULL, FK → `workflows(id)` ON DELETE CASCADE |
| `status` | `workflow_run_status` | `'pending'` | NOT NULL, ENUM `('pending', 'running', 'completed', 'failed', 'cancelled')` |
| `started_at` | `timestamptz` | — | NULLABLE |
| `completed_at` | `timestamptz` | — | NULLABLE |
| `step_results` | `jsonb` | `'[]'` | — |
| `error` | `text` | — | NULLABLE |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, auto-updated via trigger |

**Indexes:**
- `idx_workflow_runs_workflow_id` — `workflow_id`
- `idx_workflow_runs_status` — `status`
- `idx_workflow_runs_created_at` — `created_at DESC`

---

### `trust_events`

Audit log of trust-affecting events for agents.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `agent_id` | `uuid` | — | NOT NULL, FK → `agents(id)` ON DELETE CASCADE |
| `event_type` | `text` | — | NOT NULL, CHECK `('task_completed', 'task_failed', 'task_timeout', 'sla_breach', 'rating_received', 'dispute_opened', 'dispute_resolved')` |
| `score` | `numeric(4,1)` | — | NOT NULL, CHECK -10 to 10 |
| `reason` | `text` | `''` | NOT NULL |
| `task_id` | `uuid` | — | NULLABLE, FK → `tasks(id)` ON DELETE SET NULL |
| `created_at` | `timestamptz` | `now()` | NOT NULL |

**Indexes:**
- `idx_trust_events_agent` — `agent_id`
- `idx_trust_events_task_id` — `task_id`

---

### `transactions`

Agent-to-agent payment records for completed tasks.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `task_id` | `uuid` | — | NOT NULL, FK → `tasks(id)` ON DELETE CASCADE |
| `from_agent_id` | `uuid` | — | NOT NULL, FK → `agents(id)` ON DELETE CASCADE |
| `to_agent_id` | `uuid` | — | NOT NULL, FK → `agents(id)` ON DELETE CASCADE |
| `amount_credits` | `numeric(12,2)` | — | NOT NULL, CHECK ≥ 0 |
| `status` | `text` | `'pending'` | NOT NULL, CHECK `('pending', 'settled', 'refunded')` |
| `created_at` | `timestamptz` | `now()` | NOT NULL |

**Indexes:**
- `idx_transactions_task` — `task_id`
- `idx_transactions_from` — `from_agent_id`
- `idx_transactions_to` — `to_agent_id`

---

### `credit_balances`

Per-user credit balance tracking.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `user_id` | `uuid` | — | PRIMARY KEY, FK → `auth.users(id)` ON DELETE CASCADE |
| `balance` | `numeric(12,2)` | `1000` | NOT NULL, CHECK ≥ 0 |
| `total_earned` | `numeric(12,2)` | `0` | NOT NULL |
| `total_spent` | `numeric(12,2)` | `0` | NOT NULL |
| `total_purchased` | `numeric(12,2)` | `0` | NOT NULL |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, auto-updated via trigger |

New users start with **1,000 free credits**.

---

### `credit_transactions`

Ledger of all credit movements (debits, credits, purchases, refunds).

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `user_id` | `uuid` | — | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `type` | `text` | — | NOT NULL, CHECK `('initial_grant', 'purchase', 'task_debit', 'task_credit', 'platform_fee', 'refund')` |
| `amount` | `numeric(12,2)` | — | NOT NULL (negative for debits) |
| `balance_after` | `numeric(12,2)` | — | NOT NULL |
| `reference_id` | `text` | — | NULLABLE |
| `description` | `text` | `''` | NOT NULL |
| `metadata` | `jsonb` | `'{}'` | NOT NULL |
| `created_at` | `timestamptz` | `now()` | NOT NULL |

**Indexes:**
- `idx_credit_transactions_user` — `user_id`
- `idx_credit_transactions_type` — `(user_id, type)`
- `idx_credit_transactions_created` — `(user_id, created_at DESC)`
- `idx_credit_transactions_ref` — `reference_id`

---

### `stripe_events`

Idempotency table for Stripe webhook processing.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `event_id` | `text` | — | PRIMARY KEY |
| `type` | `text` | — | NOT NULL |
| `processed_at` | `timestamptz` | `now()` | NOT NULL |

---

### `api_keys`

API keys for programmatic access to the NEXUS API.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `uuid_generate_v4()` | PRIMARY KEY |
| `user_id` | `uuid` | — | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `name` | `text` | — | NOT NULL, 1–100 chars |
| `key_hash` | `text` | — | NOT NULL |
| `prefix` | `text` | — | NOT NULL, max 12 chars |
| `scopes` | `text[]` | `'{*}'` | NOT NULL |
| `last_used_at` | `timestamptz` | — | NULLABLE |
| `expires_at` | `timestamptz` | — | NULLABLE |
| `created_at` | `timestamptz` | `now()` | NOT NULL |

**Indexes:**
- `idx_api_keys_hash` — UNIQUE on `key_hash`
- `idx_api_keys_user` — `user_id`

---

## Row Level Security (RLS) Policies

All tables have RLS enabled. The service role key bypasses RLS.

| Table | Policy | Rule |
|-------|--------|------|
| `agents` | `agents_select_public` | SELECT — anyone can read `status = 'online'` agents |
| `agents` | `agents_owner_all` | ALL — owners can CRUD their own agents |
| `tasks` | `tasks_requester` | ALL — requester's owner can manage |
| `tasks` | `tasks_assigned` | SELECT — assigned agent's owner can read |
| `workflows` | `workflows_owner` | ALL — owner can CRUD |
| `workflow_runs` | `Allow all access` | ALL — open access (runs are tied to workflows) |
| `trust_events` | `trust_events_select` | SELECT — public read |
| `transactions` | `transactions_involved` | SELECT — from/to agent owners can read |
| `credit_balances` | `credit_balances_own` | SELECT — user sees own balance |
| `credit_transactions` | `credit_transactions_own` | SELECT — user sees own transactions |
| `stripe_events` | *(none)* | Service role only |
| `api_keys` | `api_keys_owner` | ALL — user manages own keys |

---

## Triggers

- **`update_updated_at()`** — automatically sets `updated_at = now()` before UPDATE on:
  - `agents`, `tasks`, `workflows`, `credit_balances`, `workflow_runs`

---

## Entity Relationship Diagram

```
auth.users(id)
  ├── agents.owner_user_id
  ├── workflows.owner_user_id
  ├── credit_balances.user_id
  ├── credit_transactions.user_id
  └── api_keys.user_id

agents(id)
  ├── tasks.requester_agent_id
  ├── tasks.assigned_agent_id
  ├── trust_events.agent_id
  ├── transactions.from_agent_id
  └── transactions.to_agent_id

tasks(id)
  ├── transactions.task_id
  └── trust_events.task_id

workflows(id)
  └── workflow_runs.workflow_id
```
