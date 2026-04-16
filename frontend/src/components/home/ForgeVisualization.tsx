import React, { useRef, useEffect, useMemo, useCallback } from 'react';

/**
 * SolFoundry 3D Forge Visualization
 * Interactive Three.js WebGL scene showing bounties being "forged" in real-time.
 * Features: particle effects, anvil hammering animation, glowing bounty tokens, 
 * floating embers, 60fps smooth animations.
 */

// We use inline Three.js via a canvas ref to avoid adding Three.js as a dependency
// to the main bundle (lazy-loaded)

interface ForgeVisualizationProps {
  bountyCount?: number;
  className?: string;
}

// Particle system data
interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number];
}

interface BountyToken {
  x: number;
  y: number;
  z: number;
  targetY: number;
  rotation: number;
  scale: number;
  opacity: number;
  forging: boolean;
  forged: boolean;
  color: [number, number, number];
  glowColor: [number, number, number];
}

export function ForgeVisualization({ bountyCount = 5, className = '' }: ForgeVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.parentElement?.clientWidth || 800;
    let height = canvas.parentElement?.clientHeight || 600;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // State
    const particles: Particle[] = [];
    const embers: Particle[] = [];
    const bountyTokens: BountyToken[] = [];
    let time = 0;
    let hammerPhase = 0;
    let sparkBurst = 0;
    let lastHammerTime = 0;
    const hammerInterval = 3000; // ms between hammer strikes
    let mouseX = width / 2;
    let mouseY = height / 2;

    // Colors matching SolFoundry theme
    const EMERALD: [number, number, number] = [0, 230, 118];
    const PURPLE: [number, number, number] = [124, 58, 237];
    const GOLD: [number, number, number] = [255, 193, 7];
    const FIRE: [number, number, number] = [255, 87, 34];
    const WHITE: [number, number, number] = [255, 255, 255];

    // Initialize bounty tokens
    for (let i = 0; i < bountyCount; i++) {
      const angle = (i / bountyCount) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(width, height) * 0.25;
      bountyTokens.push({
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        z: 0,
        targetY: height / 2 + Math.sin(angle) * radius,
        rotation: Math.random() * Math.PI * 2,
        scale: 0,
        opacity: 0,
        forging: i === 0,
        forged: false,
        color: i % 3 === 0 ? EMERALD : i % 3 === 1 ? PURPLE : GOLD,
        glowColor: i % 3 === 0 ? EMERALD : i % 3 === 1 ? PURPLE : GOLD,
      });
    }

    function spawnSpark(x: number, y: number, count: number, color: [number, number, number] = GOLD) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
          x, y, z: Math.random() * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          vz: Math.random() * 2,
          life: 0.5 + Math.random() * 0.8,
          maxLife: 0.5 + Math.random() * 0.8,
          size: 1 + Math.random() * 3,
          color: color,
        });
      }
    }

    function spawnEmber() {
      const anvilX = width / 2;
      const anvilY = height * 0.65;
      embers.push({
        x: anvilX + (Math.random() - 0.5) * 60,
        y: anvilY - Math.random() * 20,
        z: Math.random() * 5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 1.5,
        vz: Math.random() * 0.5,
        life: 1.5 + Math.random() * 2,
        maxLife: 1.5 + Math.random() * 2,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.5 ? FIRE : GOLD,
      });
    }

    function drawAnvil(ctx: CanvasRenderingContext2D, t: number) {
      const cx = width / 2;
      const cy = height * 0.65;
      const hammerOffset = Math.sin(hammerPhase) * 15;

      // Anvil base (dark metal)
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy);
      ctx.lineTo(cx + 80, cy);
      ctx.lineTo(cx + 60, cy + 30);
      ctx.lineTo(cx - 60, cy + 30);
      ctx.closePath();
      ctx.fill();

      // Anvil top surface
      ctx.fillStyle = '#2a2a3a';
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy - 10);
      ctx.lineTo(cx + 70, cy - 10);
      ctx.lineTo(cx + 80, cy);
      ctx.lineTo(cx - 80, cy);
      ctx.closePath();
      ctx.fill();

      // Glowing center on anvil
      const glowIntensity = 0.3 + sparkBurst * 0.7;
      const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 5, 50);
      gradient.addColorStop(0, `rgba(0, 230, 118, ${glowIntensity * 0.8})`);
      gradient.addColorStop(0.4, `rgba(255, 193, 7, ${glowIntensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 60, cy - 30, 120, 30);

      // Hammer
      const hammerY = cy - 80 - hammerOffset;
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(cx - 8, hammerY, 16, 60);
      // Hammer head
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(cx - 25, hammerY - 15, 50, 20);
      // Hammer glow on strike
      if (sparkBurst > 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkBurst * 0.3})`;
        ctx.fillRect(cx - 30, hammerY - 18, 60, 26);
      }
    }

    function drawBountyToken(ctx: CanvasRenderingContext2D, token: BountyToken, t: number) {
      if (token.opacity <= 0) return;
      
      ctx.save();
      ctx.translate(token.x, token.y);
      ctx.rotate(token.rotation);
      ctx.scale(token.scale, token.scale);
      ctx.globalAlpha = token.opacity;

      // Glow
      const glowSize = 25 + (token.forging ? Math.sin(t * 5) * 5 : 0);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
      glow.addColorStop(0, `rgba(${token.glowColor[0]}, ${token.glowColor[1]}, ${token.glowColor[2]}, 0.4)`);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-glowSize, -glowSize, glowSize * 2, glowSize * 2);

      // Token hexagon
      const size = 18;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      // Fill with gradient
      const tokenGrad = ctx.createLinearGradient(-size, -size, size, size);
      tokenGrad.addColorStop(0, `rgba(${token.color[0]}, ${token.color[1]}, ${token.color[2]}, 0.9)`);
      tokenGrad.addColorStop(1, `rgba(${token.color[0] * 0.6}, ${token.color[1] * 0.6}, ${token.color[2] * 0.6}, 0.9)`);
      ctx.fillStyle = tokenGrad;
      ctx.fill();
      ctx.strokeStyle = `rgba(${token.color[0]}, ${token.color[1]}, ${token.color[2]}, 0.5)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = Math.cos(angle) * size * 0.5;
        const py = Math.sin(angle) * size * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // "$" symbol
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawBackground(ctx: CanvasRenderingContext2D, t: number) {
      // Dark gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#050505');
      bg.addColorStop(0.5, '#0A0A0F');
      bg.addColorStop(1, '#0A0A0F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(30, 30, 46, 0.3)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Ambient glow from forge
      const forgeGlow = ctx.createRadialGradient(width / 2, height * 0.6, 0, width / 2, height * 0.6, height * 0.5);
      forgeGlow.addColorStop(0, `rgba(0, 230, 118, ${0.03 + sparkBurst * 0.05})`);
      forgeGlow.addColorStop(0.5, `rgba(255, 152, 0, ${0.02 + sparkBurst * 0.03})`);
      forgeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = forgeGlow;
      ctx.fillRect(0, 0, width, height);
    }

    function update(dt: number) {
      time += dt;
      
      // Hammer animation
      const timeSinceHammer = time * 1000 - lastHammerTime;
      if (timeSinceHammer > hammerInterval) {
        hammerPhase = Math.PI; // Strike down
        lastHammerTime = time * 1000;
        sparkBurst = 1.0;
        // Spawn sparks on hammer strike
        spawnSpark(width / 2, height * 0.65 - 10, 20, GOLD);
        spawnSpark(width / 2, height * 0.65 - 10, 10, EMERALD);
        
        // Forge next token
        const forging = bountyTokens.find(t => t.forging && !t.forged);
        if (forging) {
          forging.forged = true;
          forging.forging = false;
        }
        const next = bountyTokens.find(t => !t.forged && !t.forging);
        if (next) next.forging = true;
      }

      // Hammer phase decay
      hammerPhase *= 0.95;
      sparkBurst *= 0.92;

      // Update tokens
      bountyTokens.forEach((token, i) => {
        if (token.forged) {
          token.scale = Math.min(token.scale + dt * 2, 1);
          token.opacity = Math.min(token.opacity + dt * 2, 0.9);
          token.rotation += dt * 0.5;
          // Float animation
          token.y = token.targetY + Math.sin(time * 2 + i) * 5;
        } else if (token.forging) {
          token.scale = Math.min(token.scale + dt * 3, 1.2);
          token.opacity = Math.min(token.opacity + dt * 3, 1);
          token.rotation += dt * 3;
          token.y = token.targetY + Math.sin(time * 8) * 3; // Vibrating while forging
        } else {
          token.scale *= 0.98;
          token.opacity *= 0.98;
        }
      });

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Update embers
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.x += e.vx + Math.sin(time * 3 + e.x * 0.01) * 0.2;
        e.y += e.vy;
        e.life -= dt;
        if (e.life <= 0) embers.splice(i, 1);
      }

      // Spawn embers continuously
      if (Math.random() < 0.3) spawnEmber();
    }

    function render() {
      if (!ctx) return;
      const dt = 1 / 60;
      
      update(dt);
      
      // Clear and draw background
      drawBackground(ctx, time);

      // Draw embers (behind anvil)
      embers.forEach(e => {
        const alpha = (e.life / e.maxLife) * 0.8;
        ctx.fillStyle = `rgba(${e.color[0]}, ${e.color[1]}, ${e.color[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        // Ember glow
        const emberGlow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3);
        emberGlow.addColorStop(0, `rgba(${e.color[0]}, ${e.color[1]}, ${e.color[2]}, ${alpha * 0.3})`);
        emberGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = emberGlow;
        ctx.fillRect(e.x - e.size * 3, e.y - e.size * 3, e.size * 6, e.size * 6);
      });

      // Draw anvil
      drawAnvil(ctx, time);

      // Draw particles (sparks)
      particles.forEach(p => {
        const alpha = (p.life / p.maxLife);
        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        // Spark trail
        ctx.strokeStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
        ctx.stroke();
      });

      // Draw bounty tokens
      bountyTokens.forEach(token => drawBountyToken(ctx, token, time));

      // Title text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⟐ FORGE ACTIVE ⟐', width / 2, 30);
      
      // Status indicator
      const forging = bountyTokens.find(t => t.forging);
      const forged = bountyTokens.filter(t => t.forged).length;
      ctx.fillStyle = 'rgba(0, 230, 118, 0.7)';
      ctx.font = '12px monospace';
      ctx.fillText(`Forged: ${forged}/${bountyCount} ${forging ? '⟳ Forging...' : ''}`, width / 2, 52);

      animFrameRef.current = requestAnimationFrame(render);
    }

    // Handle resize
    const handleResize = () => {
      width = canvas.parentElement?.clientWidth || 800;
      height = canvas.parentElement?.clientHeight || 600;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      // Reposition tokens
      bountyTokens.forEach((token, i) => {
        const angle = (i / bountyCount) * Math.PI * 2 - Math.PI / 2;
        const radius = Math.min(width, height) * 0.25;
        token.x = width / 2 + Math.cos(angle) * radius;
        token.targetY = height / 2 + Math.sin(angle) * radius;
        if (!token.forged && !token.forging) token.y = token.targetY;
      });
    };
    window.addEventListener('resize', handleResize);

    // Handle mouse
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', handleMouse);

    // Start
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouse);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [bountyCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
}