import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Ensure this import exists
import Sidebar from '../sidebar';
import BountiesList from '../components/BountiesList';
import BountyClaimButton from '../components/BountyClaimButton';

// Test for CA-01: Browse and search bounties in sidebar
describe('Sidebar Component', () => {
    test('renders search input', () => {
        render(<Sidebar />);
        const searchInput = screen.getByPlaceholderText(/search/i);
        expect(searchInput).toBeInTheDocument();
    });

    test('searches bounties', () => {
        render(<Sidebar />);
        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'test bounty' } });
        expect(searchInput.value).toBe('test bounty');
    });
});

// Test for CA-02: Filter by programming language
// This test assumes that a filter dropdown exists in BountiesList

describe('BountiesList Component', () => {
    test('filters bounties by language', () => {
        render(<BountiesList />);
        const filterDropdown = screen.getByLabelText(/filter by language/i);
        fireEvent.change(filterDropdown, { target: { value: 'JavaScript' } });
        expect(filterDropdown.value).toBe('JavaScript');
    });
});

// Test for CA-03: One-click bounty claim functionality

describe('Bounty Claim Functionality', () => {
    test('claims a bounty on click', () => {
        render(<BountyClaimButton bountyId={1} />);
        const claimButton = screen.getByRole('button', { name: /claim/i });
        fireEvent.click(claimButton);
        expect(screen.getByText(/Bounty 1 claimed!/i)).toBeInTheDocument();
    });
});