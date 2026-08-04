import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ─── constants ───────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 150;
const SPARK_COUNT = 40;
const BOUNTY_COUNT = 6;

interface BountyItem {
  mesh: THREE.Mesh;
  baseY: number;
  speed: number;
  phase: number;
  color: THREE.Color;
}

interface Spark {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

// ─── component ────────────────────────────────────────────────────────────────
export function ForgeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points;
    bounties: BountyItem[];
    sparks: Spark[];
    clock: THREE.Clock;
    rafId: number;
  } | null>(null);

  const initScene = useCallback((container: HTMLDivElement) => {
    const w = container.clientWidth;
    const h = container.clientHeight;

    // ── renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 50);
    camera.position.set(4, 3, 6);
    camera.lookAt(0, 0.5, 0);

    // ── lights ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    scene.add(ambient);

    const forgeLight = new THREE.PointLight(0xff6600, 3, 8);
    forgeLight.position.set(0, 0.8, 0);
    scene.add(forgeLight);

    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    rimLight.position.set(-2, 4, 3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xff8844, 0.3);
    fillLight.position.set(3, 1, -2);
    scene.add(fillLight);

    // ── forge platform ────────────────────────────────────────────────────
    const platformGeo = new THREE.CylinderGeometry(1.8, 2.2, 0.15, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.9,
      roughness: 0.4,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.1;
    scene.add(platform);

    // ── anvil / forge core ────────────────────────────────────────────────
    const forgeGeo = new THREE.CylinderGeometry(0.6, 0.9, 0.8, 24);
    const forgeMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0xff4400,
      emissiveIntensity: 0.15,
    });
    const forge = new THREE.Mesh(forgeGeo, forgeMat);
    forge.position.y = 0.4;
    scene.add(forge);

    // ── forge glow ring ───────────────────────────────────────────────────
    const glowGeo = new THREE.TorusGeometry(0.7, 0.08, 16, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.4,
    });
    const glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.position.y = 0.45;
    glowRing.rotation.x = Math.PI / 2;
    scene.add(glowRing);

    // ── inner glow ────────────────────────────────────────────────────────
    const innerGlowGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.25,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    innerGlow.position.y = 0.45;
    scene.add(innerGlow);

    // ── particle system (embers) ──────────────────────────────────────────
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 1.5;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = 0.4 + Math.random() * 2.5;
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      const t = Math.random();
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.4 + t * 0.5;
      colors[i * 3 + 2] = t * 0.3;

      sizes[i] = 0.03 + Math.random() * 0.06;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── sparks (shooting particles) ───────────────────────────────────────
    const sparksArr: Spark[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.9,
      });
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      sparkMesh.position.set(0, 0.5, 0);
      scene.add(sparkMesh);

      sparksArr.push({
        mesh: sparkMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1.5 + Math.random() * 3,
          (Math.random() - 0.5) * 2,
        ),
        life: Math.random(),
        maxLife: 0.5 + Math.random() * 1.5,
      });
    }

    // ── bounty items (floating cubes) ─────────────────────────────────────
    const bountiesArr: BountyItem[] = [];
    const bountyColors = [0x00e676, 0x4488ff, 0xff6600, 0xe040fb, 0xffd600, 0x00bcd4];
    for (let i = 0; i < BOUNTY_COUNT; i++) {
      const size = 0.08 + Math.random() * 0.1;
      const bountyGeo = new THREE.BoxGeometry(size, size, size);
      const color = new THREE.Color(bountyColors[i % bountyColors.length]);
      const bountyMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        metalness: 0.5,
        roughness: 0.2,
      });
      const bountyMesh = new THREE.Mesh(bountyGeo, bountyMat);

      const angle = (i / BOUNTY_COUNT) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      bountyMesh.position.set(
        Math.cos(angle) * radius,
        0.5 + Math.random() * 0.3,
        Math.sin(angle) * radius,
      );

      scene.add(bountyMesh);
      bountiesArr.push({
        mesh: bountyMesh,
        baseY: bountyMesh.position.y,
        speed: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        color,
      });
    }

    // ── store refs ────────────────────────────────────────────────────────
    const clock = new THREE.Clock();

    const state = {
      scene,
      camera,
      renderer,
      particles,
      bounties: bountiesArr,
      sparks: sparksArr,
      clock,
      rafId: 0,
    };
    sceneRef.current = state;

    // ── animate ───────────────────────────────────────────────────────────
    function animate() {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Rotate particles
      particles.rotation.y += delta * 0.15;

      // Animate individual particle positions (drift upward)
      const pos = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += delta * (0.1 + Math.sin(elapsed + i) * 0.05);
        if (pos[i * 3 + 1] > 3) {
          pos[i * 3 + 1] = 0.4;
          const theta = Math.random() * Math.PI * 2;
          const radius = 0.3 + Math.random() * 1.5;
          pos[i * 3] = Math.cos(theta) * radius;
          pos[i * 3 + 2] = Math.sin(theta) * radius;
        }
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Animate forge glow
      const pulse = 0.6 + Math.sin(elapsed * 2) * 0.4;
      forgeLight.intensity = 2 + pulse * 2;
      innerGlowMat.opacity = 0.15 + Math.sin(elapsed * 2.5) * 0.12;
      glowRing.scale.setScalar(1 + Math.sin(elapsed * 1.5) * 0.05);

      // Animate bounties (float + rotate)
      for (const b of bountiesArr) {
        b.mesh.position.y = b.baseY + Math.sin(elapsed * b.speed + b.phase) * 0.15;
        b.mesh.rotation.x += delta * 0.5;
        b.mesh.rotation.y += delta * 0.8;
      }

      // Animate sparks
      for (const s of sparksArr) {
        s.life -= delta;
        if (s.life <= 0) {
          s.mesh.position.set(0, 0.5, 0);
          s.velocity.set(
            (Math.random() - 0.5) * 2.5,
            1.5 + Math.random() * 3.5,
            (Math.random() - 0.5) * 2.5,
          );
          s.life = s.maxLife;
          s.mesh.scale.setScalar(1);
          (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        } else {
          s.mesh.position.x += s.velocity.x * delta;
          s.mesh.position.y += s.velocity.y * delta;
          s.mesh.position.z += s.velocity.z * delta;

          s.velocity.y -= delta * 2.5; // gravity

          const lifeRatio = s.life / s.maxLife;
          s.mesh.scale.setScalar(lifeRatio);
          (s.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.9;
        }
      }

      // Gentle camera orbit
      camera.position.x = 4 * Math.cos(elapsed * 0.08);
      camera.position.z = 4 * Math.sin(elapsed * 0.08);
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
      state.rafId = requestAnimationFrame(animate);
    }

    animate();

    return state;
  }, []);

  // ── mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = initScene(container);

    const handleResize = () => {
      if (!container || !sceneRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(state.rafId);
      if (state.renderer.domElement.parentElement) {
        state.renderer.domElement.parentElement.removeChild(state.renderer.domElement);
      }
      state.renderer.dispose();
    };
  }, [initScene]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}