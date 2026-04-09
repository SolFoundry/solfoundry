import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, animate, useMotionValue } from 'framer-motion';
import { useStats } from '../../hooks/useStats';
import { getGitHubAuthorizeUrl } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { buttonHover, fadeIn } from '../../lib/animations';
import { HeroCanvas } from './HeroCanvas';

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

function CountUp({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, target, {
      duration: 1.5,
      ease: 'easeOut',
    });
    const unsubscribe = motionValue.on('change', (v) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
      }
    });
    return () => { controls.stop(); unsubscribe(); };
  }, [inView, target, motionValue, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

export function HeroSection() {
  const { data: stats } = useStats();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [resultLinesVisible, setResultLinesVisible] = useState(false);

  useEffect(() => {
    // Typewriter takes ~3s (0.5s delay + 2.5s), then show result lines
    const t1 = setTimeout(() => setTypewriterDone(true), 3100);
    const t2 = setTimeout(() => setResultLinesVisible(true), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleSignIn = async () => {
    try {
      const url = await getGitHubAuthorizeUrl();
      window.location.href = url;
    } catch {
      window.location.href = '/api/auth/github/authorize';
    }
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      {/* Animated canvas background */}
      <HeroCanvas />

      {/* Terminal card */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="w-full max-w-xl rounded-xl border border-border bg-forge-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-forge-800 border-b border-border">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-status-error/80" />
            <span className="w-3 h-3 rounded-full bg-status-warning/80" />
            <span className="w-3 h-3 rounded-full bg-status-success/80" />
          </div>
          <span className="font-mono text-xs text-text-muted ml-2">solfoundry — terminal</span>
        </div>

        {/* Terminal body */}
        <div className="p-5 font-mono text-sm leading-relaxed">
          <div className="overflow-hidden">
            <span className="text-emerald">$ </span>
            <span className="text-text-secondary overflow-hidden whitespace-nowrap inline-block animate-typewriter">
              forge bounty --reward 100 --lang typescript --tier 2
            </span>
            {typewriterDone && (
              <span className="inline-block w-2 h-5 bg-emerald animate-blink ml-0.5 align-middle" />
            )}
          </div>

          {resultLinesVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-3 space-y-1.5"
            >
              {[
                { text: '✓ Bounty created: #142', delay: 0 },
                { text: '✓ Escrow funded: 100 USDC', delay: 0.3 },
                { text: '✓ 3 contributors notified', delay: 0.6 },
              ].map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: line.delay, duration: 0.3 }}
                  className="text-emerald"
                >
                  {line.text}
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-wider text-center mt-10"
      >
        THE AI-POWERED BOUNTY{' '}
        <span className="text-emerald">FORGE</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="font-sans text-lg text-text-secondary text-center mt-4 max-w-lg"
      >
        Fund bounties. Ship code. Earn rewards.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-4 mt-8"
      >
        <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
          <Link
            to="/bounties"
            className="px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 shadow-lg shadow-emerald/20 inline-block"
          >
            Browse Bounties
          </Link>
        </motion.div>

        <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
          <Link
            to="/bounties/create"
            className="px-6 py-3 rounded-lg border border-emerald text-emerald font-semibold text-sm hover:bg-emerald-bg transition-colors duration-200 inline-block"
          >
            Post a Bounty
          </Link>
        </motion.div>

        {!isAuthenticated && (
          <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
            <button
              onClick={handleSignIn}
              className="px-6 py-3 rounded-lg border border-border text-text-secondary font-medium text-sm hover:border-border-hover hover:text-text-primary transition-all duration-200 inline-flex items-center gap-2"
            >
              <GitHubIcon /> GitHub
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Live stats strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="flex items-center justify-center gap-6 mt-8 font-mono text-sm text-text-muted"
      >
        <span>
          <span className="text-text-primary font-semibold">
            <CountUp target={stats?.open_bounties ?? 142} />
          </span>
          {' '}open bounties
        </span>
        <span className="text-text-muted">·</span>
        <span>
          <span className="text-text-primary font-semibold">
            $<CountUp target={stats?.total_paid_usdc ?? 24500} />
          </span>
          {' '}paid
        </span>
        <span className="text-text-muted">·</span>
        <span>
          <span className="text-text-primary font-semibold">
            <CountUp target={stats?.total_contributors ?? 89} />
          </span>
          {' '}builders
        </span>
      </motion.div>
    </section>
  );
}
