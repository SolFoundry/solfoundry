import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HomePage } from '../../../pages/HomePage';

const mockContext = {
  fillRect: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0,
  beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
  fill: vi.fn(), stroke: vi.fn(), arc: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
  font: '', textAlign: '', textBaseline: '', fillText: vi.fn(), globalAlpha: 1,
  drawImage: vi.fn(), clearRect: vi.fn(), rect: vi.fn(), clip: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  getImageData: vi.fn(), putImageData: vi.fn(),
  canvas: { width: 800, height: 600 },
};
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);
vi.mock('../../../hooks/useStats', () => ({ useStats: () => ({ data: { open_bounties: 142, total_paid_usdc: 24500, total_contributors: 89 } }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../api/auth', () => ({ getGitHubAuthorizeUrl: vi.fn(() => Promise.resolve('https://github.com')) }));

describe('HomePage with ForgeVisualization', () => {
  it('renders forge visualization on homepage', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('has forge container with correct classes', () => {
    const { container } = render(<HomePage />);
    const forgeDiv = container.querySelector('[class*="overflow-hidden"]');
    expect(forgeDiv).toBeTruthy();
  });
});
