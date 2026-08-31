import React from 'react';
import { Smartphone, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';

interface ModeSelectorProps {
  mode: 'pairing' | 'qr';
  onChange: (mode: 'pairing' | 'qr') => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onChange, disabled }) => {
  return (
    <div className="w-full max-w-md mx-auto p-1 bg-slate-900/90 rounded-2xl border border-slate-800 flex relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('pairing')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all relative z-10 cursor-pointer ${
          mode === 'pairing' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {mode === 'pairing' && (
          <motion.div
            layoutId="mode-tab"
            className="absolute inset-0 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 rounded-xl shadow-lg shadow-cyan-500/20 -z-10"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Smartphone className={`w-4 h-4 ${mode === 'pairing' ? 'text-cyan-200' : 'text-slate-400'}`} />
        <span>Pairing Code</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('qr')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all relative z-10 cursor-pointer ${
          mode === 'qr' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {mode === 'qr' && (
          <motion.div
            layoutId="mode-tab"
            className="absolute inset-0 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 rounded-xl shadow-lg shadow-cyan-500/20 -z-10"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <QrCode className={`w-4 h-4 ${mode === 'qr' ? 'text-cyan-200' : 'text-slate-400'}`} />
        <span>QR Code</span>
      </button>
    </div>
  );
};
