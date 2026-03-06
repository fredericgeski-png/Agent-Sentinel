import React, { useState, useEffect, useCallback, memo } from 'react';
import type { Agent, Subscription } from '../types';
import { agentsApi, isAgentLimitError } from '../api';
import UpgradeDialog from './UpgradeDialog';
import AgentQuotaBar from './AgentQuotaBar';
import QuotaWarningBanner from './QuotaWarningBanner';

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let toastIdCounter = 0;

// ── AgentCard ─────────────────────────────────────────────────────────────────
interface AgentCardProps {
  agent: Agent;
  onDelete: (id: string) => void;
  deleting: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#00ff88',
  paused: '#ffc800',
  terminated: '#ff4466',
};

const AgentCard = memo(function AgentCard({ agent, onDelete, deleting }: AgentCardProps) {
  const entropy = Number(agent.entropy_score);
  const entropyColor = entropy > 0.7 ? '#ff4466' : entropy > 0.4 ? '#ffc800' : '#00ff88';

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 relative"
      style={{
        background: 'rgba(13,18,53,0.8)',
        border: '1px solid rgba(0,212,255,0.2)',
        transition: 'border-color 200ms',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.5)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.2)')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-semibold text-sm">{agent.name}</h3>
          <span className="text-xs text-gray-500 capitalize">{agent.framework}</span>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0"
          style={{
            background: `${STATUS_COLORS[agent.status] ?? '#94a3b8'}22`,
            color: STATUS_COLORS[agent.status] ?? '#94a3b8',
            border: `1px solid ${STATUS_COLORS[agent.status] ?? '#94a3b8'}55`,
          }}
        >
          {agent.status}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-gray-500">Entropy </span>
          <span style={{ color: entropyColor, fontWeight: 600 }}>{entropy.toFixed(2)}</span>
        </div>
        <div className="text-gray-600">·</div>
        <div className="text-gray-500">
          {new Date(agent.created_at).toLocaleDateString()}
        </div>
      </div>

      <button
        onClick={() => onDelete(agent.id)}
        disabled={deleting}
        aria-label={`Delete agent ${agent.name}`}
        className="self-end text-xs px-3 py-1 rounded"
        style={{
          background: 'rgba(255,68,102,0.1)',
          color: '#ff4466',
          border: '1px solid rgba(255,68,102,0.3)',
          cursor: deleting ? 'not-allowed' : 'pointer',
          opacity: deleting ? 0.5 : 1,
        }}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  );
});

// ── Add Agent Form ────────────────────────────────────────────────────────────
interface AddAgentFormProps {
  onSubmit: (name: string, framework: string) => Promise<void>;
  loading: boolean;
  disabled: boolean;
  subscription: Subscription | null;
}

const FRAMEWORKS = ['langchain', 'crewai', 'custom'];

const AddAgentForm = memo(function AddAgentForm({
  onSubmit,
  loading,
  disabled,
  subscription,
}: AddAgentFormProps) {
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('langchain');
  const [showForm, setShowForm] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    await onSubmit(name.trim(), framework);
    setName('');
    setShowForm(false);
  };

  const remaining = subscription?.agents_remaining;
  const tier = subscription?.tier ?? 'free';
  const limitReached = tier === 'free' && subscription !== null && (subscription.agents_remaining ?? 1) <= 0;

  const buttonLabel =
    tier === 'free' && subscription
      ? `+ Add Agent (${subscription.agent_count}/${subscription.agent_limit})`
      : '+ Add Agent';

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        disabled={limitReached}
        aria-label={limitReached ? 'Agent limit reached. Upgrade to add more.' : 'Add a new agent'}
        className="px-4 py-2 rounded-lg font-semibold text-sm"
        style={{
          background: limitReached ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg, #00d4ff, #0099cc)',
          color: limitReached ? '#94a3b8' : '#0a0e27',
          cursor: limitReached ? 'not-allowed' : 'pointer',
          border: limitReached ? '1px solid rgba(255,255,255,0.1)' : 'none',
        }}
      >
        {buttonLabel}
        {remaining === 0 && ' 🔒'}
      </button>
    );
  }

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{ background: 'rgba(13,18,53,0.9)', border: '1px solid #00d4ff' }}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handle()}
        placeholder="Agent name…"
        maxLength={255}
        aria-label="Agent name"
        className="rounded-lg px-3 py-2 text-sm text-white outline-none"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,212,255,0.3)' }}
        autoFocus
      />
      <select
        value={framework}
        onChange={(e) => setFramework(e.target.value)}
        aria-label="Agent framework"
        className="rounded-lg px-3 py-2 text-sm text-white outline-none"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,212,255,0.3)' }}
      >
        {FRAMEWORKS.map((f) => (
          <option key={f} value={f} style={{ background: '#0d1235' }}>{f}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handle}
          disabled={loading || !name.trim()}
          className="flex-1 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          style={{
            background: loading || !name.trim() ? 'rgba(0,212,255,0.3)' : 'linear-gradient(90deg, #00d4ff, #0099cc)',
            color: '#0a0e27',
            cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> Creating…</>
          ) : 'Create Agent'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-2 rounded-lg text-sm text-gray-400"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 animate-pulse"
      style={{ background: 'rgba(13,18,53,0.8)', border: '1px solid rgba(0,212,255,0.1)', minHeight: 120 }}
    >
      <div className="h-4 rounded" style={{ background: 'rgba(255,255,255,0.07)', width: '60%' }} />
      <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.05)', width: '40%' }} />
      <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '50%' }} />
    </div>
  );
}

// ── Main AgentList component ──────────────────────────────────────────────────
export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingAgent, setAddingAgent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [upgradeDialog, setUpgradeDialog] = useState<{
    open: boolean;
    count: number;
    limit: number;
    url?: string;
  }>({ open: false, count: 0, limit: 5 });

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentsApi.list();
      setAgents(data.agents);
      setSubscription(data.subscription);
    } catch {
      setError('Failed to load agents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleAddAgent = useCallback(async (name: string, framework: string) => {
    setAddingAgent(true);
    try {
      const resp = await agentsApi.create(name, framework);
      setAgents((prev) => [resp.agent, ...prev]);
      setSubscription((prev) =>
        prev
          ? {
              ...prev,
              agent_count: prev.agent_count + 1,
              agents_remaining: resp.agents_remaining,
              percentage_used:
                prev.agent_limit
                  ? parseFloat(((((prev.agent_count + 1) / prev.agent_limit) * 100)).toFixed(1))
                  : null,
            }
          : prev,
      );
      const msg =
        resp.agents_remaining !== null
          ? `Agent created (${resp.agents_remaining} remaining)`
          : 'Agent created';
      addToast('success', msg);
    } catch (err: unknown) {
      if (isAgentLimitError(err)) {
        setUpgradeDialog({
          open: true,
          count: err.current_count,
          limit: err.limit,
          url: err.upgrade_url,
        });
      } else {
        addToast('error', (err as Error).message || 'Failed to create agent');
      }
    } finally {
      setAddingAgent(false);
    }
  }, [addToast]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    setDeletingId(agentId);
    try {
      await agentsApi.delete(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      setSubscription((prev) =>
        prev
          ? {
              ...prev,
              agent_count: Math.max(0, prev.agent_count - 1),
              agents_remaining:
                prev.agents_remaining !== null ? prev.agents_remaining + 1 : null,
            }
          : prev,
      );
      addToast('success', 'Agent deleted');
    } catch {
      addToast('error', 'Failed to delete agent');
    } finally {
      setDeletingId(null);
    }
  }, [addToast]);

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: '#0a0e27', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-40 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="px-4 py-3 rounded-lg text-sm font-medium shadow-lg"
            style={{
              background: t.type === 'success' ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,102,0.15)',
              border: `1px solid ${t.type === 'success' ? '#00ff88' : '#ff4466'}`,
              color: t.type === 'success' ? '#00ff88' : '#ff4466',
              animation: 'slideIn 300ms ease',
            }}
          >
            {t.type === 'success' ? '✓' : '✗'} {t.message}
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {subscription && (
        <QuotaWarningBanner
          subscription={subscription}
          onUpgradeClick={() =>
            setUpgradeDialog({
              open: true,
              count: subscription.agent_count,
              limit: subscription.agent_limit ?? 5,
            })
          }
        />
      )}

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agents</h1>
          {subscription && (
            <div className="mt-1">
              <AgentQuotaBar subscription={subscription} />
            </div>
          )}
        </div>
        <AddAgentForm
          onSubmit={handleAddAgent}
          loading={addingAgent}
          disabled={false}
          subscription={subscription}
        />
      </div>

      {/* Error state */}
      {error && !loading && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid #ff4466', color: '#ff4466' }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={loadAgents}
            className="ml-auto text-xs px-3 py-1 rounded"
            style={{ background: '#ff4466', color: '#fff' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Agent grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : agents.length === 0
          ? (
            <div
              className="col-span-full rounded-xl p-12 text-center"
              style={{ border: '1px dashed rgba(0,212,255,0.3)', color: '#475569' }}
            >
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-gray-400">No agents yet. Create your first one above.</p>
            </div>
          )
          : agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={handleDeleteAgent}
              deleting={deletingId === agent.id}
            />
          ))}
      </div>

      {/* Upgrade dialog */}
      <UpgradeDialog
        isOpen={upgradeDialog.open}
        onClose={() => setUpgradeDialog((p) => ({ ...p, open: false }))}
        currentCount={upgradeDialog.count}
        limit={upgradeDialog.limit}
        tier="free"
        upgradeUrl={upgradeDialog.url}
      />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
