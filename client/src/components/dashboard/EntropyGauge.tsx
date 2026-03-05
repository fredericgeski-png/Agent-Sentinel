import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface EntropyGaugeProps {
  value: number; // 0 to 1
  label?: string;
}

export default function EntropyGauge({ value, label = "SYSTEM ENTROPY" }: EntropyGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    // Small delay to allow initial animation
    const t = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(t);
  }, [value]);

  const getColor = (v: number) => {
    if (v < 0.3) return "hsl(var(--success))";
    if (v < 0.7) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const color = getColor(animatedValue);
  
  // SVG Arc Math
  const radius = 100;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Use 270 degrees of the circle (0.75)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = circumference - (animatedValue * arcLength);

  return (
    <div className="relative flex flex-col items-center justify-center p-6 glass-card rounded-2xl w-full aspect-square max-w-sm mx-auto">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 rounded-2xl pointer-events-none" />
      
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform rotate-[135deg] drop-shadow-2xl"
      >
        {/* Background track */}
        <circle
          stroke="rgba(255,255,255,0.05)"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          style={{ strokeLinecap: "round" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        
        {/* Animated value track */}
        <motion.circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeLinecap: "round" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="drop-shadow-[0_0_12px_currentColor]"
        />
        
        {/* Ticks/Markers */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = -135 + (i * (270 / 19));
          const rad = (angle * Math.PI) / 180;
          const innerR = normalizedRadius - 15;
          const outerR = normalizedRadius - 5;
          const x1 = radius + innerR * Math.cos(rad);
          const y1 = radius + innerR * Math.sin(rad);
          const x2 = radius + outerR * Math.cos(rad);
          const y2 = radius + outerR * Math.sin(rad);
          return (
            <line 
              key={i} x1={x1} y1={y1} x2={x2} y2={y2} 
              stroke="rgba(255,255,255,0.1)" strokeWidth="2" 
              className="transform -rotate-[135deg] origin-center"
            />
          );
        })}
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-8">
        <motion.div 
          className="text-5xl font-display font-bold tracking-tighter"
          style={{ color, textShadow: `0 0 20px ${color}` }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {animatedValue.toFixed(3)}
        </motion.div>
        <div className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-widest">{label}</div>
      </div>
    </div>
  );
}
