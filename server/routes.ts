import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { calculateEntropyRequestSchema } from "@shared/schema";
import { z } from "zod";

function computeKineticEntropy(req: z.infer<typeof calculateEntropyRequestSchema>) {
  // Mock sophisticated kinetic entropy calculation
  // 1. Shannon entropy of messages
  const text = req.messages.map(m => m.content).join(" ");
  let shannon = 0;
  if (text.length > 0) {
    const charCounts: Record<string, number> = {};
    for (const char of text) charCounts[char] = (charCounts[char] || 0) + 1;
    for (const count of Object.values(charCounts)) {
      const p = count / text.length;
      shannon -= p * Math.log2(p);
    }
  }
  shannon = Math.min(shannon / 5, 1); // Normalize roughly 0-1

  // 2. Loop penalty: repetitive tools
  let loopPenalty = 0;
  if (req.toolCalls && req.toolCalls.length > 2) {
    const uniqueTools = new Set(req.toolCalls.map(t => t.name)).size;
    loopPenalty = 1 - (uniqueTools / req.toolCalls.length);
  }

  // 3. Tool variance
  let toolVariance = 0;
  if (req.toolCalls && req.toolCalls.length > 0) {
    const durations = req.toolCalls.map(t => t.durationMs);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / durations.length;
    toolVariance = Math.min(variance / 10000, 1); // Normalized
  }

  // 4. Drift (simulated)
  const drift = Math.random() * 0.2;

  // Total Entropy
  const entropyScore = Math.min(
    (shannon * 0.4) + (loopPenalty * 0.4) + (toolVariance * 0.1) + (drift * 0.1),
    1.0
  );

  return {
    entropyScore,
    breakdown: {
      shannon,
      loopPenalty,
      toolVariance,
      drift
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // POST /api/v1/calculate-entropy
  app.post(api.entropy.calculate.path, async (req, res) => {
    try {
      const input = api.entropy.calculate.input.parse(req.body);
      
      const { entropyScore, breakdown } = computeKineticEntropy(input);
      
      const killSwitch = await storage.getKillSwitchStatus();
      const killSwitchTriggered = killSwitch?.active || false;

      // Simulated wasted cost prevented
      const preventedWasteCost = entropyScore > 0.8 ? (entropyScore * 2.5) : 0;

      // Emit telemetry
      await storage.insertTelemetry({
        agentId: input.agentId,
        sessionId: input.sessionId,
        entropyScore,
        shannonEntropy: breakdown.shannon,
        loopPenalty: breakdown.loopPenalty,
        toolVariance: breakdown.toolVariance,
        drift: breakdown.drift,
        preventedWasteCost,
      });

      res.status(200).json({
        entropyScore,
        breakdown,
        killSwitchTriggered
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/v1/telemetry
  app.get(api.telemetry.list.path, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    
    const result = await storage.getTelemetry(page, limit);
    res.status(200).json(result);
  });

  // GET /api/v1/telemetry/stats
  app.get(api.telemetry.stats.path, async (req, res) => {
    const stats = await storage.getTelemetryStats();
    res.status(200).json(stats);
  });

  // GET /api/v1/kill-switch/status
  app.get(api.killSwitch.status.path, async (req, res) => {
    const status = await storage.getKillSwitchStatus();
    res.status(200).json({
      active: status?.active || false,
      reason: status?.reason || null,
      activatedAt: status?.activatedAt ? status.activatedAt.toISOString() : null,
    });
  });

  // POST /api/v1/kill-switch/activate
  app.post(api.killSwitch.activate.path, async (req, res) => {
    try {
      const { reason } = req.body || {};
      const status = await storage.activateKillSwitch(reason);
      
      // Notify webhooks
      const hooks = await storage.getWebhooksByEvent('kill_switch_activated');
      for (const hook of hooks) {
        fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'kill_switch_activated',
            reason: status.reason,
            activatedAt: status.activatedAt,
          })
        }).catch(err => console.error(`Webhook failure [${hook.url}]:`, err));
      }

      res.status(200).json({
        success: true,
        message: "Kill switch activated globally"
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to activate kill switch" });
    }
  });

  return httpServer;
}

// Optional: seed some example data for visual impact on first load
export async function seedDatabase() {
  const stats = await storage.getTelemetryStats();
  if (stats.activeSessions === 0) {
    // Generate some fake telemetry
    for (let i = 0; i < 20; i++) {
      const entropy = Math.random();
      await storage.insertTelemetry({
        agentId: `agent-${Math.floor(Math.random() * 5)}`,
        sessionId: `session-${Math.floor(Math.random() * 1000)}`,
        entropyScore: entropy,
        shannonEntropy: Math.random() * 0.5,
        loopPenalty: entropy > 0.5 ? Math.random() * 0.8 : 0,
        toolVariance: Math.random() * 0.2,
        drift: Math.random() * 0.1,
        preventedWasteCost: entropy > 0.7 ? (Math.random() * 5) : 0,
      });
    }
  }
}
