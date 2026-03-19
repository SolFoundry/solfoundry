import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="py-6 text-center text-sm text-gray-500 bg-gray-900 border-t border-gray-800">
      <p>&copy; {new Date().getFullYear()} SolFoundry. All rights reserved.</p>
    </footer>
  );
};
