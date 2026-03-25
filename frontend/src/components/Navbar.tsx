import React, { useState } from 'react';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="bg-blue-500 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-white text-lg font-bold">SolFoundry</div>
        <button
          className="text-white md:hidden"
          onClick={toggleMenu}
        >
          ☰
        </button>
        <ul className={`md:flex md:items-center md:static ${isOpen ? 'block' : 'hidden'} absolute bg-blue-500 w-full left-0 top-full p-4 md:p-0`}>
          <li className="text-white py-2 px-4 hover:bg-blue-700">Home</li>
          <li className="text-white py-2 px-4 hover:bg-blue-700">About</li>
          <li className="text-white py-2 px-4 hover:bg-blue-700">Contact</li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;