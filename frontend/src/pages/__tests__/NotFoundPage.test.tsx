import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from '@jest/globals';
import NotFoundPage from '../NotFoundPage';

// Mock Layout component
jest.mock('../../components/Layout', () => {
  return function Layout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>;
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NotFoundPage', () => {
  it('renders the SolFoundry logo with gradient styling', () => {
    renderWithRouter(<NotFoundPage />);
    
    const logo = screen.getByText('SolFoundry');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveClass('bg-gradient-to-r', 'from-purple-400', 'via-pink-400', 'to-blue-400', 'bg-clip-text', 'text-transparent');
  });

  it('displays 404 error message and description', () => {
    renderWithRouter(<NotFoundPage />);
    
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.getByText("The page you're looking for doesn't exist or has been moved.")).toBeInTheDocument();
  });

  it('renders Back to Home button with correct styling and link', () => {
    renderWithRouter(<NotFoundPage />);
    
    const homeButton = screen.getByRole('link', { name: /go back to home page/i });
    expect(homeButton).toBeInTheDocument();
    expect(homeButton).toHaveAttribute('href', '/');
    expect(homeButton).toHaveClass('bg-purple-600', 'hover:bg-purple-700', 'text-white');
    expect(homeButton).toHaveTextContent('Back to Home');
  });

  it('renders Browse Bounties button with correct styling and link', () => {
    renderWithRouter(<NotFoundPage />);
    
    const bountiesButton = screen.getByRole('link', { name: /browse available bounties/i });
    expect(bountiesButton).toBeInTheDocument();
    expect(bountiesButton).toHaveAttribute('href', '/bounties');
    expect(bountiesButton).toHaveClass('border', 'border-gray-600', 'text-gray-300');
    expect(bountiesButton).toHaveTextContent('Browse Bounties');
  });

  it('uses Layout component for consistent page structure', () => {
    renderWithRouter(<NotFoundPage />);
    
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('has proper responsive design classes', () => {
    renderWithRouter(<NotFoundPage />);
    
    const container = screen.getByText('404').closest('div');
    expect(container?.parentElement?.parentElement).toHaveClass('min-h-[calc(100vh-200px)]', 'flex', 'flex-col', 'items-center', 'justify-center');
    
    const logo = screen.getByText('SolFoundry');
    expect(logo).toHaveClass('text-4xl', 'md:text-6xl');
    
    const errorNumber = screen.getByText('404');
    expect(errorNumber).toHaveClass('text-6xl', 'md:text-8xl');
    
    const errorTitle = screen.getByText('Page Not Found');
    expect(errorTitle).toHaveClass('text-2xl', 'md:text-3xl');
  });

  it('has dark theme styling throughout', () => {
    renderWithRouter(<NotFoundPage />);
    
    expect(screen.getByText('404')).toHaveClass('text-gray-200');
    expect(screen.getByText('Page Not Found')).toHaveClass('text-white');
    expect(screen.getByText("The page you're looking for doesn't exist or has been moved.")).toHaveClass('text-gray-400');
  });

  it('has proper accessibility attributes', () => {
    renderWithRouter(<NotFoundPage />);
    
    const homeButton = screen.getByRole('link', { name: /go back to home page/i });
    expect(homeButton).toHaveAttribute('aria-label', 'Go back to home page');
    
    const bountiesButton = screen.getByRole('link', { name: /browse available bounties/i });
    expect(bountiesButton).toHaveAttribute('aria-label', 'Browse available bounties');
  });

  it('renders button container with responsive flex layout', () => {
    renderWithRouter(<NotFoundPage />);
    
    const homeButton = screen.getByRole('link', { name: /go back to home page/i });
    const buttonContainer = homeButton.parentElement;
    
    expect(buttonContainer).toHaveClass('flex', 'flex-col', 'sm:flex-row', 'gap-4', 'w-full', 'max-w-sm');
  });

  it('has proper transition effects on buttons', () => {
    renderWithRouter(<NotFoundPage />);
    
    const homeButton = screen.getByRole('link', { name: /go back to home page/i });
    expect(homeButton).toHaveClass('transition-colors', 'duration-200');
    
    const bountiesButton = screen.getByRole('link', { name: /browse available bounties/i });
    expect(bountiesButton).toHaveClass('transition-colors', 'duration-200');
  });
});