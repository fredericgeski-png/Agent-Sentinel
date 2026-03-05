import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

// Mock data generation for the chart since the API returns flat stats
// In a real scenario, the backend would return grouped stats per agent.
const mockAgentData = [
  { name: 'Research_Ag_01', entropy: 0.25 },
  { name: 'Data_Scrape_04', entropy: 0.65 },
  { name: 'QA_Bot_99', entropy: 0.12 },
  { name: 'Code_Gen_Beta', entropy: 0.85 },
  { name: 'Support_AI', entropy: 0.42 },
];

export default function AgentChart() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card rounded-2xl p-6 h-full min-h-[300px] flex flex-col"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">AGENT ENTROPY DISTRIBUTION</h3>
          <p className="font-mono text-xs text-muted-foreground mt-1">Real-time kinetic variance per active agent</p>
        </div>
      </div>
      
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockAgentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} 
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 1]}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ 
                backgroundColor: 'rgba(10, 14, 23, 0.9)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontFamily: 'IBM Plex Mono',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="entropy" radius={[4, 4, 0, 0]}>
              {mockAgentData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={
                    entry.entropy > 0.7 ? 'hsl(var(--destructive))' : 
                    entry.entropy > 0.3 ? 'hsl(var(--warning))' : 
                    'hsl(var(--success))'
                  } 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
