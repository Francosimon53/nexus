'use client';

interface ArtifactPart {
  type: string;
  data: unknown;
}

interface Artifact {
  name?: string;
  description?: string;
  parts: ArtifactPart[];
}

export function ArtifactList({ artifacts }: { artifacts: Artifact[] }) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No artifacts.</p>
    );
  }

  return (
    <div className="space-y-3">
      {artifacts.map((artifact, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-surface-raised p-4"
        >
          {artifact.name && (
            <h4 className="mb-1 text-sm font-medium">{artifact.name}</h4>
          )}
          {artifact.description && (
            <p className="mb-2 text-xs text-text-secondary">{artifact.description}</p>
          )}
          {artifact.parts.map((part, j) => (
            <pre
              key={j}
              className="mt-1 overflow-auto rounded bg-surface-overlay p-2 text-xs"
            >
              {part.type === 'text' ? String(part.data) : JSON.stringify(part.data, null, 2)}
            </pre>
          ))}
        </div>
      ))}
    </div>
  );
}
