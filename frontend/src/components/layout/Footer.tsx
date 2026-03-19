import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-500 py-4 px-6 text-center text-sm border-t border-gray-800">
      <p>&copy; {new Date().getFullYear()} SolFoundry. All rights reserved.</p>
    </footer>
  );
};
