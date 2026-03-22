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

  it('renders the "Page not found" heading', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy();
  });

  it('renders the SolFoundry branding', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('SolFoundry')).toBeTruthy();
    const mark = screen.getByTestId('solfoundry-logo-mark');
    expect(mark).toHaveAttribute('src', '/logo-icon.svg');
  });

  it('renders a "Back to Home" link pointing to /', () => {
    renderWithRouter(<NotFoundPage />);
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink).toBeTruthy();
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('renders a "Browse open bounties" link pointing to /bounties', () => {
    renderWithRouter(<NotFoundPage />);
    const bountiesLink = screen.getByRole('link', { name: /browse open bounties/i });
    expect(bountiesLink).toBeTruthy();
    expect(bountiesLink.getAttribute('href')).toBe('/bounties');
  });

  it('renders a description message', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText(/doesn.*t exist or has been moved/i)).toBeTruthy();
  });
});
