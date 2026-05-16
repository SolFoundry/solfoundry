import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useInView, useMotionValue } from 'framer-motion';
import { useStats } from '../../hooks/useStats';
import { getGitHubAuthorizeUrl } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { buttonHover, fadeIn } from '../../lib/animations';

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

function EmberParticles({ count = 5 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${15 + i * 15}%`,
    delay: `${i * 0.8}s`,
    color: i % 2 === 0 ? '#00E676' : '#E040FB',
    size: 2 + (i % 3),
  }));

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none rounded-full opacity-60 animate-ember"
          style={{
            left: p.left,
            bottom: '30%',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
          }}
        />
      ))}
    </>
  );
}

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
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [inView, target, motionValue, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

export function HeroSection() {
  const { data: stats } = useStats();
  const { isAuthenticated } = useAuth();
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [resultLinesVisible, setResultLinesVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTypewriterDone(true), 3100);
    const t2 = setTimeout(() => setResultLinesVisible(true), 3400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
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
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-16">
      <div className="absolute inset-0 bg-grid-forge bg-grid-forge pointer-events-none" style={{ backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <EmberParticles count={5} />

      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-forge-900/90 shadow-2xl shadow-black/50 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 border-b border-border bg-forge-800 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-status-error/80" />
            <span className="w-3 h-3 rounded-full bg-status-warning/80" />
            <span className="w-3 h-3 rounded-full bg-status-success/80" />
          </div>
          <span className="ml-2 font-mono text-xs text-text-muted">solfoundry terminal</span>
        </div>

        <div className="p-4 font-mono text-xs leading-relaxed sm:p-5 sm:text-sm">
          <div className="overflow-hidden">
            <span className="text-emerald">$ </span>
            <span className="text-text-secondary inline-block max-w-[calc(100%-1.25rem)] overflow-hidden break-all whitespace-normal align-top sm:break-normal sm:whitespace-nowrap sm:animate-typewriter">
              forge bounty --reward 100 --lang typescript --tier 2
            </span>
            {typewriterDone && (
              <span className="ml-0.5 inline-block h-5 w-2 animate-blink bg-emerald align-middle" />
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
                { text: 'Bounty created: #142', delay: 0 },
                { text: 'Escrow funded: 100 USDC', delay: 0.3 },
                { text: '3 contributors notified', delay: 0.6 },
              ].map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: line.delay, duration: 0.3 }}
                  className="text-emerald"
                >
                  <span className="mr-2">+</span>
                  {line.text}
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-10 text-center font-display text-3xl font-bold tracking-wider text-text-primary sm:text-4xl md:text-5xl"
      >
        THE AI-POWERED BOUNTY <span className="text-emerald">FORGE</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="mt-4 max-w-lg text-center font-sans text-base text-text-secondary sm:text-lg"
      >
        Fund bounties. Ship code. Earn rewards.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-4"
      >
        <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
          <Link
            to="/bounties"
            className="inline-block rounded-lg bg-emerald px-6 py-3 text-sm font-semibold text-text-inverse shadow-lg shadow-emerald/20 transition-colors duration-200 hover:bg-emerald-light"
          >
            Browse Bounties
          </Link>
        </motion.div>

        <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
          <Link
            to="/bounties/create"
            className="inline-block rounded-lg border border-emerald px-6 py-3 text-sm font-semibold text-emerald transition-colors duration-200 hover:bg-emerald-bg"
          >
            Post a Bounty
          </Link>
        </motion.div>

        {!isAuthenticated && (
          <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
            <button
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-border-hover hover:text-text-primary"
            >
              <GitHubIcon /> GitHub
            </button>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-text-muted sm:text-sm"
      >
        <span>
          <span className="font-semibold text-text-primary">
            <CountUp target={stats?.open_bounties ?? 142} />
          </span>{' '}
          open bounties
        </span>
        <span className="hidden text-text-muted sm:inline">·</span>
        <span>
          <span className="font-semibold text-text-primary">
            $<CountUp target={stats?.total_paid_usdc ?? 24500} />
          </span>{' '}
          paid
        </span>
        <span className="hidden text-text-muted sm:inline">·</span>
        <span>
          <span className="font-semibold text-text-primary">
            <CountUp target={stats?.total_contributors ?? 89} />
          </span>{' '}
          builders
        </span>
      </motion.div>
    </section>
  );
}
