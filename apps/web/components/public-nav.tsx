import Link from 'next/link';

export function PublicNav() {
  return (
    <header className="border-b border-border bg-surface-raised/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-nexus-400">
            NEXUS
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link
              href="/marketplace"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/docs"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Docs
            </Link>
            <a
              href="https://github.com/Francosimon53/nexus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
        <Link
          href="/agents"
          className="rounded-md bg-nexus-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </header>
  );
}
