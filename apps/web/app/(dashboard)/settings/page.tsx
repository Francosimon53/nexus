import { requireUser } from '@/lib/auth';
import { PasswordSection } from './password-section';
import { ProfileSection } from './profile-section';

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-text-secondary">Manage your account and preferences.</p>

      <div className="mt-8 space-y-6 max-w-2xl">
        {/* Account info (read-only) */}
        <section className="rounded-lg border border-border bg-surface-raised p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <p className="text-sm text-text-primary">{user.email}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">User ID</label>
              <p className="text-sm font-mono text-text-secondary">{user.id}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Joined</label>
              <p className="text-sm text-text-secondary">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </section>

        <ProfileSection
          currentName={user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''}
        />

        <PasswordSection />
      </div>
    </div>
  );
}
