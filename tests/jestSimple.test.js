import { render } from '@testing-library/react';
import React from 'react';

const SimpleComponent = () => <div>Hello, Jest!</div>;

test('it renders without crashing', () => {
  render(<SimpleComponent />);
});
