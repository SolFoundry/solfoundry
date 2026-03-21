import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import BountiesPage from './pages/BountiesPage';
import BountyDetailPage from './pages/BountyDetailPage';
import ProfilePage from './pages/ProfilePage';
import CreateBountyPage from './pages/CreateBountyPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <Router>
          <div className="min-h-screen bg-slate-900 text-white">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/bounties" element={<BountiesPage />} />
                <Route path="/bounty/:id" element={<BountyDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/create-bounty" element={<CreateBountyPage />} />
                {/* Catch-all route for 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </WalletProvider>
    </AuthProvider>
  );
}

export default App;