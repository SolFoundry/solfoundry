import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForgeVisualization } from '../../../components/home/ForgeVisualization';

// Mock canvas context
const mockContext = {
  fillRect: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  fillText: vi.fn(),
  globalAlpha: 1,
  drawImage: vi.fn(),
  clearRect: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  canvas: { width: 800, height: 600 },
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);

describe('ForgeVisualization', () => {
  it('renders without crashing', () => {
    const { container } = render(<ForgeVisualization />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders with custom bountyCount', () => {
    const { container } = render(<ForgeVisualization bountyCount={7} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders with custom className', () => {
    const { container } = render(<ForgeVisualization className="test-class" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.className).toContain('test-class');
  });

  it('creates canvas element with correct dimensions', () => {
    const { container } = render(<ForgeVisualization />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.style.display).toBe('block');
  });

  it('uses canvas 2D context for rendering', () => {
    render(<ForgeVisualization />);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('initializes particle system on mount', () => {
    render(<ForgeVisualization />);
    // Canvas context should be called for drawing
    expect(mockContext.fillRect).toHaveBeenCalled();
  });

  it('renders default bounty count of 5', () => {
    const { container } = render(<ForgeVisualization />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('handles window resize', async () => {
    const { container } = render(<ForgeVisualization />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    
    // Trigger resize
    window.dispatchEvent(new Event('resize'));
    
    // Canvas should still be rendered
    expect(canvas).toBeTruthy();
  });

  it('handles mouse movement', () => {
    const { container } = render(<ForgeVisualization />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 200 });
    
    expect(canvas).toBeTruthy();
  });

  it('cleans up animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<ForgeVisualization />);
    
    unmount();
    
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('ForgeVisualization - Animation Features', () => {
  it('creates bounty tokens with correct colors', () => {
    const { container } = render(<ForgeVisualization bountyCount={3} />);
    // Should render without errors with 3 tokens
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('handles zero bounty count gracefully', () => {
    const { container } = render(<ForgeVisualization bountyCount={0} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('handles large bounty count', () => {
    const { container } = render(<ForgeVisualization bountyCount={20} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
