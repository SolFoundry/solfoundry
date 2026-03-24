/**
 * Tests for the EventFeed component and useEventFeed hooks.
 *
 * Validates rendering of the event feed widget, event type filtering,
 * connection status display, and proper handling of empty/populated states.
 *
 * @module __tests__/event-feed.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks before importing the component
vi.mock('../../hooks/useEventFeed', () => ({
  useRealtimeEventFeed: vi.fn(),
  useIndexerHealth: vi.fn(),
}));

// We need to import after mocking
import { EventFeed } from '../components/activity/EventFeed';
import { useRealtimeEventFeed, useIndexerHealth } from '../hooks/useEventFeed';
import type { IndexedEvent, IndexerHealth } from '../hooks/useEventFeed';

const mockUseRealtimeEventFeed = useRealtimeEventFeed as ReturnType<typeof vi.fn>;
const mockUseIndexerHealth = useIndexerHealth as ReturnType<typeof vi.fn>;

/** Create a fresh QueryClient for each test to prevent state leaking. */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/** Wrapper component providing React Query context. */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const client = createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/** Sample indexed events for testing. */
const SAMPLE_EVENTS: IndexedEvent[] = [
  {
    id: 'evt-1',
    transaction_signature: 'A'.repeat(88),
    log_index: 0,
    event_type: 'escrow_created',
    program_id: 'TestProgram',
    block_slot: 100,
    block_time: new Date().toISOString(),
    source: 'helius',
    accounts: {},
    data: {},
    user_wallet: 'W'.repeat(44),
    bounty_id: 'bounty-1',
    amount: 350000,
    status: 'confirmed',
    indexed_at: new Date().toISOString(),
  },
  {
    id: 'evt-2',
    transaction_signature: 'B'.repeat(88),
    log_index: 0,
    event_type: 'escrow_released',
    program_id: 'TestProgram',
    block_slot: 101,
    block_time: new Date().toISOString(),
    source: 'helius',
    accounts: {},
    data: {},
    user_wallet: 'X'.repeat(44),
    bounty_id: 'bounty-2',
    amount: 500000,
    status: 'confirmed',
    indexed_at: new Date().toISOString(),
  },
  {
    id: 'evt-3',
    transaction_signature: 'C'.repeat(88),
    log_index: 0,
    event_type: 'reputation_updated',
    program_id: 'TestProgram',
    block_slot: 102,
    block_time: new Date().toISOString(),
    source: 'shyft',
    accounts: {},
    data: {},
    user_wallet: null,
    bounty_id: null,
    amount: null,
    status: 'confirmed',
    indexed_at: new Date().toISOString(),
  },
];

describe('EventFeed component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component title and connection status', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: [],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('On-Chain Events')).toBeDefined();
    expect(screen.getByText('Live')).toBeDefined();
  });

  it('shows polling status when WebSocket is disconnected', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: false,
      events: [],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('Polling')).toBeDefined();
    expect(screen.getByText('Reconnect')).toBeDefined();
  });

  it('renders events when available', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: SAMPLE_EVENTS,
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('Escrow Created')).toBeDefined();
    expect(screen.getByText('Escrow Released')).toBeDefined();
    expect(screen.getByText('Reputation Updated')).toBeDefined();
    expect(screen.getByText('3 events')).toBeDefined();
  });

  it('shows empty state when no events', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: [],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('Waiting for on-chain events...')).toBeDefined();
  });

  it('filters events by type when filter is selected', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: SAMPLE_EVENTS,
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    // Select the escrow_created filter
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'escrow_created' } });

    // Should only show 1 event now
    expect(screen.getByText('1 event')).toBeDefined();
  });

  it('shows indexer health warning when unhealthy', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: [],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({
      data: {
        sources: [{ source: 'helius', is_healthy: false, events_processed: 100 }],
        overall_healthy: false,
      },
      isLoading: false,
    });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('Indexer Behind')).toBeDefined();
  });

  it('displays total indexed count from health data', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: SAMPLE_EVENTS,
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({
      data: {
        sources: [
          { source: 'helius', is_healthy: true, events_processed: 1500 },
          { source: 'shyft', is_healthy: true, events_processed: 500 },
        ],
        overall_healthy: true,
      },
      isLoading: false,
    });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('2,000 total indexed')).toBeDefined();
  });

  it('renders amount for events with token transfers', () => {
    mockUseRealtimeEventFeed.mockReturnValue({
      connected: true,
      events: [SAMPLE_EVENTS[0]],
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });
    mockUseIndexerHealth.mockReturnValue({ data: null, isLoading: false });

    render(
      <TestWrapper>
        <EventFeed />
      </TestWrapper>
    );

    expect(screen.getByText('350,000 $FNDRY')).toBeDefined();
  });
});
