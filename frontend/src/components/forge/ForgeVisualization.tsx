import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// --- Anvil ---

function Anvil() {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} castShadow receiveShadow>
      {/* Anvil body - simplified box with beveled edges */}
      <boxGeometry args={[2.4, 0.5, 1.2]} />
      <meshStandardMaterial
        color="#2a2a3e"
        metalness={0.8}
        roughness={0.3}
      />
    </mesh>
  );
}

// --- Hammer ---

function Hammer({ isStriking }: { isStriking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      if (isStriking) {
        const t = state.clock.elapsedTime * 8;
        const swing = Math.sin(t) * 0.5;
        groupRef.current.rotation.x = -0.8 + swing;
      } else {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(
          groupRef.current.rotation.x,
          -0.3,
          0.05
        );
      }
    }
  });

  return (
    <group ref={groupRef} position={[0.3, 1.5, 0]}>
      {/* Handle */}
      <mesh position={[0, -0.6, 0]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0.15, 0, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.2]} />
        <meshStandardMaterial color="#4a4a5e" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

// --- Molten Metal (Glowing) ---

function MoltenMetal() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      // Gentle deformation for molten effect
      meshRef.current.scale.y = 0.15 + Math.sin(t * 2) * 0.02;
      meshRef.current.scale.x = 1 + Math.sin(t * 1.5) * 0.03;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.35, 0]}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial
        color="#FF6600"
        emissive="#FF4400"
        emissiveIntensity={2}
        metalness={0.3}
        roughness={0.7}
      />
    </mesh>
  );
}

// --- Gear Wheel ---

function Gear({ position, radius, speed, teeth = 8 }: {
  position: [number, number, number];
  radius: number;
  speed: number;
  teeth?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Create gear shape
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const innerR = radius * 0.7;
    const outerR = radius;
    const step = (Math.PI * 2) / (teeth * 2);

    for (let i = 0; i < teeth * 2; i++) {
      const angle = i * step;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();

    // Center hole
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius * 0.2, 0, Math.PI * 2, true);
    s.holes.push(hole);

    return s;
  }, [radius, teeth]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += speed * 0.01;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <extrudeGeometry args={[shape, { depth: 0.15, bevelEnabled: false }]} />
        <meshStandardMaterial
          color="#F97316"
          metalness={0.6}
          roughness={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

// --- Fire Particles ---

function ForgeFire() {
  const count = 50;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 0.8,
      y: 0.4 + Math.random() * 0.3,
      z: (Math.random() - 0.5) * 0.4,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
      scale: 0.02 + Math.random() * 0.04,
    }));
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      const phase = (t * p.speed + p.offset) % 3;
      dummy.position.set(
        p.x + Math.sin(t * 2 + p.offset) * 0.1,
        p.y + phase * 0.5,
        p.z + Math.cos(t * 2 + p.offset) * 0.1
      );
      const s = p.scale * (1 - phase / 3);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#FF8800" transparent opacity={0.6} />
    </instancedMesh>
  );
}

// --- Floor ---

function ForgeFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="#111118" roughness={0.9} />
    </mesh>
  );
}

// --- Light Setup ---

function ForgeLighting() {
  return (
    <>
      {/* Main forge glow */}
      <pointLight
        position={[0, 1, 0]}
        color="#FF6600"
        intensity={5}
        distance={8}
        castShadow
      />
      {/* Ambient fill */}
      <ambientLight intensity={0.15} color="#1a1a2e" />
      {/* Rim light */}
      <directionalLight
        position={[3, 5, 2]}
        intensity={0.5}
        color="#FBBF24"
        castShadow
      />
      {/* Background glow */}
      <pointLight position={[-3, 2, -3]} color="#FF4400" intensity={1} distance={6} />
    </>
  );
}

// --- Main Scene ---

function ForgeScene() {
  const [isStriking, setIsStriking] = useState(false);

  // Periodic hammer strikes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsStriking(true);
      setTimeout(() => setIsStriking(false), 1500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <ForgeLighting />
      <ForgeFloor />
      <Anvil />
      <MoltenMetal />
      <Hammer isStriking={isStriking} />

      {/* Gears */}
      <Gear position={[-2.5, 1.5, -1]} radius={0.6} speed={1} teeth={8} />
      <Gear position={[-1.8, 1.5, -1]} radius={0.4} speed={-1.5} teeth={6} />
      <Gear position={[2.5, 2, -1]} radius={0.5} speed={-0.8} teeth={7} />
      <Gear position={[2.0, 2.4, -1]} radius={0.35} speed={1.2} teeth={5} />

      {/* Fire particles */}
      <ForgeFire />

      {/* Ambient sparkles */}
      <Sparkles
        count={30}
        scale={[3, 3, 2]}
        position={[0, 1, 0]}
        size={2}
        speed={0.5}
        color="#FBBF24"
      />

      {/* Floating elements */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh position={[0, 3, 0]}>
          <torusGeometry args={[0.3, 0.05, 8, 32]} />
          <meshStandardMaterial color="#F97316" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2}
        minDistance={3}
        maxDistance={8}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// --- Exported Component ---

export function ForgeVisualization() {
  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden bg-black border border-border-primary">
      <Canvas
        shadows
        camera={{ position: [3, 2.5, 4], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <ForgeScene />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
}

export default ForgeVisualization;
