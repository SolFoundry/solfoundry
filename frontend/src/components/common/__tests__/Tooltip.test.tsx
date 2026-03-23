/**
 * Tooltip component tests
 * @module components/common/__tests__/Tooltip.test
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on hover', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const trigger = screen.getByText('Hover me');
    fireEvent.mouseEnter(trigger);
    
    expect(screen.getByRole('tooltip')).toHaveTextContent('Test tooltip');
  });

  it('hides tooltip on mouse leave', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    );
    
    const trigger = screen.getByText('Hover me');
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
