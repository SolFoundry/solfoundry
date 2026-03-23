import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from './Tooltip';

// Mock requestAnimationFrame
beforeAll(() => {
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Hover me</span>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('is hidden by default (aria-hidden)', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes visible on mouse enter', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('Trigger').closest('div')!;
    act(() => {
      fireEvent.mouseEnter(wrapper);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveAttribute('aria-hidden', 'false');
    expect(tooltip).toHaveTextContent('Helpful text');
  });

  it('hides on mouse leave', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('Trigger').closest('div')!;
    act(() => {
      fireEvent.mouseEnter(wrapper);
    });
    act(() => {
      fireEvent.mouseLeave(wrapper);
    });
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
  });

  it('toggles on touch start', () => {
    render(
      <Tooltip content="Mobile tooltip">
        <span>Touch me</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('Touch me').closest('div')!;
    act(() => {
      fireEvent.touchStart(wrapper, { preventDefault: () => {} });
    });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveAttribute('aria-hidden', 'false');
  });

  it('renders with bottom position', () => {
    render(
      <Tooltip content="Bottom tooltip" position="bottom">
        <span>Trigger</span>
      </Tooltip>
    );
    const wrapper = screen.getByText('Trigger').closest('div')!;
    act(() => { fireEvent.mouseEnter(wrapper); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Bottom tooltip');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <Tooltip content="Text" className="test-class">
        <span>X</span>
      </Tooltip>
    );
    expect(container.firstChild).toHaveClass('test-class');
  });
});
