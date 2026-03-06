-- Migration 007: Add missing trust event types used by the application
-- The original check constraint omitted 'task_timeout' and 'sla_breach'
-- which are emitted by task-timeout.ts and task-processor.ts.

ALTER TABLE trust_events DROP CONSTRAINT IF EXISTS trust_events_event_type_check;

ALTER TABLE trust_events ADD CONSTRAINT trust_events_event_type_check
  CHECK (event_type IN (
    'task_completed',
    'task_failed',
    'task_timeout',
    'sla_breach',
    'rating_received',
    'dispute_opened',
    'dispute_resolved'
  ));
