'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export function RegisterAgentForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);

  function addSkill() {
    setSkills((prev) => [...prev, { id: '', name: '', description: '', tags: [] }]);
  }

  function removeSkill(index: number) {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSkill(index: number, field: keyof Skill, value: string) {
    setSkills((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, [field]: field === 'tags' ? value.split(',').map((t) => t.trim()) : value }
          : s,
      ),
    );
  }

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Validate endpoint is a valid URL
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setError('Endpoint must be an HTTP or HTTPS URL.');
        setSubmitting(false);
        return;
      }
    } catch {
      setError('Endpoint must be a valid URL (e.g., https://my-agent.example.com/a2a).');
      setSubmitting(false);
      return;
    }

    const payload = {
      name,
      description,
      endpoint,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      skills,
    };

    try {
      const res = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? 'Registration failed');
      }

      router.push('/agents');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-nexus-500 focus:outline-none';

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Name *
        </label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} placeholder="My Agent" />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="What does this agent do?"
        />
      </div>

      <div>
        <label htmlFor="endpoint" className="mb-1 block text-sm font-medium">
          Endpoint URL *
        </label>
        <input
          id="endpoint"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          type="url"
          required
          className={inputClass}
          placeholder="https://my-agent.example.com"
        />
      </div>

      <div>
        <label htmlFor="tags" className="mb-1 block text-sm font-medium">
          Tags (comma-separated)
        </label>
        <input id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} placeholder="nlp, summarization" />
      </div>

      {/* Skills section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Skills</label>
          <button
            type="button"
            onClick={addSkill}
            className="text-xs text-nexus-400 hover:text-nexus-300"
          >
            + Add Skill
          </button>
        </div>

        {skills.length === 0 && (
          <p className="text-sm text-text-secondary">No skills added yet.</p>
        )}

        <div className="space-y-3">
          {skills.map((skill, i) => (
            <div key={i} className="rounded-md border border-border bg-surface-raised p-3">
              <div className="mb-2 flex justify-between">
                <span className="text-xs text-text-secondary">Skill #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={skill.id}
                  onChange={(e) => updateSkill(i, 'id', e.target.value)}
                  className={inputClass}
                  placeholder="skill-id"
                />
                <input
                  value={skill.name}
                  onChange={(e) => updateSkill(i, 'name', e.target.value)}
                  className={inputClass}
                  placeholder="Skill Name"
                />
              </div>
              <input
                value={skill.description}
                onChange={(e) => updateSkill(i, 'description', e.target.value)}
                className={`mt-2 ${inputClass}`}
                placeholder="Description"
              />
              <input
                value={skill.tags.join(', ')}
                onChange={(e) => updateSkill(i, 'tags', e.target.value)}
                className={`mt-2 ${inputClass}`}
                placeholder="Tags (comma-separated)"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-nexus-600 px-6 py-2 text-sm font-medium text-white hover:bg-nexus-500 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Registering...' : 'Register Agent'}
      </button>
    </form>
  );
}
