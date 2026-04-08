import React from 'react';
import { motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { pageTransition } from '../../lib/animations';

interface PageLayoutProps {
  children: React.ReactNode;
  noFooter?: boolean;
  className?: string;
}

export function PageLayout({ children, noFooter = false, className = '' }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-forge-950 text-text-primary">
      <Navbar />
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`pt-16 ${className}`}
      >
        {children}
      </motion.main>
      {!noFooter && <Footer />}
    </div>
  );
}
