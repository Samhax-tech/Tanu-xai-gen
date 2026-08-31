import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Eye, EyeOff, ShieldAlert, Sparkles, RefreshCw, Send, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

interface SuccessViewProps {
  sessionString: string;
  onReset: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ sessionString, onReset }) => {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sessionString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy session', err);
    }
  };

  const maskedPreview = sessionString.length > 35
    ? `${sessionString.slice(0, 18)}••••••••••••••••${sessionString.slice(-10)}`
    : sessionString;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-xl mx-auto bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 glow-emerald"
    >
      {/* Celebration Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white mb-3 shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">WhatsApp Connected!</h2>
        <p className="text-xs text-slate-400 mt-1">
          Your official Tanu-XAI Bot session token has been generated successfully.
        </p>
      </div>

      {/* WhatsApp DM Notification Alert */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-xs text-emerald-300">
        <Send className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-emerald-200">Sent to your WhatsApp:</span>
          <p className="text-emerald-300/90 mt-0.5">
            The raw session string and setup guide card have been delivered directly to your WhatsApp private chat.
          </p>
        </div>
      </div>

      {/* Session Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Tanu-XAI Session ID
          </label>
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
          >
            {showFull ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showFull ? 'Hide' : 'Reveal'}</span>
          </button>
        </div>

        <div className="relative p-4 rounded-2xl bg-slate-950 border border-slate-700/80 font-mono text-xs text-slate-200 break-all leading-relaxed shadow-inner max-h-36 overflow-y-auto">
          {showFull ? sessionString : maskedPreview}
        </div>
      </div>

      {/* Primary Copy Button */}
      <button
        type="button"
        onClick={handleCopy}
        className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer glow-emerald"
      >
        {copied ? (
          <>
            <Check className="w-5 h-5 text-emerald-100" />
            <span>Copied to Clipboard!</span>
          </>
        ) : (
          <>
            <Copy className="w-5 h-5 text-emerald-100" />
            <span>Copy Session ID</span>
          </>
        )}
      </button>

      {/* Bot Deployment Quick Guide */}
      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>How to use in Tanu-XAI Bot:</span>
        </div>
        <p className="text-slate-400">
          Paste the copied session token into your bot deployment environment variables:
        </p>
        <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-[11px] text-cyan-300 border border-slate-800 break-all">
          SESSION_ID="{sessionString.slice(0, 24)}..."
        </div>
      </div>

      {/* Security Notice */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
        <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p>
          <strong className="text-amber-200">Security Warning:</strong> Keep this session token confidential. Never share it publicly or post it in public repositories.
        </p>
      </div>

      {/* Reset button */}
      <div className="pt-1 flex justify-center">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Generate Another Session</span>
        </button>
      </div>
    </motion.div>
  );
};
