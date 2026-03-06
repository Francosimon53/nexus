import { Sidebar } from './sidebar';
import { getUser } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={user?.email ?? null}
        userName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null}
      />
      <main className="flex-1 p-4 pt-16 md:p-8 md:pt-8">{children}</main>
    </div>
  );
}
