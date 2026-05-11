import React, { type HTMLAttributes, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../components/toast/ToastProvider';

vi.mock('framer-motion', async () => {
  const React = await import('react');

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: {
      div: ({
        children,
        initial,
        animate,
        exit,
        transition,
        ...props
      }: HTMLAttributes<HTMLDivElement> & {
        children?: ReactNode;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }) => React.createElement('div', props, children),
    },
  };
});

function ToastHarness() {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success('Saved bounty')}>Success</button>
      <button type="button" onClick={() => toast.error('Failed bounty')}>Error</button>
      <button type="button" onClick={() => toast.warning('Check bounty')}>Warning</button>
      <button type="button" onClick={() => toast.info('Loaded bounty')}>Info</button>
    </div>
  );
}

function renderHarness() {
  render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders accessible stacked toast notifications', () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /success/i }));
    fireEvent.click(screen.getByRole('button', { name: /error/i }));
    fireEvent.click(screen.getByRole('button', { name: /warning/i }));
    fireEvent.click(screen.getByRole('button', { name: /info/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(4);
    expect(screen.getByText('Saved bounty')).toBeInTheDocument();
    expect(screen.getByText('Failed bounty')).toBeInTheDocument();
    expect(screen.getByText('Check bounty')).toBeInTheDocument();
    expect(screen.getByText('Loaded bounty')).toBeInTheDocument();
  });

  it('dismisses a toast manually', () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /success/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(screen.queryByText('Saved bounty')).not.toBeInTheDocument();
  });

  it('auto-dismisses a toast after five seconds', () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /success/i }));
    expect(screen.getByText('Saved bounty')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByText('Saved bounty')).not.toBeInTheDocument();
  });
});
