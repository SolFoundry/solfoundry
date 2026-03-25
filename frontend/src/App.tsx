import React from 'react';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <h1 className="text-xl font-bold">Welcome to SolFoundry</h1>
      </div>
    </>
  );
};

export default App;