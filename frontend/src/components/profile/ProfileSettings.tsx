/**
 * ProfileSettings — settings page for updating display name, bio,
 * website, and social links. Integrates with the /api/profile/me endpoint.
 *
 * No external dependencies.
 */
import { useState, useCallback, type FormEvent } from 'react';

interface ProfileSettingsProps {
  /** Current profile data. */
  initialData?: {
    display_name?: string;
    bio?: string;
    website?: string;
    twitter?: string;
    username?: string;
    avatar_url?: string;
  };
  /** Called after a successful save. */
  onSave?: () => void;
}

export function ProfileSettings({ initialData, onSave }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(initialData?.display_name ?? '');
  const [bio, setBio] = useState(initialData?.bio ?? '');
  const [website, setWebsite] = useState(initialData?.website ?? '');
  const [twitter, setTwitter] = useState(initialData?.twitter ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setMessage(null);

      try {
        const resp = await fetch('/api/profile/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName || undefined,
            bio: bio || undefined,
            website: website || undefined,
            twitter: twitter || undefined,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(err.detail ?? 'Failed to update profile');
        }

        setMessage({ type: 'success', text: 'Profile updated successfully' });
        onSave?.();
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
      } finally {
        setSaving(false);
      }
    },
    [displayName, bio, website, twitter, onSave],
  );

  return (
    <div className="bg-white dark:bg-surface-100 rounded-xl border border-gray-200 dark:border-white/5 p-6 shadow-sm dark:shadow-none max-w-xl">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Profile Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-200 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-solana-purple focus:border-transparent outline-none"
            placeholder="How you want to be known"
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-200 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-solana-purple focus:border-transparent outline-none resize-none"
            placeholder="Tell the community about yourself"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">{bio.length}/280</span>
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={256}
            className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-200 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-solana-purple focus:border-transparent outline-none"
            placeholder="https://yoursite.com"
          />
        </div>

        {/* Twitter */}
        <div>
          <label htmlFor="twitter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Twitter / X
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">@</span>
            <input
              id="twitter"
              type="text"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value.replace(/^@/, ''))}
              maxLength={64}
              className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-200 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-solana-purple focus:border-transparent outline-none"
              placeholder="handle"
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`text-sm px-3 py-2 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-solana-purple hover:bg-solana-purple/90 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

export default ProfileSettings;
