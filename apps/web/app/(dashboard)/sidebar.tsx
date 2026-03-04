'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Agents', href: '/agents' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Workflows', href: '/workflows' },
  { label: 'Billing', href: '/billing' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-surface-raised p-4">
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
      <div className="mt-auto pt-8">
        <Link
          href="/marketplace"
          className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors flex items-center gap-1.5"
        >
          Marketplace
          <span className="text-xs text-text-secondary/50">&nearr;</span>
        </Link>
      </div>
    </aside>
  );
}
