import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToastContext } from '../contexts/ToastContext';
import { ToastContainer } from '../components/ui/Toast';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      // Remove animation-related props
      const { layout, initial, animate, exit, transition, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function ToastDemo() {
  const { success, error, warning, info } = useToastContext();

  return (
    <div>
      <button data-testid="success" onClick={() => success('Success message')}>Trigger Success</button>
      <button data-testid="error" onClick={() => error('Error message')}>Trigger Error</button>
      <button data-testid="warning" onClick={() => warning('Warning message')}>Trigger Warning</button>
      <button data-testid="info" onClick={() => info('Info message')}>Trigger Info</button>
    </div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastContainer />
    </ToastProvider>
  );
}

describe('Toast Notification System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toast container with no toasts initially', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays a success toast with correct message', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('success'));

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Success message');
  });

  it('displays an error toast with correct message', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('error'));

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Error message');
  });

  it('displays a warning toast', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('warning'));

    expect(screen.getByRole('alert')).toHaveTextContent('Warning message');
  });

  it('displays an info toast', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('info'));

    expect(screen.getByRole('alert')).toHaveTextContent('Info message');
  });

  it('dismisses toast when close button is clicked', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('success'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('auto-dismisses toast after 5 seconds', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('success'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('success'));
    fireEvent.click(screen.getByTestId('error'));
    fireEvent.click(screen.getByTestId('warning'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
    expect(alerts[0]).toHaveTextContent('Success message');
    expect(alerts[1]).toHaveTextContent('Error message');
    expect(alerts[2]).toHaveTextContent('Warning message');
  });

  it('has accessible role="alert" on each toast', () => {
    render(
      <Wrapper>
        <ToastDemo />
      </Wrapper>
    );

    fireEvent.click(screen.getByTestId('success'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('throws error when useToastContext is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useToastContext();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useToastContext must be used within a ToastProvider'
    );

    spy.mockRestore();
  });
});
