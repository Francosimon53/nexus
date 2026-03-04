export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { label: 'Agents', href: '/agents' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Workflows', href: '/workflows' },
    { label: 'Billing', href: '/billing' },
    { label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-border bg-surface-raised p-4">
        <div className="mb-8 text-lg font-bold text-nexus-400">NEXUS</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
