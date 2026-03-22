/**
 * DisputeCard — Summary card for a dispute in list views.
 *
 * Displays dispute status, reason, bounty reference, and timestamps
 * in a compact card format. Links to the full dispute detail page.
 * @module components/disputes/DisputeCard
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { TimeAgo } from '../common/TimeAgo';
import type { DisputeListItem } from '../../types/dispute';
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_REASON_LABELS,
} from '../../types/dispute';
import type { DisputeReason, DisputeOutcome } from '../../types/dispute';

/** Color mappings for each dispute status. */
const STATUS_COLORS: Record<string, string> = {
  opened: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  evidence: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  mediation: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  under_review: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

/** Color mappings for dispute outcomes. */
const OUTCOME_COLORS: Record<string, string> = {
  release_to_contributor: 'text-green-400',
  refund_to_creator: 'text-red-400',
  split: 'text-yellow-400',
};

/** Props for the DisputeCard component. */
export interface DisputeCardProps {
  /** The dispute list item to display. */
  dispute: DisputeListItem;
}

/**
 * Compact card showing dispute summary information.
 *
 * Used in the dispute list view. Clicking navigates to the full
 * dispute detail page.
 */
export const DisputeCard: React.FC<DisputeCardProps> = ({ dispute }) => {
  const statusColor = STATUS_COLORS[dispute.status] || STATUS_COLORS.pending;
  const reasonLabel = DISPUTE_REASON_LABELS[dispute.reason as DisputeReason] || dispute.reason;
  const statusLabel = DISPUTE_STATUS_LABELS[dispute.status] || dispute.status;
  return (
    <Link
      to={`/disputes/${dispute.id}`}
      data-testid={`dispute-card-${dispute.id}`}
      className="block bg-gray-900 rounded-lg p-4 sm:p-5 border border-gray-800 hover:border-[#9945FF]/40 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
          data-testid="dispute-status-badge"
        >
          {statusLabel}
        </span>
        <span className="text-xs text-gray-500 font-mono">
          {dispute.id.slice(0, 8)}...
        </span>
      </div>

      <h3 className="text-sm font-medium text-white mb-2">
        {reasonLabel}
      </h3>

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <span>Bounty: {dispute.bounty_id.slice(0, 8)}...</span>
        <span className="inline-flex items-center gap-1">Filed: <TimeAgo date={dispute.created_at} className="text-xs text-gray-400" live={false} /></span>
      </div>

      {dispute.outcome && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <span className={`text-xs font-medium ${OUTCOME_COLORS[dispute.outcome] || 'text-gray-400'}`}>
            Outcome: {DISPUTE_OUTCOME_LABELS[dispute.outcome as DisputeOutcome] || dispute.outcome}
          </span>
          {dispute.resolved_at && (
            <span className="text-xs text-gray-500 ml-3 inline-flex items-center gap-1">
              Resolved: <TimeAgo date={dispute.resolved_at} className="text-xs text-gray-500" live={false} />
            </span>
          )}
        </div>
      )}
    </Link>
  );
};

export default DisputeCard;
