import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BackgroundElements } from './components/BackgroundElements';
import { Header } from './components/Header';
import { ModeSelector } from './components/ModeSelector';
import { PhoneInputView } from './components/PhoneInputView';
import { PairingCodeView } from './components/PairingCodeView';
import { QRView } from './components/QRView';
import { SuccessView } from './components/SuccessView';
import { ErrorView } from './components/ErrorView';
import { DocsModal } from './components/DocsModal';

type Mode = 'pairing' | 'qr';

export default function App() {
  const [mode, setMode] = useState<Mode>('pairing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionString, setSessionString] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(Date.now() + 300000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll status while session is active
  useEffect(() => {
    if (!sessionId) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    if (['session_ready', 'failed', 'expired'].includes(status)) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}/status`);
        const result = await res.json();

        if (result.success && result.data) {
          const data = result.data;
          setStatus(data.status);

          if (data.pairingCode) setPairingCode(data.pairingCode);
          if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
          if (data.expiresAt) setExpiresAt(data.expiresAt);

          if (data.status === 'session_ready' && data.session) {
            setSessionString(data.session);
          } else if (data.status === 'failed') {
            setErrorMessage(data.error || 'Authentication failed. Please try again.');
          } else if (data.status === 'expired') {
            setErrorMessage('Session expired. Please try again.');
          }
        } else if (result.error) {
          setStatus('failed');
          setErrorMessage(result.error.message || 'Error fetching status');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollStatus, 1500);
    // Initial immediate poll
    pollStatus();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [sessionId, status]);

  // Handle switching to QR mode directly initiates QR generation
  const handleModeChange = (newMode: Mode) => {
    if (isLoading) return;
    setMode(newMode);
    handleReset();

    if (newMode === 'qr') {
      startQRSession();
    }
  };

  const startPairingSession = async (phoneNumber: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'pairing', phoneNumber })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to start pairing session.');
      }

      setSessionId(data.data.sessionId);
      setStatus(data.data.status);
      setExpiresAt(data.data.expiresAt || Date.now() + 300000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not connect to WhatsApp pairing service.');
    } finally {
      setIsLoading(false);
    }
  };

  const startQRSession = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setQrDataUrl(null);

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'qr' })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to start QR session.');
      }

      setSessionId(data.data.sessionId);
      setStatus(data.data.status);
      setExpiresAt(data.data.expiresAt || Date.now() + 300000);
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || 'Could not start QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/session/${sessionId}/cancel`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to cancel session', err);
      }
    }
    handleReset();
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setSessionId(null);
    setStatus('idle');
    setPairingCode(null);
    setQrDataUrl(null);
    setSessionString(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const isSessionActive = Boolean(sessionId && !['session_ready', 'failed', 'expired'].includes(status));

  return (
    <div className="min-h-screen flex flex-col justify-between relative selection:bg-cyan-500/30 selection:text-cyan-200">
      <BackgroundElements />

      {/* Top Header */}
      <Header onOpenDocs={() => setIsDocsOpen(true)} />

      {/* Main Center Stage */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:py-8 flex flex-col justify-center items-center">
        {/* Mode Selector Tabs (only shown before session start or when resetting) */}
        {!sessionString && status === 'idle' && (
          <div className="w-full mb-6">
            <ModeSelector
              mode={mode}
              onChange={handleModeChange}
              disabled={isLoading || isSessionActive}
            />
          </div>
        )}

        {/* Dynamic State Views */}
        <AnimatePresence mode="wait">
          {sessionString ? (
            <SuccessView
              key="success-view"
              sessionString={sessionString}
              onReset={() => {
                handleReset();
                setMode('pairing');
              }}
            />
          ) : status === 'failed' || status === 'expired' ? (
            <ErrorView
              key="error-view"
              message={errorMessage || 'An error occurred'}
              onRetry={() => {
                handleReset();
                if (mode === 'qr') startQRSession();
              }}
            />
          ) : mode === 'pairing' && pairingCode ? (
            <PairingCodeView
              key="pairing-view"
              pairingCode={pairingCode}
              status={status}
              expiresAt={expiresAt}
              onCancel={handleCancel}
            />
          ) : mode === 'qr' && sessionId ? (
            <QRView
              key="qr-view"
              qrDataUrl={qrDataUrl}
              status={status}
              expiresAt={expiresAt}
              onCancel={handleCancel}
            />
          ) : (
            <PhoneInputView
              key="phone-view"
              onSubmit={startPairingSession}
              isLoading={isLoading}
              error={errorMessage}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Modern Footer */}
      <footer className="w-full max-w-4xl mx-auto py-6 px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-900">
        <p>© 2026 Tanu-XAI Engine. Zero-Database Multi-File Auth.</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsDocsOpen(true)}
            className="hover:text-slate-300 transition cursor-pointer"
          >
            Bot Integration Docs
          </button>
          <span>•</span>
          <span className="text-slate-600 font-mono">Baileys v6.7.9</span>
        </div>
      </footer>

      {/* Docs Modal */}
      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}
