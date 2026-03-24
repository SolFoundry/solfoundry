/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary, ErrorPage } from './ErrorBoundary';

// Suppress React error boundary console.error noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('ErrorBoundary') ||
        args[0].includes('The above error') ||
        args[0].includes('React will try to recreate'))
    )
      return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

/** Helper: a component that throws */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error');
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('catches render errors and shows error UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('shows the error message', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Test render error')).toBeTruthy();
  });

  it('shows a "Try again" button when error is caught', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a "Go home" link', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('link', { name: 'Go home' })).toBeTruthy();
  });

  it('shows a "Report issue" link', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('link', { name: /report issue/i })).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Oops!</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
  });
});

describe('ErrorPage (standalone)', () => {
  it('renders error message', () => {
    render(<ErrorPage error={new Error('Something exploded')} />);
    expect(screen.getByText('Something exploded')).toBeTruthy();
  });

  it('renders without error message gracefully', () => {
    render(<ErrorPage />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders eventId when provided', () => {
    render(<ErrorPage eventId="abc-123" />);
    expect(screen.getByText(/abc-123/)).toBeTruthy();
  });

  it('calls onRetry when Try again is clicked', () => {
    const retry = vi.fn();
    render(<ErrorPage onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('does not render Try again when onRetry is not provided', () => {
    render(<ErrorPage />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
