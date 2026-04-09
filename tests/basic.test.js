import { render, screen } from '@testing-library/react';
import React from 'react';

const BasicComponent = () => <div>Hello, world!</div>;

test('renders basic component', () => {
  console.log('Running basic component test');
  render(<BasicComponent />);
  expect(screen.getByText(/Hello, world!/i)).toBeInTheDocument();
});
