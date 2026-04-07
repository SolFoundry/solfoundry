import React, { useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'framer-motion';

/**
 * ForgeHeroBackground — Animated forge/factory hero background
 *
 * Features:
 * - Molten metal radial glow at bottom-center
 * - Floating spark particle system (60fps via CSS + JS positioning)
 * - Industrial gear silhouettes rotating slowly
 * - Heat shimmer distortion overlay
 * - Animated gradient wave at bottom edge
 * - Responsive: scales gracefully on mobile
 *
 * Performance: uses CSS transforms only (GPU-accelerated), no canvas,
 * bundle-size efficient, respects prefers-reduced-motion.
 */

interface Spark {
  id: number;
  x: number;        // percentage 0-100
  startY: number;    // percentage
  endY: number;      // percentage
  size: number;      // px
  duration: number;  // seconds
  delay: number;     // seconds
  color: string;
}

interface Gear {
  id: number;
  x: string;
  y: string;
  size: number;
  speed: number;     // seconds per rotation
  teeth: number;
  color: string;
  opacity: number;
  rotate: number;    // initial rotation deg
}

const SPARK_COLORS = [
  '#00E676', // emerald
  '#FF6B35', // molten orange
  '#FFB300', // amber spark
  '#FF5252', // red hot
  '#69F0AE', // bright emerald
  '#FFD740', // gold
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Spark Particle ─────────────────────────────────────────────────────────

function SparkParticle({ spark }: { spark: Spark }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${spark.x}%`,
        bottom: `${spark.startY}%`,
        width: spark.size,
        height: spark.size,
        backgroundColor: spark.color,
        boxShadow: `0 0 ${spark.size * 2}px ${spark.color}, 0 0 ${spark.size * 4}px ${spark.color}40`,
      }}
      animate={
        prefersReduced
          ? {}
          : {
              y: [0, -(spark.endY - spark.startY) * 10],
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1, 0.8, 0],
            }
      }
      transition={{
        duration: spark.duration,
        delay: spark.delay,
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: randomBetween(0.5, 2.5),
      }}
    />
  );
}

// ─── Industrial Gear ────────────────────────────────────────────────────────

function GearSVG({ size, teeth, color }: { size: number; teeth: number; color: string }) {
  const cx = size / 2;
  const outerR = size / 2 - 1;
  const innerR = size / 2 - 5;
  const toothDepth = 4;
  const anglePerTooth = (Math.PI * 2) / teeth;
  const halfTooth = anglePerTooth * 0.35;

  let pathD = '';
  for (let i = 0; i < teeth; i++) {
    const baseAngle = (i * Math.PI * 2) / teeth;
    const a1 = baseAngle - halfTooth;
    const a2 = baseAngle + halfTooth;
    const a3 = baseAngle + anglePerTooth - halfTooth;
    const a4 = baseAngle + anglePerTooth + halfTooth;

    const inner1X = cx + innerR * Math.cos(a1);
    const inner1Y = cx + innerR * Math.sin(a1);
    const outer1X = cx + outerR * Math.cos(a1);
    const outer1Y = cx + outerR * Math.sin(a1);
    const outer2X = cx + outerR * Math.cos(a2);
    const outer2Y = cx + outerR * Math.sin(a2);
    const inner2X = cx + innerR * Math.cos(a2);
    const inner2Y = cx + innerR * Math.sin(a2);
    const inner3X = cx + innerR * Math.cos(a3);
    const inner3Y = cx + innerR * Math.sin(a3);
    const outer3X = cx + outerR * Math.cos(a3);
    const outer3Y = cx + outerR * Math.sin(a3);
    const outer4X = cx + outerR * Math.cos(a4);
    const outer4Y = cx + outerR * Math.sin(a4);
    const inner4X = cx + innerR * Math.cos(a4);
    const inner4Y = cx + innerR * Math.sin(a4);

    if (i === 0) {
      pathD += `M ${inner1X} ${inner1Y} `;
    }
    pathD += `L ${outer1X} ${outer1Y} L ${outer2X} ${outer2Y} L ${inner2X} ${inner2Y} `;
    pathD += `L ${inner3X} ${inner3Y} L ${outer3X} ${outer3Y} L ${outer4X} ${outer4Y} L ${inner4X} ${inner4Y} `;
  }
  pathD += 'Z';

  // Center hole
  const holeR = size * 0.15;

  return (
    <>
      <path
        d={pathD}
        fill={color}
      />
      <circle cx={cx} cy={cx} r={holeR} fill="#050505" />
    </>
  );
}

function GearSilhouette({ gear }: { gear: Gear }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: gear.x,
        top: gear.y,
        width: gear.size,
        height: gear.size,
        opacity: gear.opacity,
      }}
      animate={prefersReduced ? {} : { rotate: [gear.rotate, gear.rotate + 360] }}
      transition={{
        duration: gear.speed,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <GearSVG size={gear.size} teeth={gear.teeth} color={gear.color} />
    </motion.div>
  );
}

// ─── Molten Glow ────────────────────────────────────────────────────────────

function MoltenGlow() {
  const prefersReduced = useReducedMotion();

  return (
    <>
      {/* Wide ambient glow */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          bottom: '-10%',
          transform: 'translateX(-50%)',
          width: '120vw',
          height: '60vh',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,107,53,0.18) 0%, rgba(255,80,0,0.08) 30%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={
          prefersReduced
            ? {}
            : {
                opacity: [0.7, 1, 0.8, 1, 0.7],
                scale: [1, 1.05, 1.02, 1.04, 1],
              }
        }
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Secondary purple glow for depth */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: '30%',
          bottom: '-5%',
          transform: 'translateX(-50%)',
          width: '60vw',
          height: '40vh',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
        animate={
          prefersReduced
            ? {}
            : {
                opacity: [0.5, 0.8, 0.6, 0.9, 0.5],
              }
        }
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* Bottom gradient wave */}
      <motion.div
        className="absolute pointer-events-none bottom-0 left-0 right-0"
        style={{
          height: '200px',
          background: 'linear-gradient(to top, rgba(255,107,53,0.08) 0%, rgba(124,58,237,0.04) 40%, transparent 100%)',
        }}
        animate={prefersReduced ? {} : { opacity: [0.6, 1, 0.7, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

// ─── Heat Shimmer ───────────────────────────────────────────────────────────

function HeatShimmer() {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ maskImage: 'linear-gradient(to bottom, transparent 60%, black 90%)' }}
    >
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-8"
          style={{
            bottom: `${20 + i * 15}%`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,150,50,0.03) 50%, transparent 100%)',
          }}
          animate={{
            x: ['-30%', '130%'],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 4 + i * 1.2,
            repeat: Infinity,
            delay: i * 0.8,
            ease: 'easeInOut',
          }}
        />
      ))}
    </motion.div>
  );
}

// ─── Anvil / Forge Silhouette ─────────────────────────────────────────────

function ForgeSilhouette() {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: '50%',
        bottom: '0%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
      }}
      initial={{ opacity: 0 }}
      animate={prefersReduced ? {} : { opacity: [0.04, 0.08, 0.05, 0.07, 0.04] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 600 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
        {/* Anvil body */}
        <path
          d="M200 120 L200 80 L180 80 L180 60 L150 60 L150 50 L450 50 L450 60 L420 60 L420 80 L400 80 L400 120 Z"
          fill="#1a1a2e"
        />
        {/* Anvil horn (left) */}
        <path
          d="M150 55 L50 55 L30 50 L50 45 L150 45 Z"
          fill="#1a1a2e"
        />
        {/* Anvil horn (right) */}
        <path
          d="M450 55 L550 55 L570 50 L550 45 L450 45 Z"
          fill="#1a1a2e"
        />
        {/* Top working surface glow */}
        <rect x="150" y="48" width="300" height="4" rx="2" fill="#FF6B35" opacity="0.3" />
        <rect x="150" y="48" width="300" height="4" rx="2" fill="url(#anvilGlow)" />
        {/* Molten drip effects */}
        <circle cx="220" cy="82" r="3" fill="#FF6B35" opacity="0.4" />
        <circle cx="380" cy="82" r="2" fill="#FFB300" opacity="0.3" />
        <circle cx="300" cy="81" r="2.5" fill="#FF5252" opacity="0.35" />
        <defs>
          <linearGradient id="anvilGlow" x1="150" y1="48" x2="450" y2="48" spreadMethod="pad">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0" />
            <stop offset="30%" stopColor="#FF6B35" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FFB300" stopOpacity="1" />
            <stop offset="70%" stopColor="#FF6B35" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

// ─── Main Export ────────────────────────────────────────────────────────────

export function ForgeHeroBackground() {
  const prefersReduced = useReducedMotion();

  // Generate sparks
  const sparks = useMemo<Spark[]>(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: randomBetween(5, 95),
      startY: randomBetween(35, 65),
      endY: randomBetween(5, 30),
      size: randomBetween(1.5, 4),
      duration: randomBetween(2, 4.5),
      delay: randomBetween(0, 4),
      color: randomChoice(SPARK_COLORS),
    }));
  }, []);

  // Generate gears
  const gears = useMemo<Gear[]>(() => {
    return [
      { id: 1, x: '5%', y: '20%', size: 80, speed: 20, teeth: 12, color: '#1E1E2A', opacity: 0.4, rotate: 0 },
      { id: 2, x: '82%', y: '30%', size: 55, speed: 14, teeth: 8, color: '#16161F', opacity: 0.5, rotate: 45 },
      { id: 3, x: '75%', y: '8%', size: 100, speed: 30, teeth: 16, color: '#1E1E2A', opacity: 0.25, rotate: 20 },
      { id: 4, x: '15%', y: '5%', size: 45, speed: 11, teeth: 6, color: '#16161F', opacity: 0.4, rotate: 60 },
      { id: 5, x: '88%', y: '55%', size: 65, speed: 22, teeth: 10, color: '#1E1E2A', opacity: 0.3, rotate: 0 },
      { id: 6, x: '2%', y: '50%', size: 40, speed: 9, teeth: 5, color: '#16161F', opacity: 0.35, rotate: 30 },
    ];
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
      style={{ willChange: 'transform' }}
    >
      {/* Grid background (preserved from original) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Purple/indigo ambient (preserved from original) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, rgba(224,64,251,0.08) 40%, transparent 70%)',
        }}
      />

      {/* Industrial gears */}
      {gears.map((gear) => (
        <GearSilhouette key={gear.id} gear={gear} />
      ))}

      {/* Molten glow system */}
      <MoltenGlow />

      {/* Heat shimmer */}
      <HeatShimmer />

      {/* Anvil / forge silhouette */}
      <ForgeSilhouette />

      {/* Spark particles */}
      {sparks.map((spark) => (
        <SparkParticle key={spark.id} spark={spark} />
      ))}

      {/* Edge vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(5,5,10,0.5) 100%)',
        }}
      />
    </div>
  );
}
