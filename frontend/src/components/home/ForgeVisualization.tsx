import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function ForgeVisualization() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x02030a, 4, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 5.8);

    const ambient = new THREE.AmbientLight(0x4a6077, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0x80f5ff, 0.7);
    key.position.set(2, 5, 3);
    scene.add(key);

    const fireLight = new THREE.PointLight(0xff6a00, 2.2, 12, 2);
    fireLight.position.set(0, 0.45, 0);
    scene.add(fireLight);

    const forgeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 2.1, 1.25, 32),
      new THREE.MeshStandardMaterial({ color: 0x111723, roughness: 0.86, metalness: 0.15 }),
    );
    forgeBase.position.y = -0.5;
    scene.add(forgeBase);

    const core = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.24, 24, 64),
      new THREE.MeshStandardMaterial({
        color: 0xff7d1a,
        emissive: 0xff4f00,
        emissiveIntensity: 1.1,
        roughness: 0.3,
        metalness: 0.1,
      }),
    );
    core.rotation.x = Math.PI / 2;
    scene.add(core);

    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.26, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8c97a8, roughness: 0.44, metalness: 0.75 }),
    );
    anvil.position.set(0, 0.42, 0);
    scene.add(anvil);

    const hammerHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.2, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xaab4c7, roughness: 0.35, metalness: 0.9 }),
    );
    const hammerHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a3626, roughness: 0.85, metalness: 0.15 }),
    );
    hammerHead.position.set(0.95, 1.05, 0.1);
    hammerHandle.position.set(0.95, 0.6, 0.1);
    hammerHandle.rotation.z = 0.18;
    scene.add(hammerHead, hammerHandle);

    const sparkCount = 520;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i += 1) {
      const j = i * 3;
      sparkPositions[j] = 0;
      sparkPositions[j + 1] = 0.35;
      sparkPositions[j + 2] = 0;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ color: 0xffb347, size: 0.04, transparent: true, opacity: 0.85 }),
    );
    scene.add(sparks);

    let lastForge = 0;
    const forgeIntervalMs = 2200;
    const clock = new THREE.Clock();

    const triggerForge = () => {
      fireLight.intensity = 3.7;
      for (let i = 0; i < sparkCount; i += 1) {
        const j = i * 3;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.9 + Math.random() * 2.4;
        sparkPositions[j] = (Math.random() - 0.5) * 0.25;
        sparkPositions[j + 1] = 0.4 + Math.random() * 0.16;
        sparkPositions[j + 2] = (Math.random() - 0.5) * 0.25;
        sparkVelocities[j] = Math.cos(angle) * speed * 0.4;
        sparkVelocities[j + 1] = 1.5 + Math.random() * 2.2;
        sparkVelocities[j + 2] = Math.sin(angle) * speed * 0.4;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.03);

      if (performance.now() - lastForge > forgeIntervalMs) {
        lastForge = performance.now();
        triggerForge();
      }

      core.rotation.z += delta * 0.7;
      core.scale.setScalar(1 + Math.sin(elapsed * 3.4) * 0.03);

      const hammerPhase = (elapsed * 2.1) % 1;
      const strikeCurve = Math.sin(hammerPhase * Math.PI);
      hammerHead.position.y = 1.05 - strikeCurve * 0.54;
      hammerHandle.position.y = 0.6 - strikeCurve * 0.5;
      hammerHead.rotation.z = -strikeCurve * 0.18;
      hammerHandle.rotation.z = 0.18 - strikeCurve * 0.2;

      fireLight.intensity = 2.2 + Math.sin(elapsed * 6) * 0.35 + Math.max(0, 0.7 - hammerPhase * 0.7);

      for (let i = 0; i < sparkCount; i += 1) {
        const j = i * 3;
        sparkPositions[j] += sparkVelocities[j] * delta;
        sparkPositions[j + 1] += sparkVelocities[j + 1] * delta;
        sparkPositions[j + 2] += sparkVelocities[j + 2] * delta;
        sparkVelocities[j + 1] -= 4.2 * delta;
        sparkVelocities[j] *= 0.986;
        sparkVelocities[j + 2] *= 0.986;
        if (sparkPositions[j + 1] < -0.2) {
          sparkPositions[j] = 0;
          sparkPositions[j + 1] = 0.25;
          sparkPositions[j + 2] = 0;
          sparkVelocities[j] = 0;
          sparkVelocities[j + 1] = 0;
          sparkVelocities[j + 2] = 0;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;

      camera.position.x = Math.sin(elapsed * 0.24) * 0.85;
      camera.lookAt(0, 0.35, 0);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    let frame = requestAnimationFrame(animate);

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      sparkGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 opacity-85 pointer-events-none" aria-hidden="true" />;
}
