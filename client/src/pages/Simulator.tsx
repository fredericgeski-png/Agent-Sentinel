import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useCalculateEntropy } from "@/hooks/use-monitor";
import { TerminalSquare, Send, Activity } from "lucide-react";
import { motion } from "framer-motion";

const DEFAULT_MESSAGES = `[
  {
    "role": "system",
    "content": "You are a helpful data processing agent."
  },
  {
    "role": "user",
    "content": "Begin loop extraction on dataset X."
  }
]`;

export default function Simulator() {
  const [agentId, setAgentId] = useState("SIM_AGENT_01");
  const [sessionId, setSessionId] = useState(`sess_${Math.random().toString(36).substr(2, 9)}`);
  const [messagesJson, setMessagesJson] = useState(DEFAULT_MESSAGES);
  const [jsonError, setJsonError] = useState("");

  const { mutate: calculate, isPending, data: result, error } = useCalculateEntropy();

  const handleSimulate = () => {
    setJsonError("");
    try {
      const parsedMessages = JSON.parse(messagesJson);
      if (!Array.isArray(parsedMessages)) throw new Error("Messages must be an array");
      
      calculate({
        agentId,
        sessionId,
        messages: parsedMessages,
      });
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON format");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Input Form */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card rounded-2xl p-8 border-t-2 border-primary/30"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <TerminalSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">PAYLOAD INJECTOR</h2>
              <p className="font-mono text-xs text-muted-foreground">Simulate agent context for entropy scoring</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground uppercase">Agent ID</label>
                <input 
                  type="text" 
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground uppercase">Session ID</label>
                <input 
                  type="text" 
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="font-mono text-xs text-muted-foreground uppercase">Message Context (JSON)</label>
                {jsonError && <span className="font-mono text-xs text-destructive">{jsonError}</span>}
              </div>
              <textarea 
                value={messagesJson}
                onChange={e => setMessagesJson(e.target.value)}
                rows={12}
                className={`w-full bg-black/40 border ${jsonError ? 'border-destructive' : 'border-white/10'} rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none`}
              />
            </div>

            <button 
              onClick={handleSimulate}
              disabled={isPending}
              className="w-full py-4 rounded-xl font-display font-bold text-lg bg-primary text-primary-foreground shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  INJECT PAYLOAD
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-mono text-sm">
                Error: {error.message}
              </div>
            )}
          </div>
        </motion.div>

        {/* Results Panel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card rounded-2xl p-8 border-t-2 border-accent/30"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">ANALYSIS RESULT</h2>
              <p className="font-mono text-xs text-muted-foreground">Computed kinetic variance and drift</p>
            </div>
          </div>

          {!result ? (
            <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl">
              <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest text-center px-8">
                Awaiting payload injection<br/>to begin analysis
              </p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="p-8 rounded-xl bg-black/40 border border-white/10 text-center relative overflow-hidden">
                {result.killSwitchTriggered && (
                  <div className="absolute top-0 left-0 right-0 py-1 bg-destructive text-white font-mono text-xs font-bold uppercase animate-pulse">
                    KILL SWITCH TRIGGERED
                  </div>
                )}
                
                <h3 className="font-mono text-sm text-muted-foreground uppercase mb-2">Final Entropy Score</h3>
                <div className={`font-display text-6xl font-bold ${
                  result.entropyScore > 0.7 ? 'text-destructive neon-text-red' : 
                  result.entropyScore > 0.3 ? 'text-warning' : 'text-success neon-text-cyan'
                }`}>
                  {result.entropyScore.toFixed(4)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Shannon Entropy", val: result.breakdown.shannon },
                  { label: "Loop Penalty", val: result.breakdown.loopPenalty },
                  { label: "Tool Variance", val: result.breakdown.toolVariance },
                  { label: "Context Drift", val: result.breakdown.drift }
                ].map(metric => (
                  <div key={metric.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="font-mono text-xs text-muted-foreground uppercase mb-1">{metric.label}</div>
                    <div className="font-mono text-lg text-foreground font-bold">{metric.val.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </motion.div>

      </div>
    </AppLayout>
  );
}
