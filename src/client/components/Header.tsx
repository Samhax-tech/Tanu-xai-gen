import React from 'react';
import { Bot, Shield, BookOpen } from 'lucide-react';

interface HeaderProps {
  onOpenDocs: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDocs }) => {
  return (
    <header className="w-full max-w-4xl mx-auto pt-8 pb-6 px-4 flex items-center justify-between">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-lg shadow-cyan-500/20">
          <div className="w-full h-full bg-[#0d121f] rounded-[10px] flex items-center justify-center">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>TANU</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">XAI</span>
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              v2.0
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">Session Generator Engine</p>
        </div>
      </div>

      {/* Right Controls & Status */}
      <div className="flex items-center gap-3">
        {/* System Online Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-slate-300">Zero-DB Multi-File Auth</span>
        </div>

        {/* Integration Guide Button */}
        <button
          type="button"
          onClick={onOpenDocs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
          title="How to use session in Tanu-XAI Bot"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>Bot Guide</span>
        </button>
      </div>
    </header>
  );
};
