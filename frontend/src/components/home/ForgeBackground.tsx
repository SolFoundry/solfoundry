import React, { useMemo } from 'react';

/* ───────────────────────────────────────────────────────────────
 * ForgeBackground — Animated forge/factory hero background
 *
 * Pure CSS animations for 60fps performance.
 * Layers: spark shower → ember drift → molten glow → smoke wisps
 * ─────────────────────────────────────────────────────────────── */

/* ─── Spark particles (fast, small, upward) ─── */
function SparkShower({ count = 40 }: { count?: number }) {
  const sparks = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${5 + Math.random() * 90}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${1.5 + Math.random() * 2.5}s`,
      size: 1 + Math.random() * 2,
      drift: (Math.random() - 0.5) * 60,
    })), [count]);

  return (
    <>
      {sparks.map((s) => (
        <div
          key={s.id}
          className="absolute pointer-events-none rounded-full animate-spark"
          style={{
            left: s.x,
            bottom: '0%',
            width: s.size,
            height: s.size,
            backgroundColor: s.size > 2 ? '#FFB300' : '#FF6D00',
            boxShadow: s.size > 2
              ? '0 0 4px rgba(255,179,0,0.6), 0 0 8px rgba(255,179,0,0.3)'
              : '0 0 2px rgba(255,109,0,0.4)',
            animationDelay: s.delay,
            animationDuration: s.duration,
            ['--spark-drift' as string]: `${s.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/* ─── Ember particles (slow, large, drifting) ─── */
function EmberDrift({ count = 15 }: { count?: number }) {
  const embers = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${10 + Math.random() * 80}%`,
      delay: `${Math.random() * 6}s`,
      duration: `${6 + Math.random() * 8}s`,
      size: 3 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.4,
      hue: Math.random() > 0.5 ? 0 : 40, // red or orange
    })), [count]);

  return (
    <>
      {embers.map((e) => (
        <div
          key={e.id}
          className="absolute pointer-events-none rounded-full animate-ember-drift"
          style={{
            left: e.x,
            bottom: '-5%',
            width: e.size,
            height: e.size,
            backgroundColor: e.hue === 0 ? '#FF5252' : '#FF6D00',
            opacity: e.opacity,
            boxShadow: `0 0 ${e.size * 2}px rgba(255,${e.hue === 0 ? '82,82' : '109,0'},0.3)`,
            animationDelay: e.delay,
            animationDuration: e.duration,
          }}
        />
      ))}
    </>
  );
}

/* ─── Molten glow at the bottom ─── */
function MoltenGlow() {
  return (
    <>
      {/* Main glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
        style={{
          background: [
            'linear-gradient(0deg,',
            '  rgba(255,109,0,0.15) 0%,',
            '  rgba(255,61,0,0.08) 30%,',
            '  rgba(124,58,237,0.05) 60%,',
            '  transparent 100%)',
          ].join('\n'),
        }}
      />
      {/* Hot core */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1/4 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 50% 100%,',
            '  rgba(255,109,0,0.2) 0%,',
            '  rgba(255,61,0,0.1) 30%,',
            '  rgba(124,58,237,0.05) 60%,',
            '  transparent 80%)',
          ].join('\n'),
        }}
      />
      {/* Animated molten ripple */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none animate-molten-ripple"
        style={{
          background: [
            'repeating-linear-gradient(90deg,',
            '  transparent 0px,',
            '  rgba(255,109,0,0.06) 50px,',
            '  rgba(255,179,0,0.04) 100px,',
            '  transparent 150px)',
          ].join('\n'),
          backgroundSize: '150px 100%',
        }}
      />
    </>
  );
}

/* ─── Smoke wisps ─── */
function SmokeWisps({ count = 6 }: { count?: number }) {
  const wisps = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${15 + i * 14}%`,
      delay: `${i * 1.5}s`,
      duration: `${10 + Math.random() * 8}s`,
      size: 80 + Math.random() * 120,
      opacity: 0.02 + Math.random() * 0.03,
    })), [count]);

  return (
    <>
      {wisps.map((w) => (
        <div
          key={w.id}
          className="absolute pointer-events-none rounded-full animate-smoke"
          style={{
            left: w.x,
            bottom: '10%',
            width: w.size,
            height: w.size * 1.5,
            background: `radial-gradient(ellipse, rgba(255,255,255,${w.opacity}) 0%, transparent 70%)`,
            animationDelay: w.delay,
            animationDuration: w.duration,
          }}
        />
      ))}
    </>
  );
}

/* ─── Forge silhouette (decorative SVG shape at bottom) ─── */
function ForgeSilhouette() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden opacity-20">
      <svg
        viewBox="0 0 1200 128"
        fill="none"
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Anvil shape */}
        <path
          d="M0 128 L0 96 L200 96 L250 80 L300 96 L500 96 L550 72 L600 64 L650 72 L700 96 L900 96 L950 80 L1000 96 L1200 96 L1200 128 Z"
          fill="url(#forge-grad)"
          opacity="0.6"
        >
          <animate
            attributeName="opacity"
            values="0.6;0.7;0.6"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
        {/* Gear hint */}
        <circle cx="600" cy="88" r="12" fill="url(#forge-grad)" opacity="0.4">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 600 88;360 600 88"
            dur="20s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="300" cy="92" r="8" fill="url(#forge-grad)" opacity="0.3">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="360 300 92;0 300 92"
            dur="15s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="900" cy="92" r="8" fill="url(#forge-grad)" opacity="0.3">
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 900 92;360 900 92"
            dur="18s"
            repeatCount="indefinite"
          />
        </circle>
        <defs>
          <linearGradient id="forge-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6D00" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ─── Main export ─── */
export function ForgeBackground() {
  return (
    <>
      {/* Grid overlay (reuse existing) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '40px 40px',
        }}
      />

      {/* Particles */}
      <SparkShower count={40} />
      <EmberDrift count={15} />

      {/* Molten glow */}
      <MoltenGlow />

      {/* Smoke */}
      <SmokeWisps count={6} />

      {/* Forge silhouette */}
      <ForgeSilhouette />

      {/* Gradient overlay (top, for depth) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 50% 0%,',
            '  rgba(124,58,237,0.12) 0%,',
            '  rgba(224,64,251,0.06) 40%,',
            '  transparent 70%)',
          ].join('\n'),
        }}
      />
    </>
  );
}