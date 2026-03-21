import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollToTop } from './ScrollToTop';

describe('ScrollToTop', () => {
  const scrollToMock = vi.fn();

  beforeEach(() => {
    // Mock window.scrollTo
    Object.defineProperty(window, 'scrollTo', {
      value: scrollToMock,
      writable: true,
    });

    // Reset scroll position
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
    });

    scrollToMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the button', () => {
    render(<ScrollToTop />);
    expect(screen.getByRole('button', { name: /scroll to top/i })).toBeInTheDocument();
  });

  it('is hidden when scrollY is below threshold', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });
    expect(button).toHaveClass('opacity-0');
  });

  it('becomes visible when scrollY exceeds 300px', async () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });

    // Simulate scroll
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    expect(button).toHaveClass('opacity-100');
  });

  it('scrolls to top on click', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });

    // Make button visible
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    fireEvent.scroll(window);

    fireEvent.click(button);

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('scrolls to top on Enter key', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });

    fireEvent.keyDown(button, { key: 'Enter' });

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('scrolls to top on Space key', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });

    fireEvent.keyDown(button, { key: ' ' });

    expect(scrollToMock).toHaveBeenCalled();
  });

  it('has correct aria-label', () => {
    render(<ScrollToTop />);
    expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
  });

  it('is keyboard focusable', () => {
    render(<ScrollToTop />);
    const button = screen.getByRole('button', { name: /scroll to top/i });
    button.focus();
    expect(button).toHaveFocus();
  });
});