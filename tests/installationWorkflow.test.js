import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import InstallationWorkflow from '../frontend/src/components/InstallationWorkflow';


test('executes installation workflow', () => {
  console.log('Running installation workflow test');
  render(<InstallationWorkflow />);
  const buttonElement = screen.getByRole('button', { name: /Install/i });
  fireEvent.click(buttonElement);
  // Add more assertions as needed
});