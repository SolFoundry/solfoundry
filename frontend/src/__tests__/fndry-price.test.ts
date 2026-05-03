import { describe, expect, it } from 'vitest';
import { buildSparkline } from '../api/fndryPrice';

describe('buildSparkline', () => {
  it('creates finite checkpoint values from DexScreener change windows', () => {
    const points = buildSparkline(0.01, 2, 5, 10);
    expect(points).toHaveLength(4);
    expect(points.every(Number.isFinite)).toBe(true);
    expect(points.at(-1)).toBe(0.01);
  });

  it('handles zero change without division errors', () => {
    expect(buildSparkline(0.5, 0, 0, 0)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});
