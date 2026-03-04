-- 006_workflows_marketplace.sql
-- Phase 6: Marketplace & Workflows

-- ── Workflow description ────────────────────────────────────────────────────
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- ── Agent featured flag ─────────────────────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- ── Workflow run status enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE workflow_run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Workflow runs table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status      workflow_run_status NOT NULL DEFAULT 'pending',
  started_at  timestamptz,
  completed_at timestamptz,
  step_results jsonb DEFAULT '[]'::jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_featured ON agents(featured) WHERE featured = true;

-- Updated-at trigger
CREATE TRIGGER set_workflow_runs_updated_at
  BEFORE UPDATE ON workflow_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to workflow_runs" ON workflow_runs
  FOR ALL USING (true) WITH CHECK (true);
