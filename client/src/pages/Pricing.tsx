import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Pricing() {
  const [agents, setAgents] = useState("5");
  const [frequency, setFrequency] = useState("daily");

  const calculateROI = () => {
    const agentCount = parseInt(agents) || 0;
    const freqMultiplier = {
      'daily': 20,
      'weekly': 5,
      'monthly': 1
    }[frequency] || 0;

    const loops = agentCount * freqMultiplier;
    const costPerLoop = 150; // Avg $150 per loop
    const totalWaste = loops * costPerLoop;
    const proPrice = 299;
    
    const savings = totalWaste - proPrice;
    const roi = proPrice > 0 ? (savings / proPrice) * 100 : 0;

    return {
      totalWaste,
      savings,
      roi: roi.toFixed(0)
    };
  };

  const { totalWaste, savings, roi } = calculateROI();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            Kinetic Pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Scale your agentic infrastructure with confidence. 
            Stop the loop waste before it drains your budget.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="relative overflow-hidden border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {[
                  "5 agents",
                  "Basic dashboard",
                  "Email support",
                  "Standard entropy engine"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="relative overflow-hidden border-primary/50 bg-card/50 backdrop-blur-sm ring-1 ring-primary/20">
            <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-bl-lg">
              RECOMMENDED
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold">$299</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {[
                  "Unlimited agents",
                  "Advanced analytics",
                  "Priority support",
                  "Webhook integrations",
                  "Custom kill-switch rules",
                  "Early access to features"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => window.location.href = "https://fredericgeski.selar.com/727l48e1z1"}
              >
                Upgrade to Pro
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ROI Calculator */}
        <Card className="max-w-4xl mx-auto border-border bg-card/30">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              ROI Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agents">Number of Agents</Label>
                  <Input 
                    id="agents" 
                    type="number" 
                    value={agents} 
                    onChange={(e) => setAgents(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Loop Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Loops</SelectItem>
                      <SelectItem value="weekly">Weekly Loops</SelectItem>
                      <SelectItem value="monthly">Monthly Loops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-lg p-6 border border-primary/10 flex flex-col justify-center space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Average Monthly Waste</p>
                  <p className="text-3xl font-bold text-destructive">${totalWaste.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">With Kinetic</p>
                    <p className="text-xl font-bold text-primary">$299</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Monthly Savings</p>
                    <p className="text-xl font-bold text-success">${savings.toLocaleString()}</p>
                  </div>
                </div>
                <div className="pt-2 text-center">
                  <p className="text-2xl font-black text-primary">ROI: {roi}%</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-lg font-semibold mb-4 text-center">ROI Comparison</h3>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <tr>
                      <th className="px-4 py-3">Company Size</th>
                      <th className="px-4 py-3">Agents</th>
                      <th className="px-4 py-3">Loops/Month</th>
                      <th className="px-4 py-3">Waste/Month</th>
                      <th className="px-4 py-3">Savings/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { size: "Startup", agents: 5, loops: 10, waste: 1500, savings: 1201 },
                      { size: "Scale-up", agents: 20, loops: 40, waste: 6000, savings: 5701 },
                      { size: "Enterprise", agents: 100, loops: 200, waste: 30000, savings: 29701 }
                    ].map((row) => (
                      <tr key={row.size} className="border-b border-border/50">
                        <td className="px-4 py-3 font-medium">{row.size}</td>
                        <td className="px-4 py-3">{row.agents}</td>
                        <td className="px-4 py-3">{row.loops}</td>
                        <td className="px-4 py-3 text-destructive">${row.waste.toLocaleString()}</td>
                        <td className="px-4 py-3 text-success font-bold">${row.savings.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-center text-sm font-medium text-primary">
                "Even if you have just 5 agents, Kinetic pays for itself in 4 days"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
