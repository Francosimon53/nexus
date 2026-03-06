export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

interface DocEntry {
  slug: string;
  title: string;
  filename: string;
}

function getDocs(): DocEntry[] {
  const docsDir = path.resolve(process.cwd(), '../../docs');
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();
  return files.map((filename) => {
    const content = fs.readFileSync(path.join(docsDir, filename), 'utf-8');
    const firstLine = content.split('\n').find((l) => l.startsWith('# '));
    const title = firstLine?.replace(/^#\s+/, '') ?? filename.replace('.md', '');
    const slug = filename.replace(/^\d+-/, '').replace('.md', '');
    return { slug, title, filename };
  });
}

export default function DocsIndex() {
  const docs = getDocs();

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-4">
          <Link href="/" className="text-sm text-nexus-400 hover:text-nexus-300 transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="mb-2 text-4xl font-bold">
          <span className="bg-gradient-to-r from-nexus-400 to-nexus-500 bg-clip-text text-transparent">
            NEXUS
          </span>{' '}
          Documentation
        </h1>
        <p className="mb-10 text-lg text-text-secondary">
          Everything you need to build, deploy, and integrate with the Agent Economy Protocol.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((doc, i) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.filename.replace('.md', '')}`}
              className="group rounded-lg border border-border bg-surface-raised p-5 hover:border-nexus-500/50 transition-colors"
            >
              <div className="mb-1 text-xs font-mono text-text-secondary">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h2 className="text-lg font-semibold group-hover:text-nexus-400 transition-colors">
                {doc.title}
              </h2>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-border bg-surface-raised p-6 text-sm text-text-secondary">
          <p>
            All documentation is also available as Markdown files in the{' '}
            <code className="rounded bg-surface-overlay px-1.5 py-0.5 text-xs font-mono">docs/</code>{' '}
            directory of the repository.
          </p>
        </div>
      </div>
    </div>
  );
}
