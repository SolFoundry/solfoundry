import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * ForgeVisualization3D — Bounty #865
 * Interactive 3D WebGL visualization of a forge for the homepage.
 * Shows bounties being "forged" in real-time with particle effects.
 * Uses Three.js for 60fps animations.
 */
export function ForgeVisualization3D({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<THREE.Points | null>(null);
  const bountyOrbsRef = useRef<THREE.Mesh[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xff6600, 0.4);
    scene.add(ambientLight);

    const forgeLight = new THREE.PointLight(0xff4500, 3, 12);
    forgeLight.position.set(0, 1.5, 0);
    scene.add(forgeLight);

    const rimLight = new THREE.PointLight(0x00e5ff, 1.5, 10);
    rimLight.position.set(-3, 3, 2);
    scene.add(rimLight);

    const topLight = new THREE.DirectionalLight(0xffd700, 0.8);
    topLight.position.set(0, 10, 5);
    scene.add(topLight);

    // --- Forge Base (anvil + pedestal) ---
    const anvilGeo = new THREE.BoxGeometry(3.5, 0.4, 2.2);
    const anvilMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      metalness: 0.9,
      roughness: 0.3,
    });
    const anvil = new THREE.Mesh(anvilGeo, anvilMat);
    anvil.position.y = 0.2;
    scene.add(anvil);

    // Anvil horn (left)
    const hornGeo = new THREE.ConeGeometry(0.35, 1.8, 6);
    const hornMesh = new THREE.Mesh(hornGeo, anvilMat);
    hornMesh.rotation.z = Math.PI / 2;
    hornMesh.position.set(-2.4, 0.2, 0);
    scene.add(hornMesh);

    // Pedestal
    const pedGeo = new THREE.BoxGeometry(2.8, 0.8, 1.8);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.6, roughness: 0.5 });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -0.6;
    scene.add(pedestal);

    // --- Glowing Core (bounty being forged) ---
    const coreGeo = new THREE.IcosahedronGeometry(0.35, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xff6600,
      emissiveIntensity: 1.5,
      metalness: 0.3,
      roughness: 0.2,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 1.2, 0);
    scene.add(core);

    // Core glow ring
    const ringGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xff6600,
      emissiveIntensity: 2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(core.position);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    // --- Ember Particles ---
    const particleCount = 280;
    const positions = new Float32Array(particleCount * 3);
    const velocities: number[] = [];
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 1.2 + Math.random() * 0.3;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      velocities.push(
        (Math.random() - 0.5) * 0.04,
        0.02 + Math.random() * 0.06,
        (Math.random() - 0.5) * 0.04
      );

      // Color: orange → gold → cyan
      const t = Math.random();
      if (t < 0.6) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.4 + Math.random() * 0.4; colors[i * 3 + 2] = 0.0;
      } else {
        colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.8 + Math.random() * 0.2; colors[i * 3 + 2] = 1.0;
      }
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // --- Bounty Orbs (orbiting reward indicators) ---
    bountyOrbsRef.current = [];
    const orbColors = [0x00e5ff, 0xe040fb, 0x00e676, 0xffd700];
    for (let i = 0; i < 4; i++) {
      const orbGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const orbMat = new THREE.MeshStandardMaterial({
        color: orbColors[i],
        emissive: orbColors[i],
        emissiveIntensity: 1.2,
        metalness: 0.2,
        roughness: 0.1,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      scene.add(orb);
      bountyOrbsRef.current.push(orb);
    }

    // --- Resize handler ---
    const handleResize = () => {
      if (!el || !renderer || !camera) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    setReady(true);

    // --- Animation Loop ---
    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.016;

      // Rotate core
      core.rotation.y += 0.02;
      core.rotation.x += 0.005;
      core.position.y = 1.2 + Math.sin(time * 1.5) * 0.15;

      // Pulse ring
      ring.rotation.z += 0.015;
      ring.scale.setScalar(1 + Math.sin(time * 2) * 0.15);
      ringMat.emissiveIntensity = 1.5 + Math.sin(time * 3) * 0.8;

      // Pulse forge light
      forgeLight.intensity = 2.5 + Math.sin(time * 2.5) * 0.8;

      // Animate particles (rising embers)
      const pos = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velocities[i * 3];
        pos[i * 3 + 1] += velocities[i * 3 + 1];
        pos[i * 3 + 2] += velocities[i * 3 + 2];

        // Reset particle when it rises too high or drifts too far
        if (pos[i * 3 + 1] > 5 || Math.abs(pos[i * 3]) > 2 || Math.abs(pos[i * 3 + 2]) > 2) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.3;
          pos[i * 3] = Math.cos(angle) * r;
          pos[i * 3 + 1] = 1.2;
          pos[i * 3 + 2] = Math.sin(angle) * r;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Animate bounty orbs (orbit the core)
      bountyOrbsRef.current.forEach((orb, i) => {
        const baseAngle = (i / 4) * Math.PI * 2 + time * (0.5 + i * 0.15);
        const orbitRadius = 1.5 + Math.sin(time + i) * 0.2;
        orb.position.set(
          Math.cos(baseAngle) * orbitRadius,
          1.2 + Math.sin(time * 1.3 + i) * 0.4,
          Math.sin(baseAngle) * orbitRadius
        );
      });

      // Subtle camera sway
      camera.position.x = Math.sin(time * 0.3) * 0.3;
      camera.position.y = 2 + Math.sin(time * 0.2) * 0.15;
      camera.lookAt(0, 0.8, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mountRef}
        className="w-full h-full"
        style={{ minHeight: '420px' }}
      />
      {ready && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-cyan-400/60 font-mono">
          ● LIVE · 3D FORGE · BOUNTIES BEING FORGED
        </div>
      )}
    </div>
  );
}
