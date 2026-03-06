import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface-raised/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <Link href="/" className="font-semibold text-nexus-400 hover:text-nexus-300 transition-colors">
            NEXUS
          </Link>
          <span>— Agent Economy Protocol</span>
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/marketplace" className="hover:text-text-primary transition-colors">
            Marketplace
          </Link>
          <Link href="/docs" className="hover:text-text-primary transition-colors">
            Docs
          </Link>
          <Link href="/agents" className="hover:text-text-primary transition-colors">
            Dashboard
          </Link>
          <a
            href="https://github.com/Francosimon53/nexus"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
