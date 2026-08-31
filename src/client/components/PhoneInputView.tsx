import React, { useState } from 'react';
import { Smartphone, ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface PhoneInputViewProps {
  onSubmit: (phone: string) => void;
  isLoading: boolean;
  error?: string | null;
}

const COMMON_PREFIXES = [
  { code: '92', label: '🇵🇰 +92 (PK)' },
  { code: '1', label: '🇺🇸 +1 (US)' },
  { code: '44', label: '🇬🇧 +44 (UK)' },
  { code: '91', label: '🇮🇳 +91 (IN)' },
  { code: '234', label: '🇳🇬 +234 (NG)' },
  { code: '62', label: '🇮🇩 +62 (ID)' },
  { code: '55', label: '🇧🇷 +55 (BR)' },
  { code: '966', label: '🇸🇦 +966 (SA)' }
];

export const PhoneInputView: React.FC<PhoneInputViewProps> = ({ onSubmit, isLoading, error }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const clean = phoneNumber.trim().replace(/[^\d+]/g, '');
    if (!clean) {
      setLocalError('Please enter your WhatsApp phone number.');
      return;
    }

    const digitsOnly = clean.replace(/[^\d]/g, '');
    if (digitsOnly.length < 10) {
      setLocalError('Phone number must contain country code and at least 10 digits.');
      return;
    }

    onSubmit(phoneNumber);
  };

  const handlePrefixClick = (prefix: string) => {
    if (!phoneNumber.startsWith(prefix)) {
      setPhoneNumber(prefix);
    }
  };

  const displayError = error || localError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-lg mx-auto bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">WhatsApp Pairing Code</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Enter your WhatsApp phone number with country code to generate your official 8-digit linking code.
        </p>
      </div>

      {/* Quick Prefix Selectors */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Quick Country Code
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PREFIXES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => handlePrefixClick(item.code)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="phone-input" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Phone Number
          </label>
          <div className="relative">
            <input
              id="phone-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="e.g. 923001234567 or 03001234567"
              disabled={isLoading}
              className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white font-mono text-base tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition disabled:opacity-50"
              autoComplete="tel"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Tip: Pakistani numbers starting with <code className="text-slate-400">03...</code> are automatically converted to <code className="text-slate-400">923...</code>
          </p>
        </div>

        {displayError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"
          >
            {displayError}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed glow-cyan"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to WhatsApp...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Generate Pairing Code</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Security Reassurance */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
        <span>Zero database storage • Direct ephemeral Baileys handshake</span>
      </div>
    </motion.div>
  );
};
