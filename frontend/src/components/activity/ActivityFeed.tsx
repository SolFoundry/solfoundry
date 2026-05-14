import React, { useState } from 'react';
import { RefreshCw, Bell, Wifi, WifiOff, Loader2, SlidersHorizontal, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { ActivityEventCard } from './ActivityEventCard';
import { ActivityFilterBar } from './ActivityFilterBar';
import { NotificationPreferences } from './NotificationPreferences';
import type { FeedEventType, ConnectionStatus } from '../../types/activity';
import { staggerContainer, staggerItem } from '../../lib/animations';

/* ─── Connection badge ─── */

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: 'Live', color: 'text-emerald', icon: Wifi },
  reconnecting: { label: 'Reconnecting', color: 'text-amber-400', icon: RefreshCw },
  disconnected: { label: 'Offline', color: 'text-red-400', icon: WifiOff },
  polling: { label: 'Polling', color: 'text-blue-400', icon: Loader2 },
};

export function ActivityFeed() {
  const {
    events,
    status,
    filters,
    setFilters,
    prefs,
    updatePrefs,
    reconnect,
  } = useActivityFeed();

  const [showPrefs, setShowPrefs] = useState(false);
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-wide">
              Activity Feed
            </h2>
            <p className="mt-2 text-text-secondary text-base">
              Real-time bounty, submission, and review events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${status === 'reconnecting' || status === 'polling' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </span>

            {/* Reconnect */}
            {(status === 'disconnected' || status === 'polling') && (
              <button
                onClick={reconnect}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:border-emerald hover:text-emerald transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Reconnect
              </button>
            )}

            {/* Notification prefs toggle */}
            <button
              onClick={() => setShowPrefs(v => !v)}
              className={`p-2 rounded-lg transition-colors ${
                showPrefs ? 'bg-forge-800 text-emerald' : 'text-text-muted hover:text-text-secondary'
              }`}
              title="Notification preferences"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification preferences panel */}
        <AnimatePresence>
          {showPrefs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-4 rounded-xl border border-border bg-forge-900/50">
                <NotificationPreferences prefs={prefs} onUpdate={updatePrefs} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Filter</span>
          </div>
          <ActivityFilterBar
            selected={filters}
            onChange={(next) => setFilters(next as Set<FeedEventType>)}
          />
        </div>

        {/* Event list */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-2"
        >
          {events.length === 0 && (
            <div className="text-center py-16">
              <Activity className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted">No activity yet. Events will appear here in real-time.</p>
            </div>
          )}

          {events.map(event => (
            <motion.div key={event.id} variants={staggerItem}>
              <ActivityEventCard event={event} />
            </motion.div>
          ))}
        </motion.div>

        {/* Load more hint */}
        {events.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-text-muted">
              Showing latest {events.length} events {filters.size > 0 ? '(filtered)' : ''}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}


