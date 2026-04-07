import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition } from '../lib/animations';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="text-center"
      >
        <p className="font-mono text-8xl font-bold text-forge-800 mb-4">404</p>
        <h1 className="font-display text-2xl font-bold text-text-primary mb-3">Page Not Found</h1>
        <p className="text-text-muted text-sm mb-8">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200"
        >
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
