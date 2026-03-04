-- NEXUS Phase 1 — Add agent_card and last_heartbeat to agents

alter table agents
  add column agent_card jsonb not null default '{}'::jsonb,
  add column last_heartbeat timestamptz;
