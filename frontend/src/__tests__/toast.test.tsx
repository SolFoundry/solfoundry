import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast } from '../contexts/ToastContext';

// Mock framer-motion to avoid animation issues in test environment
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, layout, ...rest } = props as Record<string, unknown>;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Helper component that surfaces toast actions for testing
function ToastTrigger() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success title', 'Success description')}>
        Trigger success
      </button>
      <button onClick={() => toast.error('Error title', 'Error description')}>
        Trigger error
      </button>
      <button onClick={() => toast.warning('Warning title', 'Warning description')}>
        Trigger warning
      </button>
      <button onClick={() => toast.info('Info title', 'Info description')}>
        Trigger info
      </button>
    </div>
  );
}

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Toast notification system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a success toast on trigger', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger success'));
    expect(screen.getByText('Success title')).toBeInTheDocument();
    expect(screen.getByText('Success description')).toBeInTheDocument();
  });

  it('renders an error toast on trigger', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger error'));
    expect(screen.getByText('Error title')).toBeInTheDocument();
    expect(screen.getByText('Error description')).toBeInTheDocument();
  });

  it('renders a warning toast on trigger', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger warning'));
    expect(screen.getByText('Warning title')).toBeInTheDocument();
    expect(screen.getByText('Warning description')).toBeInTheDocument();
  });

  it('renders an info toast on trigger', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger info'));
    expect(screen.getByText('Info title')).toBeInTheDocument();
    expect(screen.getByText('Info description')).toBeInTheDocument();
  });

  it('auto-dismisses toast after 5 seconds', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger success'));
    expect(screen.getByText('Success title')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5001));
    expect(screen.queryByText('Success title')).not.toBeInTheDocument();
  });

  it('dismisses toast on close button click', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger info'));
    expect(screen.getByText('Info title')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('Info title')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger success'));
    fireEvent.click(screen.getByText('Trigger warning'));
    fireEvent.click(screen.getByText('Trigger error'));

    expect(screen.getByText('Success title')).toBeInTheDocument();
    expect(screen.getByText('Warning title')).toBeInTheDocument();
    expect(screen.getByText('Error title')).toBeInTheDocument();
  });

  it('uses role="alert" for accessibility', () => {
    renderWithToast(<ToastTrigger />);
    fireEvent.click(screen.getByText('Trigger success'));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});