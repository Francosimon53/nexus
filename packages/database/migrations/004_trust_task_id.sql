-- Add task_id reference to trust_events for traceability
alter table trust_events
  add column if not exists task_id uuid references tasks(id) on delete set null;

create index if not exists idx_trust_events_task_id on trust_events(task_id);
