import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

function TestChild() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast('Operation successful!', 'success')}>Success</button>
      <button onClick={() => toast('Something went wrong.', 'error')}>Error</button>
      <button onClick={() => toast('Check this out.', 'warning')}>Warning</button>
      <button onClick={() => toast('Here is some info.', 'info')}>Info</button>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a success toast', async () => {
    render(
      <ToastProvider>
        <TestChild />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Success'));
    expect(screen.getByText('Operation successful!')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders all four variants', async () => {
    render(
      <ToastProvider>
        <TestChild />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Success'));
    await userEvent.click(screen.getByText('Error'));
    await userEvent.click(screen.getByText('Warning'));
    await userEvent.click(screen.getByText('Info'));

    expect(screen.getByText('Operation successful!')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('Check this out.')).toBeInTheDocument();
    expect(screen.getByText('Here is some info.')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', async () => {
    render(
      <ToastProvider>
        <TestChild />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Success'));
    expect(screen.getByText('Operation successful!')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Operation successful!')).not.toBeInTheDocument();
    });
  });

  it('allows manual dismiss', async () => {
    render(
      <ToastProvider>
        <TestChild />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Success'));
    expect(screen.getByText('Operation successful!')).toBeInTheDocument();

    const dismissButtons = screen.getAllByLabelText('Dismiss');
    await userEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Operation successful!')).not.toBeInTheDocument();
    });
  });

  it('stacks multiple toasts', async () => {
    render(
      <ToastProvider>
        <TestChild />
      </ToastProvider>
    );

    await userEvent.click(screen.getByText('Success'));
    await userEvent.click(screen.getByText('Error'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
  });

  it('throws when useToast is called outside ToastProvider', () => {
    expect(() => {
      render(<ToastThrower />);
    }).toThrow('useToast must be used within ToastProvider');
  });
});

function ToastThrower() {
  useToast();
  return null;
}
