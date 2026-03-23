/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import NotFoundPage from './NotFoundPage';

function renderWithRouter(ui: React.ReactElement, { route = '/not-found' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}

describe('NotFoundPage', () => {
  it('renders the 404 status code', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('renders the custom 404 heading with anvil branding', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: /bounty not found/i })).toBeTruthy();
  });

  it('renders the SolFoundry branding', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('SolFoundry')).toBeTruthy();
    const mark = screen.getByTestId('solfoundry-logo-mark');
    expect(mark).toHaveAttribute('src', '/logo-icon.svg');
  });

  it('renders a "Browse open bounties" primary link pointing to /bounties', () => {
    renderWithRouter(<NotFoundPage />);
    const bountiesLink = screen.getByRole('link', { name: /browse open bounties/i });
    expect(bountiesLink).toBeTruthy();
    expect(bountiesLink.getAttribute('href')).toBe('/bounties');
  });

  it('renders a "Back to Home" link pointing to /', () => {
    renderWithRouter(<NotFoundPage />);
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink).toBeTruthy();
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('renders a witty description message', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText(/fell off the anvil/i)).toBeTruthy();
  });

  it('renders the animated anvil illustration (aria-hidden)', () => {
    const { container } = renderWithRouter(<NotFoundPage />);
    // The animation container is aria-hidden (decorative)
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
  });
});
