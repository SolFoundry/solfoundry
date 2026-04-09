import React, { useRef, useEffect, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: boolean;
}

interface FloatingEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  wobblePhase: number;
  wobbleSpeed: number;
}

/**
 * Canvas-based animated hero background with forge/molten theme.
 * Features: floating embers, spark bursts, animated gradient mesh, and heat distortion.
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const embersRef = useRef<FloatingEmber[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const lastBurstRef = useRef<number>(0);

  const COLORS = {
    emerald: [0, 230, 118],
    purple: [124, 58, 237],
    magenta: [224, 64, 251],
    orange: [255, 152, 0],
    amber: [255, 193, 7],
  };

  const randomColor = useCallback(() => {
    const colorKeys = Object.keys(COLORS);
    const key = colorKeys[Math.floor(Math.random() * colorKeys.length)];
    return COLORS[key as keyof typeof COLORS];
  }, []);

  const spawnEmber = useCallback((w: number, h: number): FloatingEmber => {
    const color = randomColor();
    const maxLife = 3000 + Math.random() * 5000;
    return {
      x: Math.random() * w,
      y: h + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.3 + Math.random() * 0.8),
      life: maxLife,
      maxLife,
      size: 1 + Math.random() * 3,
      color: `rgb(${color[0]},${color[1]},${color[2]})`,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1.5,
    };
  }, [randomColor]);

  const spawnSparkBurst = useCallback((w: number, h: number, cx: number, cy: number) => {
    const count = 8 + Math.floor(Math.random() * 12);
    const newParticles: Particle[] = [];
    const color = randomColor();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      const maxLife = 500 + Math.random() * 1000;
      newParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: maxLife,
        maxLife,
        size: 0.5 + Math.random() * 2,
        color: `rgb(${color[0]},${color[1]},${color[2]})`,
        glow: Math.random() > 0.5,
      });
    }
    particlesRef.current.push(...newParticles);
  }, [randomColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize embers
    for (let i = 0; i < 30; i++) {
      const ember = spawnEmber(w, h);
      ember.life = Math.random() * ember.maxLife; // stagger start
      embersRef.current.push(ember);
    }

    const drawGradientMesh = (time: number) => {
      // Animated gradient orbs
      const orbs = [
        {
          x: w * 0.5 + Math.sin(time * 0.0003) * w * 0.15,
          y: h * 0.2 + Math.cos(time * 0.0004) * h * 0.1,
          r: Math.max(1, w * 0.35),
          color: [124, 58, 237, 0.08],
        },
        {
          x: w * 0.3 + Math.cos(time * 0.0005) * w * 0.1,
          y: h * 0.6 + Math.sin(time * 0.0003) * h * 0.1,
          r: Math.max(1, w * 0.3),
          color: [224, 64, 251, 0.06],
        },
        {
          x: w * 0.7 + Math.sin(time * 0.0004) * w * 0.1,
          y: h * 0.4 + Math.cos(time * 0.0006) * h * 0.08,
          r: Math.max(1, w * 0.25),
          color: [0, 230, 118, 0.05],
        },
      ];

      for (const orb of orbs) {
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},${orb.color[3]})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const animate = (timestamp: number) => {
      const dt = timestamp - timeRef.current;
      timeRef.current = timestamp;

      ctx.clearRect(0, 0, w, h);

      // Background gradient mesh
      drawGradientMesh(timestamp);

      // Subtle grid
      drawGrid();

      // Update and draw embers
      if (w > 0 && h > 0) {
        // Spawn new embers
        if (embersRef.current.length < 35 && Math.random() < 0.15) {
          embersRef.current.push(spawnEmber(w, h));
        }

        for (let i = embersRef.current.length - 1; i >= 0; i--) {
          const e = embersRef.current[i];
          e.life -= dt;
          if (e.life <= 0 || e.y < -20) {
            embersRef.current.splice(i, 1);
            continue;
          }

          e.wobblePhase += e.wobbleSpeed * dt * 0.001;
          e.x += e.vx + Math.sin(e.wobblePhase) * 0.3;
          e.y += e.vy;

          const lifeRatio = e.life / e.maxLife;
          const alpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : lifeRatio > 0.8 ? (1 - lifeRatio) / 0.2 : 1;

          ctx.save();
          ctx.globalAlpha = alpha * 0.7;

          // Glow
          const glowR = Math.max(1, e.size * 4);
          const glowGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
          glowGrad.addColorStop(0, e.color);
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(e.x - glowR, e.y - glowR, glowR * 2, glowR * 2);

          // Core
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fillStyle = e.color;
          ctx.fill();

          ctx.restore();
        }

        // Spark bursts at random intervals
        if (timestamp - lastBurstRef.current > 2000 + Math.random() * 3000) {
          lastBurstRef.current = timestamp;
          const bx = w * 0.2 + Math.random() * w * 0.6;
          const by = h * 0.2 + Math.random() * h * 0.5;
          spawnSparkBurst(w, h, bx, by);
        }

        // Update and draw spark particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.life -= dt;
          if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.01; // slight gravity

          const lifeRatio = p.life / p.maxLife;
          const alpha = lifeRatio;

          ctx.save();
          ctx.globalAlpha = alpha;

          if (p.glow) {
            const glowR = Math.max(1, p.size * 6);
            const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
            glowGrad.addColorStop(0, p.color);
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          ctx.restore();
        }

        // Draw heat haze lines near bottom
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const baseY = h * 0.85 + i * 8;
          for (let x = 0; x < w; x += 5) {
            const y = baseY + Math.sin((x + timestamp * 0.05) * 0.02 + i) * 3;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [spawnEmber, spawnSparkBurst]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
