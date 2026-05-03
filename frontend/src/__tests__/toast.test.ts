import { describe, expect, it } from 'vitest';
import { createToast } from '../components/ui/ToastProvider';

describe('createToast', () => {
  it('defaults to info variant and 5 second auto-dismiss', () => {
    expect(createToast({ title: 'Queued' }, 'toast-1')).toMatchObject({
      id: 'toast-1',
      title: 'Queued',
      variant: 'info',
      durationMs: 5_000,
    });
  });

  it('preserves explicit variants, descriptions, and duration', () => {
    expect(createToast({ title: 'Saved', description: 'Done', variant: 'success', durationMs: 1000 }, 'toast-2')).toMatchObject({
      id: 'toast-2',
      title: 'Saved',
      description: 'Done',
      variant: 'success',
      durationMs: 1000,
    });
  });
});
