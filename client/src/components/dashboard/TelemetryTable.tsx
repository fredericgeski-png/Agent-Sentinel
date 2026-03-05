import { useTelemetryList } from "@/hooks/use-monitor";
import { format } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TelemetryTable({ limit = 5 }: { limit?: number }) {
  const { data, isLoading, isError } = useTelemetryList(1, limit);

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
        <p className="font-mono text-sm">Failed to load telemetry data</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-white/5 bg-white/[0.02]">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          LIVE TELEMETRY FEED
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs font-mono text-muted-foreground uppercase bg-black/20">
            <tr>
              <th className="px-6 py-4 border-b border-white/5">Time</th>
              <th className="px-6 py-4 border-b border-white/5">Agent ID</th>
              <th className="px-6 py-4 border-b border-white/5">Session</th>
              <th className="px-6 py-4 border-b border-white/5">Entropy</th>
              <th className="px-6 py-4 border-b border-white/5 text-right">Saved ($)</th>
            </tr>
          </thead>
          <tbody className="font-mono divide-y divide-white/5">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No telemetry events recorded yet.
                </td>
              </tr>
            ) : (
              data.items.map((item, i) => {
                const isHigh = item.entropyScore > 0.7;
                const isWarn = item.entropyScore > 0.3 && item.entropyScore <= 0.7;
                
                return (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id} 
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(item.createdAt), "HH:mm:ss.SSS")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-foreground">
                      {item.agentId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs">
                      {item.sessionId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isHigh ? (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        ) : isWarn ? (
                          <Activity className="w-4 h-4 text-warning" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        )}
                        <span className={`font-bold ${isHigh ? 'text-destructive' : isWarn ? 'text-warning' : 'text-success'}`}>
                          {item.entropyScore.toFixed(3)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-success font-bold">
                      ${item.preventedWasteCost.toFixed(2)}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
