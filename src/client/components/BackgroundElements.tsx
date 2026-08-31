import React from 'react';

export const BackgroundElements: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Grid Pattern */}
      <div className="absolute inset-0 grid-bg opacity-40" />

      {/* Ambient Top Glow Orbs */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/4 -left-40 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" />

      {/* Radial center mask */}
      <div className="absolute inset-0 bg-radial from-transparent via-[#07090e]/60 to-[#07090e]" />
    </div>
  );
};
