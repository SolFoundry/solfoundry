import React from 'react';
import { Link } from 'react-router-dom';
import type { DisputeListItem } from '../../types/dispute';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatReason(reason: string): string {
  return reason
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatOutcome(outcome: string): string {
  const MAP: Record<string, string> = {
    release_to_contributor: 'Released to Contributor',
    return_to_poster: 'Returned to Poster',
    partial_release: 'Partial Release',
    dismissed: 'Dismissed',
  };
  return MAP[outcome] ?? formatReason(outcome);
}

const STATUS_STYLES: Record<string, string> = {
  opened:    'bg-yellow-500/20 text-yellow-400',
  evidence:  'bg-blue-500/20 text-blue-400',
  mediation: 'bg-purple-500/20 text-purple-400',
  resolved:  'bg-[#14F195]/20 text-[#14F195]',
  closed:    'bg-white/10 text-white/40',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  dispute: DisputeListItem;
}

export function DisputeCard({ dispute }: Props) {
  const statusLabel = dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1);

  return (
    <Link
      data-testid={`dispute-card-${dispute.id}`}
      to={`/disputes/${dispute.id}`}
      href={`/disputes/${dispute.id}`}
      className="block bg-[#0d0d1a] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          data-testid="dispute-status-badge"
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[dispute.status] ?? 'bg-white/10 text-white/50'}`}
        >
          {statusLabel}
        </span>
        <span className="text-xs text-white/30">{fmtDate(dispute.created_at)}</span>
      </div>

      {/* Reason */}
      <p className="text-sm font-semibold text-white mb-1">{formatReason(dispute.reason)}</p>

      {/* Bounty ID */}
      <p className="text-xs text-white/40 font-mono truncate mb-2">{dispute.bounty_id}</p>

      {/* Meta */}
      <p className="text-xs text-white/40">Filed: {fmtDate(dispute.created_at)}</p>

      {/* Outcome */}
      {dispute.outcome && (
        <p className="text-xs text-[#14F195] mt-2 font-medium">{formatOutcome(dispute.outcome)}</p>
      )}
    </Link>
  );
}
