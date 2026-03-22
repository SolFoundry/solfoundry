import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Test dialog">
        <p>Modal body</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>Secret</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Closable">
        <p>Content</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses full-viewport panel classes on narrow layouts (mobile-first full screen)', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Full">
        <p>X</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/h-full/);
    expect(dialog.className).toMatch(/max-w-none/);
    expect(dialog.className).toMatch(/rounded-none/);
    expect(dialog.className).toMatch(/sm:max-w-md/);
    expect(dialog.className).toMatch(/sm:rounded-2xl/);
  });
});
