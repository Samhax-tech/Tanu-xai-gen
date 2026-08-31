import React, { useState, useEffect } from 'react';
import { QrCode, Clock, RefreshCw, X, Smartphone, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface QRViewProps {
  qrDataUrl: string | null;
  status: string;
  expiresAt: number;
  onCancel: () => void;
}

export const QRView: React.FC<QRViewProps> = ({ qrDataUrl, status, expiresAt, onCancel }) => {
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

  const getStatusDisplay = () => {
    switch (status) {
      case 'authenticating':
        return {
          text: 'QR Scanned! Authenticating...',
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
          text: 'Scan this QR code with WhatsApp',
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
            Live QR Scanner
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* QR Code Canvas Frame */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white shadow-2xl border-4 border-cyan-500/30 flex items-center justify-center min-w-[260px] min-h-[260px] sm:min-w-[280px] sm:min-h-[280px]">
          {/* Laser Scanning Line Animation */}
          <div className="absolute inset-x-4 top-4 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse shadow-sm" />

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="WhatsApp Pairing QR Code"
              className="w-60 h-60 sm:w-64 sm:h-64 object-contain rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-700 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
              <span className="text-xs font-semibold">Generating WhatsApp QR...</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Status Banner */}
      <div className={`px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>{statusInfo.text}</span>
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-300">
        <p className="font-semibold text-white flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>How to Link with QR:</span>
        </p>
        <ol className="space-y-1 text-slate-400 pl-4 list-decimal marker:text-cyan-400 marker:font-bold">
          <li>Open <strong className="text-slate-200">WhatsApp</strong> on your phone.</li>
          <li>Tap <strong className="text-slate-200">Linked Devices</strong> → <strong className="text-slate-200">Link a Device</strong>.</li>
          <li>Point your phone camera to scan the QR code above.</li>
        </ol>
      </div>

      {/* Cancel button */}
      <div className="pt-1 flex justify-center">
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
