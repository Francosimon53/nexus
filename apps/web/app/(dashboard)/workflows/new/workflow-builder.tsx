'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AgentOption {
  id: string;
  name: string;
  skills: { id: string; name: string }[];
}

interface StepData {
  name: string;
  agentId: string;
  skillId: string;
  input: string;
  timeout: number;
  maxRetries: number;
  dependsOn: number[];
}

function emptyStep(): StepData {
  return {
    name: '',
    agentId: '',
    skillId: '',
    input: '{}',
    timeout: 300,
    maxRetries: 0,
    dependsOn: [],
  };
}

export function WorkflowBuilder() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepData[]>([emptyStep()]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/discover')
      .then((r) => r.json())
      .then((json) => setAgents(json.data ?? []))
      .catch(() => {});
  }, []);

  function updateStep(index: number, partial: Partial<StepData>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...partial } : s)));
  }

  function removeStep(index: number) {
    setSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Fix dependency indices
      return next.map((s) => ({
        ...s,
        dependsOn: s.dependsOn
          .map((d) => (d > index ? d - 1 : d))
          .filter((d) => d !== index && d >= 0),
      }));
    });
  }

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      const removed = next.splice(from, 1);
      next.splice(to, 0, removed[0]!);
      // Reset dependencies since order changed
      return next.map((s) => ({ ...s, dependsOn: [] }));
    });
  }

  async function handleSubmit() {
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (steps.some((s) => !s.agentId || !s.skillId)) {
      setError('All steps must have an agent and skill selected');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        steps: steps.map((s) => {
          let inputObj = {};
          try {
            inputObj = JSON.parse(s.input || '{}');
          } catch {
            // keep empty
          }
          return {
            name: s.name || `Step`,
            agentId: s.agentId,
            skillId: s.skillId,
            input: inputObj,
            timeout: s.timeout,
            dependsOn: s.dependsOn,
            retryPolicy: { maxRetries: s.maxRetries, backoffMs: 1000 },
          };
        }),
      };

      const res = await fetch('/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to create workflow');
        return;
      }

      router.push(`/workflows/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Name + Description */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workflow"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:border-nexus-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:border-nexus-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Steps */}
      <h2 className="mb-3 text-sm font-medium text-text-secondary">Steps</h2>
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const selectedAgent = agents.find((a) => a.id === step.agentId);
          const skills = selectedAgent?.skills ?? [];
          return (
            <div key={idx} className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Step {idx + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveStep(idx, idx - 1)}
                    disabled={idx === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-surface-overlay disabled:opacity-30"
                  >
                    &uarr;
                  </button>
                  <button
                    onClick={() => moveStep(idx, idx + 1)}
                    disabled={idx === steps.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-surface-overlay disabled:opacity-30"
                  >
                    &darr;
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Step Name</label>
                  <input
                    value={step.name}
                    onChange={(e) => updateStep(idx, { name: e.target.value })}
                    placeholder={`Step ${idx + 1}`}
                    className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-nexus-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Agent</label>
                  <select
                    value={step.agentId}
                    onChange={(e) => updateStep(idx, { agentId: e.target.value, skillId: '' })}
                    className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-nexus-500 focus:outline-none"
                  >
                    <option value="">Select agent...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Skill</label>
                  <select
                    value={step.skillId}
                    onChange={(e) => updateStep(idx, { skillId: e.target.value })}
                    disabled={!step.agentId}
                    className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-nexus-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Select skill...</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Timeout (s)</label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={step.timeout}
                    onChange={(e) => updateStep(idx, { timeout: Number(e.target.value) })}
                    className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-nexus-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={step.maxRetries}
                    onChange={(e) => updateStep(idx, { maxRetries: Number(e.target.value) })}
                    className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-nexus-500 focus:outline-none"
                  />
                </div>
                {idx > 0 && (
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">Depends On</label>
                    <div className="flex flex-wrap gap-2">
                      {steps.slice(0, idx).map((_, depIdx) => (
                        <label key={depIdx} className="flex items-center gap-1 text-xs text-text-secondary">
                          <input
                            type="checkbox"
                            checked={step.dependsOn.includes(depIdx)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...step.dependsOn, depIdx]
                                : step.dependsOn.filter((d) => d !== depIdx);
                              updateStep(idx, { dependsOn: next });
                            }}
                            className="accent-nexus-500"
                          />
                          Step {depIdx + 1}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs text-text-secondary">Input (JSON)</label>
                <textarea
                  value={step.input}
                  onChange={(e) => updateStep(idx, { input: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-border bg-surface-overlay px-2 py-1.5 font-mono text-xs text-text-primary focus:border-nexus-500 focus:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setSteps((prev) => [...prev, emptyStep()])}
        disabled={steps.length >= 20}
        className="mt-3 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-text-secondary hover:border-nexus-500 hover:text-nexus-400 transition-colors disabled:opacity-30"
      >
        + Add Step
      </button>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-nexus-600 px-6 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Workflow'}
        </button>
      </div>
    </div>
  );
}
