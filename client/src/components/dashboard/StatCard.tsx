import { ReactNode } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  delay?: number;
  highlightColor?: "primary" | "success" | "warning" | "destructive";
}

export default function StatCard({ title, value, icon, subtitle, delay = 0, highlightColor = "primary" }: StatCardProps) {
  
  const colorMap = {
    primary: "from-primary/20 border-primary/30 text-primary",
    success: "from-success/20 border-success/30 text-success",
    warning: "from-warning/20 border-warning/30 text-warning",
    destructive: "from-destructive/20 border-destructive/30 text-destructive",
  };

  const bgStyle = colorMap[highlightColor].split(' ')[0];
  const borderStyle = colorMap[highlightColor].split(' ')[1];
  const textStyle = colorMap[highlightColor].split(' ')[2];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative overflow-hidden glass-card rounded-xl p-6 border-t-2 ${borderStyle} group hover:bg-white/[0.03] transition-colors`}
    >
      <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${bgStyle} to-transparent opacity-20 pointer-events-none`} />
      
      <div className="relative z-10 flex justify-between items-start mb-4">
        <h3 className="font-mono text-sm text-muted-foreground uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg bg-background/50 border border-white/5 ${textStyle} shadow-[0_0_10px_currentColor]`}>
          {icon}
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="font-display text-4xl font-bold text-foreground">
          {value}
        </div>
        {subtitle && (
          <div className="mt-2 text-xs font-mono text-muted-foreground opacity-80">
            {subtitle}
          </div>
        )}
      </div>
    </motion.div>
  );
}
