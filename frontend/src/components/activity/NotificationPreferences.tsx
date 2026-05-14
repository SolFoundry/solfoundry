import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { NotificationPreferences } from '../../types/activity';
import { getEventLabel } from '../../types/activity';
import type { FeedEventType } from '../../types/activity';

interface NotificationPreferencesProps {
  prefs: NotificationPreferences;
  onUpdate: (update: Partial<NotificationPreferences>) => void;
}

const PREF_KEYS: (keyof NotificationPreferences)[] = [
  'BOUNTY_CREATED',
  'BOUNTY_FUNDED',
  'SUBMISSION_MADE',
  'REVIEW_COMPLETED',
  'LEADERBOARD_CHANGE',
  'escrow_created',
  'escrow_released',
  'reputation_updated',
];

export function NotificationPreferences({ prefs, onUpdate }: NotificationPreferencesProps) {
  const toggle = (key: keyof NotificationPreferences) => {
    onUpdate({ [key]: !prefs[key] });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-secondary">Notification Preferences</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PREF_KEYS.map(key => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-forge-800 border border-border text-sm transition-colors hover:border-forge-600"
          >
            <span className="text-text-secondary">{getEventLabel(key as FeedEventType)}</span>
            {prefs[key] ? (
              <Bell className="w-4 h-4 text-emerald" />
            ) : (
              <BellOff className="w-4 h-4 text-text-muted" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
