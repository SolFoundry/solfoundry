import { describe, expect, it } from 'vitest';
import { getCountdownState } from '../components/bounty/CountdownTimer';

const now = new Date('2026-05-14T12:00:00Z').getTime();

describe('getCountdownState', () => {
  it('formats days, hours, and minutes remaining', () => {
    const state = getCountdownState('2026-05-16T14:30:00Z', now);

    expect(state.label).toBe('2d 2h 30m');
    expect(state.expired).toBe(false);
    expect(state.warning).toBe(false);
  });

  it('marks deadlines under 24 hours as warning', () => {
    const state = getCountdownState('2026-05-15T06:00:00Z', now);

    expect(state.label).toBe('18h 0m');
    expect(state.warning).toBe(true);
    expect(state.urgent).toBe(false);
  });

  it('marks deadlines under 1 hour as urgent', () => {
    const state = getCountdownState('2026-05-14T12:30:00Z', now);

    expect(state.label).toBe('30m');
    expect(state.warning).toBe(true);
    expect(state.urgent).toBe(true);
  });

  it('shows expired when the deadline has passed', () => {
    const state = getCountdownState('2026-05-14T11:59:00Z', now);

    expect(state.label).toBe('Expired');
    expect(state.expired).toBe(true);
  });
});
