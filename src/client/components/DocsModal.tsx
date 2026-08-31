import React from 'react';
import { X, Bot, Terminal, Shield, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col z-10"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Tanu-XAI Bot Integration Guide</h3>
                <p className="text-xs text-slate-400">How to configure your bot with the generated session</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto py-5 space-y-5 text-xs text-slate-300 pr-1">
            {/* Step 1 */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">1</span>
                <span>Set Environment Variable</span>
              </h4>
              <p className="text-slate-400">
                Add the exported session string into your bot environment variables on Railway, Render, Koyeb, or in your local <code className="text-slate-200">.env</code> file:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300">
                SESSION_ID="Tanu-XAI~eyJu..."
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">2</span>
                <span>Session Reconstitution Code</span>
              </h4>
              <p className="text-slate-400">
                In your Tanu-XAI bot entry point, decode the session string and restore credentials into Baileys:
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1">
                <p className="text-slate-500">// Decode Base64 session string into Baileys creds</p>
                <p><span className="text-blue-400">import</span> &#123; BufferJSON, useMultiFileAuthState, makeWASocket &#125; <span className="text-blue-400">from</span> <span className="text-emerald-400">'@whiskeysockets/baileys'</span>;</p>
                <p><span className="text-blue-400">import</span> fs <span className="text-blue-400">from</span> <span className="text-emerald-400">'fs'</span>;</p>
                <p><span className="text-blue-400">import</span> path <span className="text-blue-400">from</span> <span className="text-emerald-400">'path'</span>;</p>
                <br />
                <p><span className="text-blue-400">const</span> rawSession = process.env.SESSION_ID.replace(/^Tanu-XAI~/i, '').trim();</p>
                <p><span className="text-blue-400">const</span> credsJson = Buffer.from(rawSession, 'base64').toString('utf8');</p>
                <p><span className="text-blue-400">const</span> creds = JSON.parse(credsJson, BufferJSON.reviver);</p>
                <br />
                <p><span className="text-blue-400">const</span> sessionDir = path.join(process.cwd(), 'session');</p>
                <p><span className="text-blue-400">if</span> (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, &#123; recursive: true &#125;);</p>
                <p>fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));</p>
                <br />
                <p><span className="text-blue-400">const</span> &#123; state, saveCreds &#125; = <span className="text-blue-400">await</span> useMultiFileAuthState(sessionDir);</p>
                <p><span className="text-blue-400">const</span> sock = makeWASocket(&#123; auth: state &#125;);</p>
                <p>sock.ev.on('creds.update', saveCreds);</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">3</span>
                <span>Zero-Database Advantage</span>
              </h4>
              <p className="text-slate-400">
                Unlike older generator architectures that required remote SQL databases like Supabase, this token is 100% self-contained and portable. It runs completely offline on any cloud host.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
