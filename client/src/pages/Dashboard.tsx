import AppLayout from "@/components/layout/AppLayout";
import EntropyGauge from "@/components/dashboard/EntropyGauge";
import StatCard from "@/components/dashboard/StatCard";
import KillSwitchButton from "@/components/dashboard/KillSwitchButton";
import AgentChart from "@/components/dashboard/AgentChart";
import TelemetryTable from "@/components/dashboard/TelemetryTable";
import { useTelemetryStats } from "@/hooks/use-monitor";
import { DollarSign, Cpu, Gauge, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useTelemetryStats();
  const [, setLocation] = useLocation();

  const defaultStats = {
    totalWastePrevented: 0,
    activeSessions: 0,
    averageEntropy: 0
  };

  const currentStats = stats || defaultStats;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto text-foreground">
        
        {/* Header with Upgrade */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button 
            onClick={() => setLocation("/pricing")}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10 gap-2"
          >
            <Zap className="w-4 h-4 fill-current" />
            Upgrade to Pro
          </Button>
        </div>
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Gauge & Kill Switch */}
          <div className="col-span-1 flex flex-col gap-6">
            <EntropyGauge value={isLoading ? 0 : currentStats.averageEntropy} />
            <div className="flex-1">
              <KillSwitchButton />
            </div>
          </div>

          {/* Right Column: Stats & Chart */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatCard 
                title="Waste Prevented" 
                value={`$${currentStats.totalWastePrevented.toFixed(2)}`}
                icon={<DollarSign className="w-5 h-5" />}
                highlightColor="success"
                delay={0.1}
              />
              <StatCard 
                title="Active Sessions" 
                value={currentStats.activeSessions}
                icon={<Cpu className="w-5 h-5" />}
                highlightColor="primary"
                delay={0.2}
              />
              <StatCard 
                title="Avg System Entropy" 
                value={currentStats.averageEntropy.toFixed(3)}
                icon={<Gauge className="w-5 h-5" />}
                highlightColor={currentStats.averageEntropy > 0.7 ? "destructive" : currentStats.averageEntropy > 0.3 ? "warning" : "success"}
                delay={0.3}
              />
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-[300px]">
              <AgentChart />
            </div>

          </div>
        </div>

        {/* Bottom Section: Feed */}
        <div className="w-full">
          <TelemetryTable limit={5} />
        </div>

      </div>
    </AppLayout>
  );
}
