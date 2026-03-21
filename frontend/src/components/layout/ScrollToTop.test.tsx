/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScrollToTop } from './ScrollToTop';

describe('ScrollToTop', () => {
  beforeEach(() => {
    // Mock window.scrollTo
    window.scrollTo = jest.fn();
    // Reset scroll position
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when scroll position is below threshold', () => {
    window.scrollY = 100;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event
    fireEvent.scroll(window);
    
    // Button should not be visible
    expect(screen.queryByLabelText('Scroll to top')).not.toBeInTheDocument();
  });

  it('should render when scroll position exceeds threshold', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event
    fireEvent.scroll(window);
    
    // Button should be visible
    await waitFor(() => {
      expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
    });
  });

  it('should call window.scrollTo with smooth behavior when clicked', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      fireEvent.click(button);
    });
    
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('should respond to keyboard navigation', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      // Press Enter key
      fireEvent.keyDown(button, { key: 'Enter' });
    });
    
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('should respond to space key', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      // Press Space key
      fireEvent.keyDown(button, { key: ' ' });
    });
    
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('should use default threshold of 300px', async () => {
    window.scrollY = 350;
    render(<ScrollToTop />);
    
    // Trigger scroll event
    fireEvent.scroll(window);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
    });
  });

  it('should accept custom threshold', async () => {
    window.scrollY = 150;
    render(<ScrollToTop threshold={100} />);
    
    // Trigger scroll event
    fireEvent.scroll(window);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
    });
  });

  it('should apply custom className', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} className="custom-class" />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      expect(button).toHaveClass('custom-class');
    });
  });

  it('should be accessible with proper aria-label', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      expect(button).toHaveAttribute('aria-label', 'Scroll to top');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  it('should have correct styling classes', async () => {
    window.scrollY = 400;
    render(<ScrollToTop threshold={300} />);
    
    // Trigger scroll event to show button
    fireEvent.scroll(window);
    
    await waitFor(() => {
      const button = screen.getByLabelText('Scroll to top');
      // Check for key styling classes
      expect(button).toHaveClass('fixed');
      expect(button).toHaveClass('bottom-6');
      expect(button).toHaveClass('right-6');
      expect(button).toHaveClass('rounded-full');
      expect(button).toHaveClass('bg-gradient-to-br');
    });
  });
});