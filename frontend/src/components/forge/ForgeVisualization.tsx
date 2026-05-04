import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

// ========== PARTICLE SYSTEM ==========
function ForgeParticles({ count = 200, active = true }) {
  const mesh = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 3,
        z: (Math.random() - 0.5) * 2,
        speed: 0.5 + Math.random() * 2,
        size: 0.02 + Math.random() * 0.05,
        life: Math.random(),
        maxLife: 0.5 + Math.random() * 1.5,
      });
    }
    return temp;
  }, [count]);

  useFrame((_, delta) => {
    if (!mesh.current || !active) return;
    const positions = mesh.current.geometry.attributes.position;
    const sizes = mesh.current.geometry.attributes.aSize;

    particles.forEach((p, i) => {
      p.life += delta * p.speed;
      if (p.life > p.maxLife) {
        p.life = 0;
        p.x = (Math.random() - 0.5) * 1.5;
        p.y = -0.2;
        p.z = (Math.random() - 0.5) * 1.5;
      }

      const t = p.life / p.maxLife;
      dummy.position.set(
        p.x + Math.sin(p.life * 3) * 0.1,
        p.y + t * 3,
        p.z + Math.cos(p.life * 2) * 0.1
      );
      dummy.scale.setScalar(p.size * (1 - t));
      dummy.updateMatrix();
      positions.setXYZ(i, dummy.position.x, dummy.position.y, dummy.position.z);
      sizes.setX(i, p.size * (1 - t * 0.8));
    });

    positions.needsUpdate = true;
    sizes.needsUpdate = true;
  });

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    particles.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    return arr;
  }, [count, particles]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    particles.forEach((p, i) => { arr[i] = p.size; });
    return arr;
  }, [count, particles]);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    particles.forEach((_, i) => {
      const t = Math.random();
      // Orange to yellow gradient
      arr[i * 3] = 1.0;
      arr[i * 3 + 1] = 0.3 + t * 0.5;
      arr[i * 3 + 2] = t * 0.2;
    });
    return arr;
  }, [count, particles]);

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ========== ANVIL ==========
function Anvil() {
  const anvilRef = useRef<THREE.Group>(null);

  return (
    <group ref={anvilRef} position={[0, -0.5, 0]}>
      {/* Anvil body */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.2, 0.3, 0.8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Anvil top (horn) */}
      <mesh position={[0.7, 0.3, 0]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Anvil base */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.8, 0.3, 0.6]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ========== GLOWING METAL PIECE ==========
function GlowingMetal({ isForging }: { isForging: boolean }) {
  const metalRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!metalRef.current) return;
    const t = state.clock.elapsedTime;
    if (isForging) {
      // Pulse glow when forging
      const intensity = 1.5 + Math.sin(t * 8) * 0.5;
      if (glowRef.current) {
        glowRef.current.intensity = intensity;
      }
      // Slight scale pulse
      metalRef.current.scale.setScalar(1 + Math.sin(t * 8) * 0.02);
    }
  });

  const metalColor = isForging ? '#ff6600' : '#8B4513';

  return (
    <group position={[0, 0.35, 0]}>
      <mesh ref={metalRef}>
        <boxGeometry args={[0.4, 0.1, 0.3]} />
        <meshStandardMaterial
          color={metalColor}
          emissive={isForging ? '#ff4400' : '#000000'}
          emissiveIntensity={isForging ? 2 : 0}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>
      {isForging && (
        <pointLight ref={glowRef} color="#ff6600" intensity={1.5} distance={4} />
      )}
    </group>
  );
}

// ========== HAMMER ==========
function Hammer({ isForging }: { isForging: boolean }) {
  const hammerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!hammerRef.current || !isForging) return;
    const t = state.clock.elapsedTime;
    // Hammer strike animation
    const cycle = t * 2 % 1;
    const y = cycle < 0.3
      ? 0.5 + cycle * 3 // Rise
      : cycle < 0.35
        ? 0.5 + 0.9 - (cycle - 0.3) * 20 // Strike down fast
        : 0.5 + 0.9 - Math.min((cycle - 0.35) * 5, 0.9); // Return
    hammerRef.current.position.y = y;
  });

  return (
    <group ref={hammerRef} position={[0, 0.5, 0.3]}>
      {/* Handle */}
      <mesh position={[0, 0.3, 0]} rotation={[0.3, 0, 0.2]}>
        <cylinderGeometry args={[0.03, 0.04, 0.8, 8]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.25, 0.12, 0.12]} />
        <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ========== EMBER BED ==========
function EmberBed() {
  const embersRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!embersRef.current) return;
    const mat = embersRef.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    mat.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.2;
  });

  return (
    <mesh ref={embersRef} position={[0, -0.05, 0]}>
      <boxGeometry args={[2, 0.08, 1.2]} />
      <meshStandardMaterial
        color="#1a0800"
        emissive="#ff3300"
        emissiveIntensity={0.8}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ========== BOUNTY LABEL ==========
function BountyLabel({ bounty, visible }: { bounty: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={[0, 1.8, 0]}>
        <mesh>
          <planeGeometry args={[1.5, 0.4]} />
          <meshStandardMaterial
            color="#0a2e1a"
            emissive="#00d4aa"
            emissiveIntensity={0.3}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
    </Float>
  );
}

// ========== FORGE SCENE ==========
function ForgeScene({ isForging, bountyName }: { isForging: boolean; bountyName: string }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 3]} intensity={0.3} color="#4466aa" />

      {/* Forge elements */}
      <Anvil />
      <EmberBed />
      <GlowingMetal isForging={isForging} />
      <Hammer isForging={isForging} />
      <BountyLabel bounty={bountyName} visible={isForging} />

      {/* Particles */}
      <ForgeParticles count={150} active={isForging} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a0a0f" metalness={0.1} roughness={0.9} />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
      />
    </>
  );
}

// ========== MAIN EXPORT ==========
export function ForgeVisualization() {
  const [isForging, setIsForging] = useState(false);
  const [bountyName, setBountyName] = useState('');
  const bountyNames = useMemo(() => [
    'Smart Contract Audit',
    'NFT Marketplace UI',
    'Token Bridge Fix',
    'Dashboard Analytics',
    'Wallet Integration',
    'DAO Governance',
    'DeFi Protocol',
    'Cross-chain Swap',
  ], []);

  useEffect(() => {
    // Auto-cycle forging bounties
    const cycle = () => {
      setIsForging(true);
      setBountyName(bountyNames[Math.floor(Math.random() * bountyNames.length)]);
      setTimeout(() => {
        setIsForging(false);
      }, 3000);
    };

    cycle(); // Start immediately
    const interval = setInterval(cycle, 5000);
    return () => clearInterval(interval);
  }, [bountyNames]);

  return (
    <div className="relative w-full h-[500px] md:h-[600px] rounded-xl overflow-hidden border border-forge-800/50">
      <Canvas
        camera={{ position: [3, 2, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ForgeScene isForging={isForging} bountyName={bountyName} />
      </Canvas>

      {/* Overlay UI */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-forge-950/90 to-transparent">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isForging ? 'bg-emerald-400 animate-pulse' : 'bg-forge-600'}`} />
          <span className="text-sm text-forge-300 font-mono">
            {isForging ? `Forging: ${bountyName}` : 'Forge idle...'}
          </span>
        </div>
      </div>

      {/* Top overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <div className="flex items-center gap-2 bg-forge-950/70 px-3 py-1.5 rounded-full border border-forge-700/30">
          <span className="text-emerald-400 text-xs font-bold">● LIVE</span>
          <span className="text-forge-400 text-xs">SolFoundry Forge</span>
        </div>
        <div className="bg-forge-950/70 px-3 py-1.5 rounded-full border border-forge-700/30">
          <span className="text-forge-400 text-xs">Drag to rotate</span>
        </div>
      </div>
    </div>
  );
}

export default ForgeVisualization;