import { render, screen } from '@testing-library/react';
import Navbar from '../src/components/Navbar';
import Footer from '../src/components/Footer';

describe('Layout Components', () => {
  it('renders Navbar correctly', () => {
    render(<Navbar />);
    expect(screen.getByText('SolFoundry')).toBeInTheDocument();
    expect(screen.getByText('Bounties')).toBeInTheDocument();
  });

  it('renders Footer correctly', () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });
});