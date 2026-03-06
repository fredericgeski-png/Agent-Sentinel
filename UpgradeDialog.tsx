import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { subscriptionApi } from '../api';

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentCount: number;
  limit: number;
  tier: 'free' | 'pro';
  upgradeUrl?: string;
}

const PRO_FEATURES = [
  { icon: '∞', text: 'Unlimited AI agents' },
  { icon: '📊', text: 'Advanced analytics & entropy reports' },
  { icon: '🔔', text: 'Real-time webhook alerts' },
  { icon: '⚡', text: 'Priority support (4hr response)' },
  { icon: '🛡️', text: 'Advanced kill-switch controls' },
  { icon: '📈', text: 'Historical telemetry (90 days)' },
];

const FREE_FEATURES = [
  { icon: '5', text: '5 agents maximum' },
  { icon: '📋', text: 'Basic dashboard' },
  { icon: '📧', text: 'Email support' },
];

const UpgradeDialog = memo(function UpgradeDialog({
  isOpen,
  onClose,
  currentCount,
  limit,
  tier,
  upgradeUrl,
}: UpgradeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard: Escape closes, trap focus
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleUpgrade = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = upgradeUrl;
      if (!url) {
        const resp = await subscriptionApi.upgrade();
        url = resp.checkout_url;
      }
      window.location.href = url;
    } catch {
      setError('Failed to initiate upgrade. Please try again.');
      setIsLoading(false);
    }
  }, [upgradeUrl]);

  if (!isOpen) return null;

  const estimatedSavings = Math.round(currentCount * 1200);
  const roi = Math.round(((estimatedSavings - 299) / 299) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full rounded-2xl overflow-hidden outline-none"
        style={{
          maxWidth: 600,
          background: 'linear-gradient(145deg, #0d1235 0%, #0a0e27 60%, #060920 100%)',
          border: '2px solid #00d4ff',
          boxShadow: '0 0 60px rgba(0,212,255,0.3)',
          animation: 'fadeIn 200ms ease',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 z-10 rounded-full w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4" style={{ borderBottom: '1px solid rgba(0,212,255,0.2)' }}>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: 28 }}>🚫</span>
            <h2 id="upgrade-dialog-title" className="text-white font-bold text-2xl">
              Agent Limit Reached
            </h2>
          </div>
          <p className="text-gray-400 text-sm">
            You've reached <strong className="text-cyan-400">{currentCount} agents</strong> on the Free tier (limit: {limit}).
            Upgrade to Pro for unlimited agents.
          </p>
        </div>

        {/* Tier comparison */}
        <div className="px-8 py-6 grid grid-cols-2 gap-4">
          {/* Free tier */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="text-center mb-3">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Current Plan</div>
              <div className="text-white font-bold text-lg">Free</div>
              <div className="text-gray-500 text-sm">$0 / month</div>
            </div>
            <ul className="flex flex-col gap-2">
              {FREE_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2 text-xs text-gray-400">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    {f.icon}
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tier */}
          <div
            className="rounded-xl p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,153,204,0.1) 100%)',
              border: '2px solid #00d4ff',
            }}
          >
            <div
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: '#00d4ff', color: '#0a0e27' }}
            >
              BEST VALUE
            </div>
            <div className="text-center mb-3">
              <div style={{ color: '#00d4ff' }} className="text-xs uppercase tracking-wider mb-1 font-semibold">Upgrade To</div>
              <div className="text-white font-bold text-lg">Pro</div>
              <div style={{ color: '#00d4ff' }} className="text-sm font-semibold">$299 / month</div>
            </div>
            <ul className="flex flex-col gap-2">
              {PRO_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-2 text-xs text-white">
                  <span className="flex-shrink-0" style={{ color: '#00d4ff' }}>✓</span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ROI section */}
        <div
          className="mx-8 rounded-xl p-4 mb-6"
          style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#00ff88' }}>
            💰 Estimated ROI for your {currentCount} agents
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-white font-bold">${estimatedSavings.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Est. monthly savings</div>
            </div>
            <div>
              <div className="text-white font-bold">$299</div>
              <div className="text-xs text-gray-500">Pro plan cost</div>
            </div>
            <div>
              <div style={{ color: '#00ff88' }} className="font-bold">{roi}%</div>
              <div className="text-xs text-gray-500">ROI</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(255,68,102,0.15)', color: '#ff4466', border: '1px solid #ff4466' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: 'rgba(255,255,255,0.07)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'background 200ms',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
          >
            Maybe later
          </button>
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            aria-busy={isLoading}
            className="flex-2 flex-grow py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            style={{
              background: isLoading
                ? 'rgba(0,212,255,0.4)'
                : 'linear-gradient(90deg, #00d4ff, #0099cc)',
              color: '#0a0e27',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'opacity 200ms',
              flex: 2,
            }}
          >
            {isLoading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                Redirecting…
              </>
            ) : (
              '⚡ Upgrade to Pro for $299/month'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
});

export default UpgradeDialog;
