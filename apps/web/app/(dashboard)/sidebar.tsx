'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';

const navItems = [
  { label: 'Agents', href: '/agents' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Workflows', href: '/workflows' },
  { label: 'Billing', href: '/billing' },
  { label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  userEmail: string | null;
  userName: string | null;
}

export function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    );
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const displayName = userName || userEmail?.split('@')[0] || 'User';

  const sidebarContent = (
    <>
      <Link href="/" className="mb-8 block text-lg font-bold text-nexus-400" onClick={() => setMobileOpen(false)}>
        NEXUS
      </Link>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-nexus-600/15 text-nexus-400'
                  : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-4">
        <Link
          href="/marketplace"
          onClick={() => setMobileOpen(false)}
          className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors flex items-center gap-1.5"
        >
          Marketplace
          <span className="text-xs text-text-secondary/50">&nearr;</span>
        </Link>
      </div>

      {/* User profile */}
      <div className="mt-auto border-t border-border pt-4">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
          {userEmail && (
            <p className="truncate text-xs text-text-secondary">{userEmail}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3 md:hidden">
        <Link href="/" className="text-lg font-bold text-nexus-400">NEXUS</Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-surface-raised p-4 transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface-raised p-4">
        {sidebarContent}
      </aside>
    </>
  );
}
