import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ message, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg mx-auto bg-slate-900/80 border border-red-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center space-y-5"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 shadow-inner">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Connection Notice</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {message || 'An error occurred during WhatsApp authentication.'}
        </p>
      </div>

      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-left space-y-1">
        <p className="font-semibold text-slate-300">Common fixes:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Ensure phone number includes valid country code (e.g. +92 for Pakistan).</li>
          <li>Make sure your WhatsApp mobile app is updated and connected to the internet.</li>
          <li>If a previous session was active, wait 30 seconds before retrying.</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700 hover:border-slate-600"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Try Again</span>
      </button>
    </motion.div>
  );
};
