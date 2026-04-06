import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../contexts/ToastContext';

function Demo() {
  const { pushToast } = useToast();

  return (
    <div>
      <button
        onClick={() =>
          pushToast({
            title: 'Saved',
            description: 'Bounty updated successfully',
            variant: 'success',
            durationMs: 100,
          })
        }
      >
        Trigger success
      </button>
      <button
        onClick={() => {
          pushToast({ title: 'First', variant: 'info', durationMs: 1000 });
          pushToast({ title: 'Second', variant: 'warning', durationMs: 1000 });
        }}
      >
        Trigger stack
      </button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders a toast with alert role and dismiss control', () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Trigger success'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Bounty updated successfully');
    expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Trigger stack'));
    });

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
