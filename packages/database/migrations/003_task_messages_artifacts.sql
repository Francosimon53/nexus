-- Migration 003: Add messages, artifacts, timeout, retry columns to tasks
-- Run this in the Supabase SQL Editor.

alter table tasks
  add column messages jsonb not null default '[]'::jsonb,
  add column artifacts jsonb not null default '[]'::jsonb,
  add column timeout_at timestamptz,
  add column retry_count integer not null default 0,
  add column error_message text;
