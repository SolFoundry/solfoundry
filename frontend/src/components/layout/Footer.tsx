import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-500 p-4 text-center border-t border-gray-800 text-sm">
      <p>&copy; {new Date().getFullYear()} SolFoundry. All rights reserved.</p>
    </footer>
  );
};
