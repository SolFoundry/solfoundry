/**
 * Tests for escrow type constants and type shapes.
 * Validates that the initial transaction progress constant is correctly defined.
 *
 * @module types/__tests__/escrow.test
 */

import { describe, it, expect } from 'vitest';
import { INITIAL_TRANSACTION_PROGRESS } from '../escrow';

describe('INITIAL_TRANSACTION_PROGRESS', () => {
  it('has idle step', () => {
    expect(INITIAL_TRANSACTION_PROGRESS.step).toBe('idle');
  });

  it('has null signature', () => {
    expect(INITIAL_TRANSACTION_PROGRESS.signature).toBeNull();
  });

  it('has null error message', () => {
    expect(INITIAL_TRANSACTION_PROGRESS.errorMessage).toBeNull();
  });

  it('has null operation type', () => {
    expect(INITIAL_TRANSACTION_PROGRESS.operationType).toBeNull();
  });

  it('is a plain object with exactly 4 keys', () => {
    expect(Object.keys(INITIAL_TRANSACTION_PROGRESS)).toHaveLength(4);
  });
});
