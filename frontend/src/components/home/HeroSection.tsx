import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, animate, useMotionValue } from 'framer-motion';
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
          className="absolute pointer-events-none rounded-full animate-ember opacity-60"
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
      ease: [0.16, 1, 0.3, 1],
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
  const navigate = useNavigate();
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
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      <div className="absolute inset-0 bg-grid-forge bg-grid-forge pointer-events-none" style={{ backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <EmberParticles count={5} />

      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="w-full max-w-xl rounded-xl border border-border bg-forge-900/90 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2 px-4 py-2.5 bg-forge-800 border-b border-border">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-status-error/80" />
            <span className="w-3 h-3 rounded-full bg-status-warning/80" />
            <span className="w-3 h-3 rounded-full bg-status-success/80" />
          </div>
          <span className="font-mono text-xs text-text-muted ml-2">solfoundry — terminal</span>
        </div>

        <div className="p-5 font-mono text-sm leading-relaxed">
          <div className="overflow-hidden">
            <span className="text-emerald">$ </span>
            <span className="text-text-secondary overflow-hidden whitespace-nowrap inline-block animate-typewriter">
              forge bounty --reward 100 --lang typescript --tier 2
            </span>
            {typewriterDone && (
              <span className="text-emerald animate-blink">▋</span>
            )}
          </div>

          {resultLinesVisible && (
            <div className="mt-4 space-y-2 text-text-secondary animate-fade-in-fast">
              <div>
                <span className="text-magenta">›</span> Found <span className="text-text-primary">12</span> matching bounties
              </div>
              <div>
                <span className="text-magenta">›</span> Avg reward <span className="text-emerald">$420 USDC</span>
              </div>
              <div>
                <span className="text-magenta">›</span> AI review enabled <span className="text-emerald">✓</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeIn} initial="initial" animate="animate" className="mt-10 text-center max-w-4xl">
        <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wide text-text-primary leading-tight">
          Ship Code. <span className="text-emerald">Earn USDC.</span>
          <br />
          Build on <span className="text-magenta">Solana.</span>
        </h1>
        <p className="mt-5 text-text-secondary text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          The AI-powered bounty forge for builders. Find funded issues, submit PRs, and get reviewed by multiple LLMs before payout.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuthenticated ? (
            <motion.button
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              onClick={() => navigate('/bounties')}
              className="px-6 py-3 rounded-xl bg-emerald text-text-inverse font-semibold shadow-lg shadow-emerald/20"
            >
              Browse Bounties
            </motion.button>
          ) : (
            <motion.button
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              onClick={handleSignIn}
              className="px-6 py-3 rounded-xl bg-emerald text-text-inverse font-semibold shadow-lg shadow-emerald/20 inline-flex items-center gap-2"
            >
              <GitHubIcon />
              Sign in with GitHub
            </motion.button>
          )}

          <motion.div variants={buttonHover} initial="rest" whileHover="hover" whileTap="tap">
            <Link
              to="/how-it-works"
              className="px-6 py-3 rounded-xl border border-border bg-forge-850 text-text-primary font-semibold inline-flex items-center gap-2"
            >
              See How It Works
            </Link>
          </motion.div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm text-text-muted">
          <div>
            <span className="text-text-primary font-semibold">
              <CountUp target={stats?.open_bounties ?? 24} />
            </span>{' '}
            open bounties
          </div>
          <div>
            <span className="text-text-primary font-semibold">
              <CountUp target={stats?.total_paid_usdc ?? 128000} prefix="$" />
            </span>{' '}
            paid out
          </div>
          <div>
            <span className="text-text-primary font-semibold">
              <CountUp target={stats?.total_contributors ?? 340} />
            </span>{' '}
            builders
          </div>
        </div>
      </motion.div>
    </section>
  );
}
