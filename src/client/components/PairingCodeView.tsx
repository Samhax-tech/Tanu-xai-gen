import React, { useState, useEffect } from 'react';
import { Copy, Check, Clock, RefreshCw, X, ShieldAlert, ArrowRight, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

interface PairingCodeViewProps {
  pairingCode: string;
  status: string;
  expiresAt: number;
  onCancel: () => void;
}

export const PairingCodeView: React.FC<PairingCodeViewProps> = ({
  pairingCode,
  status,
  expiresAt,
  onCancel
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  // Timer countdown
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const cleanCode = pairingCode.replace('-', '');
  const part1 = cleanCode.slice(0, 4);
  const part2 = cleanCode.slice(4, 8);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'authenticating':
        return {
          text: 'Authenticating with WhatsApp...',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20'
        };
      case 'connected':
      case 'session_generating':
        return {
          text: 'Connected! Finalizing Tanu-XAI session token...',
          color: 'text-cyan-400',
          bg: 'bg-cyan-500/10 border-cyan-500/20'
        };
      default:
        return {
          text: 'Waiting for code entry in WhatsApp...',
          color: 'text-cyan-300',
          bg: 'bg-cyan-500/10 border-cyan-500/20'
        };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="w-full max-w-lg mx-auto bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6"
    >
      {/* Header & Expiry */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Pairing Code Active
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* Code Display Box */}
      <div className="text-center">
        <p className="text-xs font-medium text-slate-400 mb-3">
          Enter this 8-character code in your WhatsApp Linked Devices
        </p>

        <div
          onClick={handleCopy}
          className="group relative cursor-pointer p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-cyan-500/40 hover:border-cyan-400 transition-all glow-cyan flex flex-col items-center justify-center gap-3"
        >
          {/* Digits Display */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <div className="flex gap-1.5 sm:gap-2">
              {part1.split('').map((char, i) => (
                <div
                  key={`p1-${i}`}
                  className="w-9 h-12 sm:w-11 sm:h-14 rounded-xl bg-slate-900/90 border border-slate-700/90 flex items-center justify-center font-mono text-xl sm:text-2xl font-bold text-white shadow-inner"
                >
                  {char}
                </div>
              ))}
            </div>

            <span className="text-slate-600 font-bold text-xl sm:text-2xl">-</span>

            <div className="flex gap-1.5 sm:gap-2">
              {part2.split('').map((char, i) => (
                <div
                  key={`p2-${i}`}
                  className="w-9 h-12 sm:w-11 sm:h-14 rounded-xl bg-slate-900/90 border border-slate-700/90 flex items-center justify-center font-mono text-xl sm:text-2xl font-bold text-white shadow-inner"
                >
                  {char}
                </div>
              ))}
            </div>
          </div>

          {/* Copy prompt button */}
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-400 group-hover:text-cyan-300 transition">
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied to clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Click box to copy code ({cleanCode})</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Status Banner */}
      <div className={`px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>{statusInfo.text}</span>
      </div>

      {/* Instructions Card */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs text-slate-300">
        <p className="font-semibold text-white flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>How to Link with Pairing Code:</span>
        </p>
        <ol className="space-y-1.5 text-slate-400 pl-4 list-decimal marker:text-cyan-400 marker:font-bold">
          <li>Open <strong className="text-slate-200">WhatsApp</strong> on your phone.</li>
          <li>Tap <strong className="text-slate-200">⋮ (Three dots)</strong> or <strong className="text-slate-200">Settings</strong> → <strong className="text-slate-200">Linked Devices</strong>.</li>
          <li>Tap <strong className="text-slate-200">Link a Device</strong>.</li>
          <li>Tap <strong className="text-slate-200">"Link with phone number instead"</strong> at the bottom.</li>
          <li>Enter the code <strong className="text-cyan-400 font-mono">{cleanCode}</strong>.</li>
        </ol>
      </div>

      {/* Action footer */}
      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel & Start Over</span>
        </button>
      </div>
    </motion.div>
  );
};
