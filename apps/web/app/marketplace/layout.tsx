import Link from 'next/link';

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-nexus-400">
              NEXUS
            </Link>
            <span className="text-sm text-text-secondary">Marketplace</span>
          </div>
          <Link
            href="/agents"
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
