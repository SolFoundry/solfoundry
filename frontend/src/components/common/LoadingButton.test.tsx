/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  it('renders children text', () => {
    render(<LoadingButton>Claim</LoadingButton>);
    expect(screen.getByText('Claim')).toBeTruthy();
  });

  it('renders spinner when isLoading=true', () => {
    render(<LoadingButton isLoading>Submit</LoadingButton>);
    // Spinner uses animate-spin
    const btn = screen.getByRole('button');
    expect(btn.querySelector('svg')).toBeTruthy();
  });

  it('shows loadingText when isLoading=true', () => {
    render(<LoadingButton isLoading loadingText="Claiming...">Claim</LoadingButton>);
    expect(screen.getByText('Claiming...')).toBeTruthy();
  });

  it('falls back to children + ellipsis when no loadingText', () => {
    render(<LoadingButton isLoading>Submit</LoadingButton>);
    expect(screen.getByText('Submit…')).toBeTruthy();
  });

  it('is disabled when isLoading=true (prevents double submit)', () => {
    render(<LoadingButton isLoading>Submit</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is passed', () => {
    render(<LoadingButton disabled>Submit</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick when not loading', () => {
    const handler = vi.fn();
    render(<LoadingButton onClick={handler}>Click</LoadingButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when isLoading (pointer-events-none)', () => {
    // disabled + pointer-events-none prevents click events from reaching handler
    const handler = vi.fn();
    render(<LoadingButton isLoading onClick={handler}>Click</LoadingButton>);
    const btn = screen.getByRole('button');
    // The button is disabled so click should not propagate
    fireEvent.click(btn);
    expect(handler).not.toHaveBeenCalled();
  });

  it('sets aria-busy=true when loading', () => {
    render(<LoadingButton isLoading>Submit</LoadingButton>);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  });

  it('renders icon when not loading', () => {
    render(
      <LoadingButton icon={<span data-testid="icon">★</span>}>
        Star
      </LoadingButton>,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('hides icon when loading (shows spinner instead)', () => {
    render(
      <LoadingButton isLoading icon={<span data-testid="icon">★</span>}>
        Star
      </LoadingButton>,
    );
    expect(screen.queryByTestId('icon')).toBeNull();
    expect(screen.getByRole('button').querySelector('svg')).toBeTruthy();
  });

  it('applies variant classes', () => {
    render(<LoadingButton variant="danger">Delete</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
  });

  it('applies custom className', () => {
    render(<LoadingButton className="my-class">Go</LoadingButton>);
    expect(screen.getByRole('button').className).toContain('my-class');
  });
});
