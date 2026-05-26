import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../contexts/ToastContext';

function ToastHarness() {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => toast.success('Bounty published')}>Success</button>
      <button onClick={() => toast.error('Submission failed')}>Error</button>
      <button onClick={() => toast.warning('Verify fee first')}>Warning</button>
      <button onClick={() => toast.info('Treasury copied')}>Info</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('renders all variants as accessible alerts and stacks multiple toasts', () => {
    renderHarness();

    fireEvent.click(screen.getByText('Success'));
    fireEvent.click(screen.getByText('Error'));
    fireEvent.click(screen.getByText('Warning'));
    fireEvent.click(screen.getByText('Info'));

    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(screen.getByText('Bounty published')).toBeInTheDocument();
    expect(screen.getByText('Submission failed')).toBeInTheDocument();
    expect(screen.getByText('Verify fee first')).toBeInTheDocument();
    expect(screen.getByText('Treasury copied')).toBeInTheDocument();
  });

  it('supports manual dismiss', async () => {
    renderHarness();

    fireEvent.click(screen.getByText('Success'));
    fireEvent.click(screen.getByLabelText(/dismiss notification/i));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('auto-dismisses after five seconds by default', async () => {
    vi.useFakeTimers();
    renderHarness();

    fireEvent.click(screen.getByText('Info'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5200);
    });

    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
