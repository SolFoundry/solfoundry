import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BountyTags } from './BountyTags';

function RouterLoc() {
  const { pathname, search } = useLocation();
  return <span data-testid="router-loc">{`${pathname}${search}`}</span>;
}

describe('BountyTags', () => {
  it('renders tier, normalized category label, and skills (static)', () => {
    render(
      <BountyTags
        tier="T2"
        category="smart_contract"
        skills={['TypeScript', 'Rust']}
        interactive={false}
        showTier
      />,
    );
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('Smart Contract')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('truncates skills with overflow hint', () => {
    render(
      <BountyTags
        tier="T1"
        skills={['A', 'B', 'C', 'D']}
        interactive={false}
        showTier={false}
        maxSkills={2}
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('updates route search when interactive skill is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/bounties']}>
        <Routes>
          <Route
            path="/bounties"
            element={
              <>
                <BountyTags tier="T1" skills={['Python']} interactive showTier={false} />
                <RouterLoc />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Filter bounties by skill: Python/i }));
    expect(screen.getByTestId('router-loc')).toHaveTextContent(/skills=Python/);
  });

  it('toggles tier off when it matches the current URL filter', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/bounties?tier=T2']}>
        <Routes>
          <Route
            path="/bounties"
            element={
              <>
                <BountyTags tier="T2" skills={[]} interactive showTier />
                <RouterLoc />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Filter bounties by tier T2/i }));
    expect(screen.getByTestId('router-loc')).toHaveTextContent('/bounties');
  });
});
