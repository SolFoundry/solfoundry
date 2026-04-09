import React from 'react';
import { render } from '@testing-library/react';
  
test('should render Hello world', () => {
    const { getByText } = render(<div>Hello world</div>);
    expect(getByText(/Hello world/i)).toBeInTheDocument();
});