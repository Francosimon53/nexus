import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkdownRenderer } from '../components/markdown-renderer';

function getDocContent(slug: string): { content: string; title: string } | null {
  const docsDir = path.resolve(process.cwd(), '../../docs');
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();
  const filename = files.find((f) => f.replace('.md', '') === slug);
  if (!filename) return null;

  const content = fs.readFileSync(path.join(docsDir, filename), 'utf-8');
  const firstLine = content.split('\n').find((l) => l.startsWith('# '));
  const title = firstLine?.replace(/^#\s+/, '') ?? slug;
  return { content, title };
}

function getAdjacentDocs(slug: string) {
  const docsDir = path.resolve(process.cwd(), '../../docs');
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort();
  const slugs = files.map((f) => f.replace('.md', ''));
  const idx = slugs.indexOf(slug);
  return {
    prev: idx > 0 ? slugs[idx - 1] : null,
    next: idx < slugs.length - 1 ? slugs[idx + 1] : null,
  };
}

export async function generateStaticParams() {
  const docsDir = path.resolve(process.cwd(), '../../docs');
  if (!fs.existsSync(docsDir)) return [];
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
  return files.map((f) => ({ slug: f.replace('.md', '') }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocContent(slug);
  if (!doc) notFound();

  const { prev, next } = getAdjacentDocs(slug);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center gap-4 text-sm">
          <Link href="/docs" className="text-nexus-400 hover:text-nexus-300 transition-colors">
            &larr; All Docs
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="text-text-secondary">{doc.title}</span>
        </div>

        <article className="prose-nexus">
          <MarkdownRenderer content={doc.content} />
        </article>

        <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
          {prev ? (
            <Link href={`/docs/${prev}`} className="text-sm text-nexus-400 hover:text-nexus-300 transition-colors">
              &larr; Previous
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/docs/${next}`} className="text-sm text-nexus-400 hover:text-nexus-300 transition-colors">
              Next &rarr;
            </Link>
          ) : <span />}
        </nav>
      </div>
    </div>
  );
}
