/**
 * DisputeListPage — Paginated list of disputes for the current user.
 *
 * Route: /disputes
 *
 * Displays all disputes where the current user is a participant
 * (as contributor or creator). Supports filtering by status and
 * pagination. Links to individual dispute detail pages.
 * @module pages/DisputeListPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispute } from '../hooks/useDispute';
import { DisputeCard } from '../components/disputes/DisputeCard';
import { DISPUTE_STATUS_LABELS } from '../types/dispute';
import type { DisputeStatus } from '../types/dispute';

/** Status filter options for the list view. */
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(DISPUTE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

/** Page size for the dispute list. */
const PAGE_SIZE = 20;

/** Loading skeleton for the list page. */
function DisputeListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-gray-900 rounded-lg p-5 h-28" />
      ))}
    </div>
  );
}

/**
 * Page component for listing the current user's disputes.
 *
 * Provides status filtering, pagination, and empty state handling.
 * Each dispute is rendered as a clickable DisputeCard that links
 * to the full detail page.
 */
export default function DisputeListPage() {
  const { disputes, loading, error, total, fetchDisputes } = useDispute();
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const loadDisputes = useCallback(() => {
    fetchDisputes({
      status: statusFilter || undefined,
      skip: currentPage * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
  }, [fetchDisputes, statusFilter, currentPage]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Disputes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track and manage your dispute resolutions
          </p>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#9945FF] focus:outline-none min-w-[160px]"
          data-testid="status-filter"
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && disputes.length === 0 && <DisputeListSkeleton />}

      {/* Empty State */}
      {!loading && disputes.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 text-gray-600">No disputes</div>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {statusFilter
              ? `No disputes with status "${DISPUTE_STATUS_LABELS[statusFilter as DisputeStatus] || statusFilter}".`
              : 'You have no disputes. Disputes are created when a submission rejection is contested.'}
          </p>
        </div>
      )}

      {/* Dispute List */}
      {disputes.length > 0 && (
        <div className="space-y-3" data-testid="dispute-list">
          {disputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {currentPage + 1} of {totalPages} ({total} total)
          </span>
          <button
            onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
