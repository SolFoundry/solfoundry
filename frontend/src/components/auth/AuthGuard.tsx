import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const timer = setTimeout(() => setRedirecting(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (redirecting) {
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-primary font-medium mb-2">Sign in with GitHub to post a bounty</p>
          <p className="text-text-muted text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
