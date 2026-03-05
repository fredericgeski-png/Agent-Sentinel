import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, ShieldAlert, Cpu, TerminalSquare, Server, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useKillSwitchStatus } from "@/hooks/use-monitor";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: ksStatus } = useKillSwitchStatus();

  const navItems = [
    { path: "/", label: "Dashboard", icon: <Activity className="w-5 h-5" /> },
    { path: "/feed", label: "Live Feed", icon: <Server className="w-5 h-5" /> },
    { path: "/simulator", label: "Simulator", icon: <TerminalSquare className="w-5 h-5" /> },
  ];

  const isKilled = ksStatus?.active;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background cyber-grid">
      {/* Sidebar */}
      <aside className="w-64 glass-panel flex flex-col z-20">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="relative">
            <Cpu className="w-8 h-8 text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight neon-text-cyan">KINETIC</h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Integrity Monitor</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} className="block group">
                <div className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-sm transition-all duration-300
                  ${isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_10px_rgba(0,243,255,0.1)]' 
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}
                `}>
                  <span className={isActive ? 'neon-text-cyan' : ''}>{item.icon}</span>
                  {item.label}
                  {isActive && (
                    <motion.div 
                      layoutId="activeTab" 
                      className="absolute left-0 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_8px_rgba(0,243,255,0.8)]"
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="p-4 rounded-lg bg-black/40 border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className={`w-4 h-4 ${isKilled ? 'text-destructive' : 'text-success'}`} />
              <span className="font-mono text-xs uppercase text-muted-foreground">System Status</span>
            </div>
            <div className={`font-display text-lg font-bold ${isKilled ? 'text-destructive neon-text-red animate-pulse' : 'text-success'}`}>
              {isKilled ? 'LOCKED DOWN' : 'OPERATIONAL'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <header className="h-16 border-b border-white/5 bg-background/80 backdrop-blur-md flex items-center justify-between px-8 z-20">
          <h2 className="font-display text-xl text-foreground capitalize">
            {navItems.find(i => i.path === location)?.label || 'Overview'}
          </h2>
          
          <div className="flex items-center gap-4">
            {isKilled && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive text-sm font-mono font-bold animate-pulse">
                <AlertTriangle className="w-4 h-4" />
                KILL SWITCH ENGAGED
              </div>
            )}
            <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,102,0.8)] animate-pulse"></div>
            <span className="font-mono text-xs text-muted-foreground">Live Telemetry Connected</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 scan-line">
          {children}
        </div>
      </main>
    </div>
  );
}
