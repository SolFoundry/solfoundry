/**
 * ProfileSettingsPage — lets an authenticated user edit their profile
 * (display name, bio, skills, social links) and notification preferences.
 */
import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '../contexts/AuthContext';
import { getMyProfile, updateMyProfile, updateMySettings, UserProfile } from '../services/authService';
import { useToast } from '../hooks/useToast';

// ── Skill tag input ───────────────────────────────────────────────────────────
function SkillTags({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function addSkill() {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInput('');
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs
                       bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(skills.filter(x => x !== s))}
              className="ml-0.5 text-brand-500 hover:text-red-500 transition-colors"
              aria-label={`Remove ${s}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="Add a skill (e.g. rust)"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 px-3 py-2 text-sm
                     text-gray-900 dark:text-white placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={addSkill}
          className="px-3 py-2 rounded-lg bg-brand-500 text-white text-sm
                     hover:bg-brand-600 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Notification preference toggle ───────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                    ${checked ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                      ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800
                    bg-white dark:bg-gray-900 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfileSettingsPage() {
  const { user, updateUser } = useAuthContext();
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
    enabled: !!user,
  });

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');

  // Notification state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  // Populate form when profile loads
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setSkills(profile.skills ?? []);
    setGithub(profile.social_links?.github ?? '');
    setTwitter(profile.social_links?.twitter ?? '');
    setWebsite(profile.social_links?.website ?? '');
    setEmailEnabled(profile.email_notifications_enabled);
    setNotifPrefs(profile.notification_preferences ?? {});
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: data => {
      qc.setQueryData(['my-profile'], data);
      updateUser({ username: data.username, avatar_url: data.avatar_url ?? undefined });
      addToast({ variant: 'success', message: 'Profile updated' });
    },
    onError: () => addToast({ variant: 'error', message: 'Failed to update profile' }),
  });

  const settingsMutation = useMutation({
    mutationFn: updateMySettings,
    onSuccess: data => {
      qc.setQueryData(['my-profile'], data);
      addToast({ variant: 'success', message: 'Notification preferences saved' });
    },
    onError: () => addToast({ variant: 'error', message: 'Failed to save preferences' }),
  });

  function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    profileMutation.mutate({
      display_name: displayName,
      bio,
      skills,
      social_links: {
        ...(github ? { github } : {}),
        ...(twitter ? { twitter } : {}),
        ...(website ? { website } : {}),
      },
    });
  }

  function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    settingsMutation.mutate({
      email_notifications_enabled: emailEnabled,
      notification_preferences: notifPrefs,
    });
  }

  const NOTIF_LABELS: Record<string, string> = {
    bounty_claimed: 'New bounty claimed',
    pr_submitted: 'PR submitted for review',
    review_complete: 'AI review complete',
    payout_sent: 'Payout sent',
    new_bounty_matching_skills: 'New bounty matching your skills',
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your public profile and notification preferences.
        </p>
      </div>

      {/* ── Identity read-only ── */}
      <Section title="Identity">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-400 to-purple-500
                            flex items-center justify-center text-white text-xl font-bold">
              {(profile?.username ?? 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">@{profile?.username}</p>
            {profile?.wallet_address && (
              <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                {profile.wallet_address.slice(0, 8)}…{profile.wallet_address.slice(-6)}
                {profile.wallet_verified && (
                  <span className="ml-1 text-green-500 font-sans" title="Verified">✓ verified</span>
                )}
              </p>
            )}
            <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{profile?.total_bounties_completed ?? 0} bounties</span>
              <span>{(profile?.reputation_score ?? 0).toFixed(1)} rep</span>
              <span>{(profile?.total_earnings ?? 0).toFixed(2)} FNDRY earned</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Profile form ── */}
      <Section title="Public Profile">
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={100}
              placeholder="Your display name"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 px-3 py-2 text-sm
                         text-gray-900 dark:text-white placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Tell the community about yourself"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none
                         text-gray-900 dark:text-white placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400 text-right">{bio.length}/1000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Skills
            </label>
            <SkillTags skills={skills} onChange={setSkills} />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Social Links
            </label>
            {[
              { label: 'GitHub', value: github, set: setGithub, placeholder: 'github.com/username' },
              { label: 'Twitter / X', value: twitter, set: setTwitter, placeholder: 'twitter.com/username' },
              { label: 'Website', value: website, set: setWebsite, placeholder: 'https://yoursite.com' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                <input
                  type="text"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-800 px-3 py-2 text-sm
                             text-gray-900 dark:text-white placeholder-gray-400
                             focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending}
              className="px-5 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium
                         hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {profileMutation.isPending ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Notification settings ── */}
      <Section title="Notifications">
        <form onSubmit={handleSettingsSubmit} className="space-y-4">
          <Toggle
            checked={emailEnabled}
            onChange={setEmailEnabled}
            label="Email notifications"
          />

          {emailEnabled && (
            <div className="mt-3 space-y-3 pl-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Notify me when…
              </p>
              {Object.entries(NOTIF_LABELS).map(([key, label]) => (
                <Toggle
                  key={key}
                  checked={notifPrefs[key] ?? true}
                  onChange={v => setNotifPrefs(p => ({ ...p, [key]: v }))}
                  label={label}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={settingsMutation.isPending}
              className="px-5 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium
                         hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {settingsMutation.isPending ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
