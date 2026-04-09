import { render, screen } from '@testing-library/react';
import React from 'react';
import SkillCatalog from '../frontend/src/components/SkillCatalog';

test('renders skill catalog component', () => {
  console.log('Running skill catalog component test');
  render(<SkillCatalog />);
  const titleElement = screen.getByText(/Skill Catalog/i);
  expect(titleElement).toBeInTheDocument();
});
