import React, { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'ember' | 'droplet';
}

const COLORS = {
  spark: ['#FFD700', '#FFA500', '#FF6B00', '#FF4500'],
  ember: ['#FF4444', '#FF6B35', '#F7931E', '#FFD700'],
  droplet: ['#00E676', '#69F0AE', '#7C3AED', '#E040FB'],
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  const createParticle = useCallback((canvas: HTMLCanvasElement, forced?: boolean): Particle => {
    const types: Array<'spark' | 'ember' | 'droplet'> = ['spark', 'ember', 'droplet'];
    const type = types[Math.floor(Math.random() * types.length)] as 'spark' | 'ember' | 'droplet';
    const colorSet = COLORS[type];
    const color = colorSet[Math.floor(Math.random() * colorSet.length)];

    // Sparks come from bottom center (forge), embers float up, droplets fall
    let x: number, y: number, vx: number, vy: number;

    if (type === 'spark') {
      x = canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.3;
      y = canvas.height * 0.85;
      vx = (Math.random() - 0.5) * 3;
      vy = -(Math.random() * 4 + 2);
    } else if (type === 'ember') {
      x = Math.random() * canvas.width;
      y = canvas.height + 10;
      vx = (Math.random() - 0.5) * 1.5;
      vy = -(Math.random() * 2 + 0.5);
    } else {
      // droplet - ambient
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
      vx = (Math.random() - 0.5) * 0.5;
      vy = Math.random() * 0.3 + 0.1;
    }

    const size = type === 'spark' ? Math.random() * 3 + 1
      : type === 'ember' ? Math.random() * 4 + 2
      : Math.random() * 3 + 1;

    const maxLife = type === 'spark' ? 60 + Math.random() * 40
      : type === 'ember' ? 120 + Math.random() * 80
      : 200 + Math.random() * 100;

    return { x, y, vx, vy, life: maxLife, maxLife, size, color, type };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    // Initialize particles
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push(createParticle(canvas, true));
    }

    let lastTime = 0;
    const animate = (timestamp: number) => {
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      // Adjust spawn rate based on delta (target 60fps)
      const spawnChance = delta > 30 ? 0.4 : 0.15;

      // Spawn new particles
      if (Math.random() < spawnChance && particlesRef.current.length < 80) {
        particlesRef.current.push(createParticle(canvas));
      }

      // Clear with fade
      ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life--;

        // Physics
        if (p.type === 'spark') {
          p.vy += 0.05; // slight gravity
          p.vx *= 0.99;
        } else if (p.type === 'ember') {
          p.vx += (Math.random() - 0.5) * 0.1; // drift
          p.vy *= 0.995;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > height) p.y = 0;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
        }

        p.x += p.vx;
        p.y += p.vy;

        const alpha = Math.max(0, p.life / p.maxLife);
        const size = p.size * alpha;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);

        if (p.type === 'spark') {
          // Glow effect for sparks
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
          gradient.addColorStop(0, p.color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = p.color + Math.round(alpha * 200).toString(16).padStart(2, '0');
        }

        ctx.fill();

        return p.life > 0;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouse);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouse);
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}