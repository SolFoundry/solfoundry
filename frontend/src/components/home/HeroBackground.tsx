import React, { useEffect, useRef, useCallback } from 'react';
import './hero-background.css';

// Spark particle system
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface MoltenDrop {
  x: number;
  y: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

// Canvas-based animated forge/factory hero background
export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const dropsRef = useRef<MoltenDrop[]>([]);
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const SPARK_COLORS = ['#F97316', '#FB923C', '#FBBF24', '#F59E0B', '#EF4444'];
  const MOLTEN_COLORS = ['#F97316', '#EF4444', '#DC2626', '#FBBF24'];

  const createSpark = useCallback((canvasWidth: number, canvasHeight: number): Spark => {
    const centerX = canvasWidth * 0.5;
    const forgeY = canvasHeight * 0.65;

    return {
      x: centerX + (Math.random() - 0.5) * 200,
      y: forgeY + Math.random() * 20,
      vx: (Math.random() - 0.5) * 4,
      vy: -(2 + Math.random() * 6),
      life: 0,
      maxLife: 30 + Math.random() * 60,
      size: 1 + Math.random() * 3,
      color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    };
  }, []);

  const createMoltenDrop = useCallback((canvasWidth: number, canvasHeight: number): MoltenDrop => {
    const centerX = canvasWidth * 0.5;

    return {
      x: centerX + (Math.random() - 0.5) * 80,
      y: canvasHeight * 0.55,
      vy: 1 + Math.random() * 2,
      size: 2 + Math.random() * 4,
      opacity: 0.8 + Math.random() * 0.2,
      color: MOLTEN_COLORS[Math.floor(Math.random() * MOLTEN_COLORS.length)],
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const animate = () => {
      const width = w();
      const height = h();
      timeRef.current += 0.016;

      ctx.clearRect(0, 0, width, height);

      // --- Background gradient (dark forge) ---
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(0.5, '#111111');
      bgGrad.addColorStop(1, '#1a0a00');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- Ambient glow at forge area ---
      const glowX = width * 0.5;
      const glowY = height * 0.65;
      const glowRadius = Math.max(width, height) * 0.4;
      const glowGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
      glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
      glowGrad.addColorStop(0.3, 'rgba(249, 115, 22, 0.05)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // --- Anvil silhouette ---
      const anvilCenterX = width * 0.5;
      const anvilY = height * 0.7;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      // Anvil top
      ctx.moveTo(anvilCenterX - 80, anvilY);
      ctx.lineTo(anvilCenterX + 80, anvilY);
      ctx.lineTo(anvilCenterX + 60, anvilY + 10);
      ctx.lineTo(anvilCenterX + 20, anvilY + 10);
      ctx.lineTo(anvilCenterX + 15, anvilY + 40);
      ctx.lineTo(anvilCenterX + 30, anvilY + 50);
      ctx.lineTo(anvilCenterX + 30, anvilY + 70);
      ctx.lineTo(anvilCenterX - 30, anvilY + 70);
      ctx.lineTo(anvilCenterX - 30, anvilY + 50);
      ctx.lineTo(anvilCenterX - 15, anvilY + 40);
      ctx.lineTo(anvilCenterX - 20, anvilY + 10);
      ctx.lineTo(anvilCenterX - 60, anvilY + 10);
      ctx.closePath();
      ctx.fill();

      // --- Gear wheels (rotating) ---
      const drawGear = (cx: number, cy: number, radius: number, teeth: number, rotation: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.12)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const angle = (i / (teeth * 2)) * Math.PI * 2;
          const r = i % 2 === 0 ? radius : radius * 0.8;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      };

      drawGear(width * 0.15, height * 0.35, 40, 8, timeRef.current * 0.5);
      drawGear(width * 0.85, height * 0.45, 35, 6, -timeRef.current * 0.4);
      drawGear(width * 0.1, height * 0.7, 25, 5, timeRef.current * 0.3);
      drawGear(width * 0.9, height * 0.25, 30, 7, -timeRef.current * 0.6);

      // --- Sparks ---
      // Add new sparks
      if (Math.random() < 0.4) {
        sparksRef.current.push(createSpark(width, height));
      }

      // Update and draw sparks
      sparksRef.current = sparksRef.current.filter((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.08; // gravity
        s.vx *= 0.99; // air resistance
        s.life++;

        if (s.life >= s.maxLife) return false;

        const alpha = 1 - (s.life / s.maxLife);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = s.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        // Fallback: use globalAlpha
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Spark trail
        if (s.life < 10) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3);
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = alpha * 0.5;
          ctx.lineWidth = s.size * 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        return true;
      });

      // --- Molten drops ---
      if (Math.random() < 0.15) {
        dropsRef.current.push(createMoltenDrop(width, height));
      }

      dropsRef.current = dropsRef.current.filter((d) => {
        d.y += d.vy;
        d.opacity -= 0.005;

        if (d.opacity <= 0 || d.y > height) return false;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.globalAlpha = d.opacity;
        ctx.fillStyle = d.color;
        ctx.fill();

        // Glow effect
        const glowSize = d.size * 4;
        const moltenGlow = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowSize);
        moltenGlow.addColorStop(0, `rgba(249, 115, 22, ${d.opacity * 0.3})`);
        moltenGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = moltenGlow;
        ctx.fillRect(d.x - glowSize, d.y - glowSize, glowSize * 2, glowSize * 2);

        ctx.globalAlpha = 1;
        return true;
      });

      // --- Smoke/steam particles (rising) ---
      const smokeY = height * 0.3;
      for (let i = 0; i < 3; i++) {
        const sx = width * (0.3 + Math.random() * 0.4);
        const sy = smokeY + Math.sin(timeRef.current + i) * 20;
        const sr = 15 + Math.random() * 25;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 100, 120, ${0.02 + Math.random() * 0.03})`;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [createSpark, createMoltenDrop]);

  return (
    <div className="hero-background-container">
      <canvas
        ref={canvasRef}
        className="hero-canvas"
      />
      {/* Vignette overlay */}
      <div className="hero-vignette" />
    </div>
  );
}

export default HeroBackground;
