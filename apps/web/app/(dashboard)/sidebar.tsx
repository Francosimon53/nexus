'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

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

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-surface-raised p-4">
      <Link href="/" className="mb-8 block text-lg font-bold text-nexus-400">
        NEXUS
      </Link>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}
