import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import NotFoundPage from '../NotFoundPage';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NotFoundPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 404 page with all required elements', () => {
    renderWithRouter(<NotFoundPage />);
    
    // Check for 404 heading
    expect(screen.getByText('404')).toBeInTheDocument();
    
    // Check for "Page not found" message
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    
    // Check for SolFoundry logo/brand
    expect(screen.getByText('SolFoundry')).toBeInTheDocument();
    
    // Check for back to home button
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
    
    // Check for browse bounties link
    expect(screen.getByText('Browse open bounties →')).toBeInTheDocument();
  });

  it('has correct navigation links', () => {
    renderWithRouter(<NotFoundPage />);
    
    // Check home link
    const homeLinks = screen.getAllByRole('link', { name: /home/i });
    expect(homeLinks.length).toBeGreaterThan(0);
    homeLinks.forEach(link => {
      expect(link).toHaveAttribute('href', '/');
    });
    
    // Check bounties link
    const bountiesLink = screen.getByRole('link', { name: /browse open bounties/i });
    expect(bountiesLink).toHaveAttribute('href', '/bounties');
    
    // Check logo link
    const logoLink = screen.getByText('SolFoundry').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('applies dark theme classes', () => {
    const { container } = renderWithRouter(<NotFoundPage />);
    
    // Check main container has dark background
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass('bg-slate-900');
    
    // Check text elements have appropriate slate colors
    expect(screen.getByText('404')).toHaveClass('text-slate-200');
    expect(screen.getByText('Page not found')).toHaveClass('text-slate-300');
  });

  it('has responsive design classes', () => {
    const { container } = renderWithRouter(<NotFoundPage />);
    
    // Check for responsive padding and layout
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass('px-4');
    
    // Check for max-width constraint
    const contentContainer = container.querySelector('.max-w-md');
    expect(contentContainer).toBeInTheDocument();
    expect(contentContainer).toHaveClass('mx-auto');
  });

  it('includes proper button styling and hover effects', () => {
    renderWithRouter(<NotFoundPage />);
    
    // Check Back to Home button styling
    const homeButton = screen.getByText('Back to Home');
    expect(homeButton).toHaveClass('bg-gradient-to-r', 'from-purple-600', 'to-blue-600');
    expect(homeButton).toHaveClass('hover:from-purple-500', 'hover:to-blue-500');
    
    // Check Browse Bounties button styling
    const bountiesButton = screen.getByText('Browse open bounties →');
    expect(bountiesButton).toHaveClass('border-slate-600', 'hover:border-slate-500');
  });

  it('includes SolFoundry logo with gradient styling', () => {
    renderWithRouter(<NotFoundPage />);
    
    // Check for logo container
    const logo = screen.getByText('SolFoundry');
    expect(logo).toHaveClass('bg-gradient-to-r', 'from-purple-400', 'to-blue-400', 'bg-clip-text', 'text-transparent');
    
    // Check for SVG icon presence
    const svgIcon = document.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveClass('w-10', 'h-10', 'text-white');
  });

  it('includes help links in footer', () => {
    renderWithRouter(<NotFoundPage />);
    
    // Check for documentation link
    const docsLink = screen.getByRole('link', { name: /documentation/i });
    expect(docsLink).toHaveAttribute('href', '/docs');
    
    // Check for contact support link
    const contactLink = screen.getByRole('link', { name: /contact support/i });
    expect(contactLink).toHaveAttribute('href', '/contact');
  });
});