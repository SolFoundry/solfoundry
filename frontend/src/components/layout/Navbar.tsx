import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useStats } from '../../hooks/useStats';
import { getGitHubAuthorizeUrl } from '../../api/auth';

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const NAV_LINKS = [
  { label: 'Bounties', to: '/bounties' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'How It Works', to: '/how-it-works' },
];

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: stats } = useStats();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGitHubSignIn = async () => {
    try {
      const url = await getGitHubAuthorizeUrl();
      window.location.href = url;
    } catch {
      window.location.href = '/api/auth/github/authorize';
    }
  };

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-forge-950/90' : 'bg-forge-950/80'
      } backdrop-blur-xl border-b border-border`}
    >
      <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-navbar transition-opacity duration-200 ${scrolled ? 'opacity-70' : 'opacity-40'}`} />

      <div className="max-w-7xl mx-auto min-h-16 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 group min-w-0">
            <img src="/logo-icon.png" alt="SolFoundry" className="w-7 h-7 group-hover:drop-shadow-[0_0_8px_rgba(0,230,118,0.4)] transition-all duration-200 flex-shrink-0" />
            <span className="font-display text-base sm:text-lg font-semibold text-text-primary tracking-wide truncate">SolFoundry</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8 min-w-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative font-sans text-sm font-medium transition-colors duration-200 ${isActive(link.to) ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {link.label}
                {isActive(link.to) && <motion.div layoutId="nav-indicator" className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-emerald" />}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {stats && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-bg border border-emerald-border max-w-[120px] lg:max-w-none">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow flex-shrink-0" />
              <span className="font-mono text-xs text-emerald truncate">{stats.open_bounties} open</span>
            </div>
          )}

          {isAuthenticated && user ? (
            <div className="relative hidden sm:block">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-forge-800 transition-colors duration-200 max-w-[180px]">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-7 h-7 rounded-full border border-border flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-forge-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-text-muted" />
                  </div>
                )}
                <span className="text-sm font-medium text-text-primary truncate">{user.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-forge-900 shadow-2xl shadow-black/50 overflow-hidden">
                    <Link to="/profile" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-forge-850 transition-colors duration-150">
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <div className="border-t border-border/50" />
                    <button onClick={() => { logout(); setDropdownOpen(false); navigate('/'); }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-text-secondary hover:text-status-error hover:bg-forge-850 transition-colors duration-150">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={handleGitHubSignIn} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-text-primary text-sm font-medium transition-all duration-200 hover:bg-forge-700">
              <GitHubIcon />
              <span className="hidden lg:block">Sign in with GitHub</span>
              <span className="lg:hidden">Sign in</span>
            </button>
          )}

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg hover:bg-forge-800 transition-colors text-text-secondary">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="md:hidden overflow-hidden bg-forge-900 border-b border-border">
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-forge-850 transition-colors duration-150">
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <button onClick={handleGitHubSignIn} className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-forge-800 border border-border text-text-primary text-sm font-medium hover:border-border-hover hover:bg-forge-700 transition-all duration-200">
                  <GitHubIcon /> Sign in with GitHub
                </button>
              )}
              {isAuthenticated && user && (
                <>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="mt-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-forge-850 transition-colors duration-150">
                    Profile
                  </Link>
                  <button onClick={() => { logout(); setMenuOpen(false); navigate('/'); }} className="px-4 py-2.5 rounded-lg text-left text-sm font-medium text-text-secondary hover:text-status-error hover:bg-forge-850 transition-colors duration-150">
                    Sign out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
