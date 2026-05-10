import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './ToastProvider';

function ToastButtons() {
  const { showToast } = useToast();

  return (
    <div>
      <button onClick={() => showToast({ type: 'success', title: 'Saved bounty' })}>success</button>
      <button onClick={() => showToast({ type: 'error', title: 'Upload failed' })}>error</button>
      <button onClick={() => showToast({ type: 'warning', title: 'Deadline soon' })}>warning</button>
      <button onClick={() => showToast({ type: 'info', title: 'Review started' })}>info</button>
    </div>
  );
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders accessible stacked toast variants and allows manual close', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await user.click(screen.getByText('success'));
    await user.click(screen.getByText('error'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(screen.getByText('Saved bounty')).toHaveClass('text-status-success');
    expect(screen.getByText('Upload failed')).toHaveClass('text-status-error');

    await user.click(screen.getAllByLabelText(/dismiss notification/i)[0]);

    expect(screen.queryByText('Saved bounty')).not.toBeInTheDocument();
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('auto-dismisses toast notifications after five seconds', async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('info'));

    expect(screen.getByText('Review started')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByText('Review started')).not.toBeInTheDocument();
  });
});
