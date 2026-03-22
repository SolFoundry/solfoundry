/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { Toast } from './Toast';
import { ToastContainer } from './ToastContainer';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import type { Toast as ToastType } from '../../types/toast';

// ============================================================================
// Helpers
// ============================================================================

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

/** Renders a component that immediately calls useToast() and exposes the result. */
function ToastConsumer({ onMount }: { onMount: (ctx: ReturnType<typeof useToast>) => void }) {
  const ctx = useToast();
  // Call on mount so tests can capture the API
  onMount(ctx);
  return null;
}

/** Helper to build a minimal Toast object. */
function makeToast(overrides: Partial<ToastType> = {}): ToastType {
  return {
    id: 'test-id-1',
    message: 'Test message',
    variant: 'info',
    duration: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// ToastContext tests
// ============================================================================

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders children without crashing', () => {
    render(
      <ToastProvider>
        <span data-testid="child">hello</span>
      </ToastProvider>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('success() adds a success toast', async () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.success('Great job!'); });
    expect(screen.getByText('Great job!')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('error() adds an error toast', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.error('Something broke'); });
    expect(screen.getByText('Something broke')).toBeTruthy();
  });

  it('warning() adds a warning toast', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.warning('Watch out!'); });
    expect(screen.getByText('Watch out!')).toBeTruthy();
  });

  it('info() adds an info toast', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.info('FYI: update available'); });
    expect(screen.getByText('FYI: update available')).toBeTruthy();
  });

  it('addToast() returns a unique string id', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    let id1: string;
    let id2: string;
    act(() => {
      id1 = ctx!.addToast({ message: 'First', variant: 'info', duration: 0 });
      id2 = ctx!.addToast({ message: 'Second', variant: 'info', duration: 0 });
    });
    expect(typeof id1!).toBe('string');
    expect(typeof id2!).toBe('string');
    expect(id1!).not.toBe(id2!);
  });

  it('addToast() with duration=0 does not auto-dismiss', async () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.addToast({ message: 'Sticky toast', variant: 'info', duration: 0 }); });
    expect(screen.getByText('Sticky toast')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(10000); });
    // Still present
    expect(screen.getByText('Sticky toast')).toBeTruthy();
  });

  it('addToast() with custom duration auto-dismisses after that duration', async () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.addToast({ message: 'Timed toast', variant: 'info', duration: 1000 }); });
    expect(screen.getByText('Timed toast')).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByText('Timed toast')).toBeNull();
  });

  it('removeToast() removes a toast by id', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    let id: string;
    act(() => { id = ctx!.addToast({ message: 'Removable', variant: 'info', duration: 0 }); });
    expect(screen.getByText('Removable')).toBeTruthy();

    act(() => { ctx!.removeToast(id!); });
    expect(screen.queryByText('Removable')).toBeNull();
  });

  it('limits visible toasts to 3 (MAX_VISIBLE_TOASTS)', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => {
      ctx!.addToast({ message: 'Toast A', variant: 'info', duration: 0 });
      ctx!.addToast({ message: 'Toast B', variant: 'info', duration: 0 });
      ctx!.addToast({ message: 'Toast C', variant: 'info', duration: 0 });
      ctx!.addToast({ message: 'Toast D', variant: 'info', duration: 0 });
    });

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(3);
    // The oldest (Toast A) is dropped in favour of the newest three
    expect(screen.queryByText('Toast A')).toBeNull();
  });

  it('each toast has a unique id', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    const ids: string[] = [];
    act(() => {
      ids.push(ctx!.addToast({ message: 'M1', variant: 'info', duration: 0 }));
      ids.push(ctx!.addToast({ message: 'M2', variant: 'info', duration: 0 }));
      ids.push(ctx!.addToast({ message: 'M3', variant: 'info', duration: 0 }));
    });

    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it('useToast() throws when used outside ToastProvider', () => {
    function BadConsumer() {
      useToast();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
  });
});

// ============================================================================
// Toast component tests
// ============================================================================

describe('Toast component', () => {
  it('renders the toast message', () => {
    const toast = makeToast({ message: 'Hello world' });
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders a dismiss button', () => {
    const toast = makeToast();
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });

  it('calls onDismiss with the toast id when dismiss is clicked', async () => {
    const onDismiss = vi.fn();
    const toast = makeToast({ id: 'abc-123' });
    render(<Toast toast={toast} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    // onDismiss is called after a 200 ms animation delay
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('abc-123');
    }, { timeout: 500 });
  });

  it('renders success variant with aria role="alert"', () => {
    const toast = makeToast({ variant: 'success' });
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders error variant', () => {
    const toast = makeToast({ variant: 'error', message: 'Error occurred' });
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Error occurred')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders warning variant', () => {
    const toast = makeToast({ variant: 'warning', message: 'Warning issued' });
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Warning issued')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders info variant', () => {
    const toast = makeToast({ variant: 'info', message: 'Just so you know' });
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Just so you know')).toBeTruthy();
  });

  it('shows the progress bar when duration > 0', () => {
    const toast = makeToast({ duration: 5000 });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    // The progress bar wrapper is a div with h-0.5
    const progressWrapper = container.querySelector('.h-0\\.5');
    expect(progressWrapper).toBeTruthy();
  });

  it('hides the progress bar when duration = 0', () => {
    const toast = makeToast({ duration: 0 });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    const progressWrapper = container.querySelector('.h-0\\.5');
    expect(progressWrapper).toBeNull();
  });

  it('has aria-live="assertive" on the alert element', () => {
    const toast = makeToast();
    render(<Toast toast={toast} onDismiss={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('applies the correct border class for success variant', () => {
    const toast = makeToast({ variant: 'success' });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    expect(container.firstChild?.toString()).toBeTruthy();
    const el = container.querySelector('[role="alert"]');
    expect(el?.className).toContain('emerald');
  });

  it('applies the correct border class for error variant', () => {
    const toast = makeToast({ variant: 'error' });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    const el = container.querySelector('[role="alert"]');
    expect(el?.className).toContain('red');
  });

  it('applies the correct border class for warning variant', () => {
    const toast = makeToast({ variant: 'warning' });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    const el = container.querySelector('[role="alert"]');
    expect(el?.className).toContain('amber');
  });

  it('applies the correct border class for info variant', () => {
    const toast = makeToast({ variant: 'info' });
    const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
    const el = container.querySelector('[role="alert"]');
    expect(el?.className).toContain('blue');
  });
});

// ============================================================================
// ToastContainer tests
// ============================================================================

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(
      <Wrapper>
        <ToastContainer />
      </Wrapper>,
    );
    // createPortal renders into document.body, not container
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('renders toasts when present', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.info('Container toast test'); });
    expect(screen.getByText('Container toast test')).toBeTruthy();
  });

  it('renders at most 3 toasts (MAX_VISIBLE_TOASTS)', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => {
      ctx!.info('First', 0);
      ctx!.info('Second', 0);
      ctx!.info('Third', 0);
      ctx!.info('Fourth', 0);
    });

    expect(screen.getAllByRole('alert').length).toBe(3);
  });

  it('renders the notifications landmark with the correct label', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.success('Landmark test', 0); });
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('removes a toast from the container when dismissed', async () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
        <ToastContainer />
      </Wrapper>,
    );

    act(() => { ctx!.error('Dismiss me', 0); });
    expect(screen.getByText('Dismiss me')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    // The Toast component uses a 200 ms exit animation before calling onDismiss
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText('Dismiss me')).toBeNull();
  });
});

// ============================================================================
// useToast hook tests
// ============================================================================

describe('useToast hook', () => {
  it('returns all expected methods and state', () => {
    let ctx: ReturnType<typeof useToast> | null = null;

    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    expect(ctx).not.toBeNull();
    expect(typeof ctx!.success).toBe('function');
    expect(typeof ctx!.error).toBe('function');
    expect(typeof ctx!.warning).toBe('function');
    expect(typeof ctx!.info).toBe('function');
    expect(typeof ctx!.addToast).toBe('function');
    expect(typeof ctx!.removeToast).toBe('function');
    expect(Array.isArray(ctx!.toasts)).toBe(true);
  });

  it('toasts array starts empty', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );
    expect(ctx!.toasts.length).toBe(0);
  });

  it('toasts array grows after adding a toast', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    act(() => { ctx!.addToast({ message: 'Count test', variant: 'info', duration: 0 }); });
    expect(ctx!.toasts.length).toBe(1);
  });

  it('toasts array shrinks after removeToast', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    let id: string;
    act(() => { id = ctx!.addToast({ message: 'Remove me', variant: 'info', duration: 0 }); });
    expect(ctx!.toasts.length).toBe(1);

    act(() => { ctx!.removeToast(id!); });
    expect(ctx!.toasts.length).toBe(0);
  });

  it('success() returns a non-empty string id', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    let id: string;
    act(() => { id = ctx!.success('Test success'); });
    expect(typeof id!).toBe('string');
    expect(id!.length).toBeGreaterThan(0);
  });

  it('error() returns a non-empty string id', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    let id: string;
    act(() => { id = ctx!.error('Test error'); });
    expect(typeof id!).toBe('string');
    expect(id!.length).toBeGreaterThan(0);
  });

  it('info() toast has the correct variant in state', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    act(() => { ctx!.info('Info variant', 0); });
    expect(ctx!.toasts[0].variant).toBe('info');
  });

  it('warning() toast has the correct variant in state', () => {
    let ctx: ReturnType<typeof useToast>;
    render(
      <Wrapper>
        <ToastConsumer onMount={(c) => { ctx = c; }} />
      </Wrapper>,
    );

    act(() => { ctx!.warning('Warning variant', 0); });
    expect(ctx!.toasts[0].variant).toBe('warning');
  });
});
