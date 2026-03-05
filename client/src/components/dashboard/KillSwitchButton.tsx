import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, AlertOctagon, X, CheckCircle2 } from "lucide-react";
import { useActivateKillSwitch } from "@/hooks/use-monitor";

export default function KillSwitchButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { mutate: activate, isPending, isSuccess } = useActivateKillSwitch();

  const handleActivate = () => {
    activate(reason || "MANUAL_OPERATOR_OVERRIDE", {
      onSuccess: () => {
        setTimeout(() => setIsOpen(false), 2000);
      }
    });
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className="w-full h-full min-h-[160px] rounded-2xl neon-border-red bg-destructive/10 hover:bg-destructive/20 transition-all flex flex-col items-center justify-center gap-4 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 group-hover:opacity-40 transition-opacity"></div>
        <ShieldAlert className="w-12 h-12 text-destructive drop-shadow-[0_0_15px_rgba(255,0,60,0.8)] group-hover:scale-110 transition-transform" />
        <span className="font-display text-2xl font-bold text-destructive tracking-widest neon-text-red">KILL ALL</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg glass-card border border-destructive/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(255,0,60,0.2)]"
            >
              <div className="p-6 border-b border-destructive/20 bg-destructive/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertOctagon className="w-6 h-6 text-destructive animate-pulse" />
                  <h2 className="font-display text-xl font-bold text-destructive">CONFIRM GLOBAL KILL SWITCH</h2>
                </div>
                <button 
                  onClick={() => !isPending && setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  disabled={isPending}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {isSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <CheckCircle2 className="w-16 h-16 text-destructive mb-4 drop-shadow-[0_0_10px_rgba(255,0,60,0.8)]" />
                    <h3 className="text-xl font-display font-bold text-foreground">KILL SWITCH ENGAGED</h3>
                    <p className="text-muted-foreground font-mono text-sm mt-2">All kinetic agents have been terminated.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="font-mono text-sm text-destructive/90 leading-relaxed">
                        WARNING: This action will immediately terminate all active agent sessions, block further API access, and notify configured webhooks. This action cannot be undone automatically.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Reason (Optional)</label>
                      <input 
                        type="text" 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Runaway loop detected in Production"
                        className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl font-mono text-sm focus:outline-none focus:border-destructive focus:ring-1 focus:ring-destructive transition-all"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setIsOpen(false)}
                        className="flex-1 py-3 rounded-xl font-mono font-semibold bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        CANCEL
                      </button>
                      <button 
                        onClick={handleActivate}
                        disabled={isPending}
                        className="flex-1 py-3 rounded-xl font-display font-bold text-lg bg-destructive hover:bg-destructive/90 text-white shadow-[0_0_20px_rgba(255,0,60,0.4)] hover:shadow-[0_0_30px_rgba(255,0,60,0.6)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isPending ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ENGAGING...
                          </>
                        ) : (
                          "ENGAGE KILL SWITCH"
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
