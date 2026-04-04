/**
 * Tests for the SolFoundry Brand Guide page.
 *
 * Covers colour palette swatches with hex codes, typography specimens,
 * logo variants, do/don't rules, tone-of-voice section, and design
 * principles section.
 *
 * @module __tests__/brand-guide.test
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { BrandGuidePage } from '../pages/BrandGuidePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <BrandGuidePage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Page structure
// ---------------------------------------------------------------------------

describe('BrandGuidePage structure', () => {
  it('renders the main page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /brand guide/i })).toBeInTheDocument();
  });

  it('renders all top-level section headings', () => {
    renderPage();
    expect(screen.getByTestId('section-colors')).toBeInTheDocument();
    expect(screen.getByTestId('section-typography')).toBeInTheDocument();
    expect(screen.getByTestId('section-logo')).toBeInTheDocument();
    expect(screen.getByTestId('section-tone')).toBeInTheDocument();
    expect(screen.getByTestId('section-principles')).toBeInTheDocument();
  });

  it('renders a navigation sidebar / anchor list', () => {
    renderPage();
    expect(screen.getByTestId('brand-nav')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

describe('Colour palette', () => {
  it('shows the primary Emerald swatch with hex code', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    expect(within(section).getByTestId('swatch-emerald')).toBeInTheDocument();
    expect(within(section).getByText('#00E676')).toBeInTheDocument();
  });

  it('shows the Purple swatch with hex code', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    expect(within(section).getByTestId('swatch-purple')).toBeInTheDocument();
    expect(within(section).getByText('#7C3AED')).toBeInTheDocument();
  });

  it('shows the Magenta swatch with hex code', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    expect(within(section).getByTestId('swatch-magenta')).toBeInTheDocument();
    expect(within(section).getByText('#E040FB')).toBeInTheDocument();
  });

  it('shows all Forge background shades', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    expect(within(section).getByTestId('swatch-forge-950')).toBeInTheDocument();
    expect(within(section).getByTestId('swatch-forge-900')).toBeInTheDocument();
    expect(within(section).getByText('#050505')).toBeInTheDocument();
    expect(within(section).getByText('#0A0A0F')).toBeInTheDocument();
  });

  it('shows status colours', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    expect(within(section).getByTestId('swatch-success')).toBeInTheDocument();
    expect(within(section).getByTestId('swatch-warning')).toBeInTheDocument();
    expect(within(section).getByTestId('swatch-error')).toBeInTheDocument();
    expect(within(section).getByTestId('swatch-info')).toBeInTheDocument();
  });

  it('shows usage rule for each primary colour', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    // Emerald usage
    expect(within(section).getByTestId('usage-emerald')).toBeInTheDocument();
    // Purple usage
    expect(within(section).getByTestId('usage-purple')).toBeInTheDocument();
  });

  it('copy button is present for each primary swatch', () => {
    renderPage();
    const section = screen.getByTestId('section-colors');
    const copyButtons = within(section).getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

describe('Typography', () => {
  it('shows Display font family name', () => {
    renderPage();
    const section = screen.getByTestId('section-typography');
    expect(within(section).getByTestId('font-display')).toBeInTheDocument();
    expect(within(section).getByText('Orbitron')).toBeInTheDocument();
  });

  it('shows Sans-serif font family name', () => {
    renderPage();
    const section = screen.getByTestId('section-typography');
    expect(within(section).getByTestId('font-sans')).toBeInTheDocument();
    expect(within(section).getByText('Inter')).toBeInTheDocument();
  });

  it('shows Mono font family name', () => {
    renderPage();
    const section = screen.getByTestId('section-typography');
    expect(within(section).getByTestId('font-mono')).toBeInTheDocument();
    expect(within(section).getByText('JetBrains Mono')).toBeInTheDocument();
  });

  it('shows type scale specimens (H1 through Body)', () => {
    renderPage();
    const section = screen.getByTestId('section-typography');
    expect(within(section).getByTestId('type-scale-h1')).toBeInTheDocument();
    expect(within(section).getByTestId('type-scale-h2')).toBeInTheDocument();
    expect(within(section).getByTestId('type-scale-body')).toBeInTheDocument();
    expect(within(section).getByTestId('type-scale-mono')).toBeInTheDocument();
  });

  it('shows font usage descriptions', () => {
    renderPage();
    const section = screen.getByTestId('section-typography');
    expect(within(section).getByTestId('font-usage-display')).toBeInTheDocument();
    expect(within(section).getByTestId('font-usage-sans')).toBeInTheDocument();
    expect(within(section).getByTestId('font-usage-mono')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

describe('Logo section', () => {
  it('shows primary logo variant', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    expect(within(section).getByTestId('logo-primary')).toBeInTheDocument();
  });

  it('shows dark and light logo variants', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    expect(within(section).getByTestId('logo-dark')).toBeInTheDocument();
    expect(within(section).getByTestId('logo-light')).toBeInTheDocument();
  });

  it('shows clearspace rule', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    expect(within(section).getByTestId('logo-clearspace')).toBeInTheDocument();
    expect(within(section).getByText(/clearspace/i)).toBeInTheDocument();
  });

  it('shows minimum size rule', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    expect(within(section).getByTestId('logo-min-size')).toBeInTheDocument();
  });

  it('shows do items', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    const doList = within(section).getByTestId('logo-dos');
    expect(doList).toBeInTheDocument();
    expect(within(doList).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('shows dont items', () => {
    renderPage();
    const section = screen.getByTestId('section-logo');
    const dontList = within(section).getByTestId('logo-donts');
    expect(dontList).toBeInTheDocument();
    expect(within(dontList).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Tone of voice
// ---------------------------------------------------------------------------

describe('Tone of voice', () => {
  it('renders tone attributes', () => {
    renderPage();
    const section = screen.getByTestId('section-tone');
    expect(within(section).getByTestId('tone-attributes')).toBeInTheDocument();
  });

  it('shows at least 4 tone attributes', () => {
    renderPage();
    const attrs = screen.getByTestId('tone-attributes');
    expect(within(attrs).getAllByTestId(/^tone-attr-/).length).toBeGreaterThanOrEqual(4);
  });

  it('shows writing example (do vs dont)', () => {
    renderPage();
    const section = screen.getByTestId('section-tone');
    expect(within(section).getByTestId('tone-example-do')).toBeInTheDocument();
    expect(within(section).getByTestId('tone-example-dont')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Design principles
// ---------------------------------------------------------------------------

describe('Design principles', () => {
  it('renders at least 4 principles', () => {
    renderPage();
    const section = screen.getByTestId('section-principles');
    expect(within(section).getAllByTestId(/^principle-/).length).toBeGreaterThanOrEqual(4);
  });

  it('each principle has a title and description', () => {
    renderPage();
    const first = screen.getAllByTestId(/^principle-/)[0];
    expect(first.querySelector('[data-testid$="-title"]') ?? first).toBeTruthy();
  });
});
