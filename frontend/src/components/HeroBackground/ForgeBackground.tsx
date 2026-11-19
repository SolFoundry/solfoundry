import React from 'react';
import { SparkParticles } from './SparkParticles';

export const ForgeBackground: React.FC = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
      {/* Molten Glow Effects */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#f59e0b22] to-transparent opacity-50" />
      
      {/* Animated Molten "Veins" */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M-100 800 Q 400 700 900 850 T 1900 750"
          stroke="#f59e0b"
          strokeWidth="4"
          fill="transparent"
          filter="url(#glow)"
          className="animate-molten-flow"
        />
        <path
          d="M-100 900 Q 500 850 1000 950 T 2000 850"
          stroke="#fbbf24"
          strokeWidth="2"
          fill="transparent"
          filter="url(#glow)"
          className="animate-molten-flow-delayed"
        />
      </svg>

      {/* Industrial Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Spark Particle System */}
      <SparkParticles />

      {/* Vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-60" />
      
      {/* Content Placeholder */}
      <div className="relative z-10 text-center">
        <h1 className="text-6xl font-bold text-white tracking-tighter">
          SOL<span className="text-[#f59e0b]">FOUNDRY</span>
        </h1>
        <p className="text-gray-400 mt-4 text-xl max-w-md mx-auto">
          Forging the future of decentralized marketplaces.
        </p>
      </div>

      <style jsx>{`
        @keyframes molten-flow {
          0% { stroke-dasharray: 0 2000; stroke-dashoffset: 0; opacity: 0.3; }
          50% { stroke-dasharray: 1000 1000; opacity: 0.6; }
          100% { stroke-dasharray: 0 2000; stroke-dashoffset: -2000; opacity: 0.3; }
        }
        .animate-molten-flow {
          animation: molten-flow 10s infinite linear;
        }
        .animate-molten-flow-delayed {
          animation: molten-flow 15s infinite linear reverse;
        }
      `}</style>
    </div>
  );
};
