'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-6 text-3xl font-bold text-text-primary">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-4 mt-10 text-2xl font-bold text-text-primary border-b border-border pb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-3 mt-8 text-xl font-semibold text-text-primary">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-2 mt-6 text-lg font-semibold text-text-primary">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed text-text-secondary">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2 transition-colors"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-6 list-disc space-y-1 text-text-secondary">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-6 list-decimal space-y-1 text-text-secondary">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-nexus-500/50 pl-4 italic text-text-secondary">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className={`${className ?? ''} block`}>
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-surface-overlay px-1.5 py-0.5 text-xs font-mono text-nexus-300">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 text-sm font-mono leading-relaxed text-text-primary">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border bg-surface-raised">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-4 py-2 text-text-secondary">{children}</td>
        ),
        hr: () => <hr className="my-8 border-border" />,
        strong: ({ children }) => (
          <strong className="font-semibold text-text-primary">{children}</strong>
        ),
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ''} className="mb-4 max-w-full rounded-lg" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
