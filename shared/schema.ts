import { pgTable, text, serial, integer, boolean, timestamp, numeric, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const telemetry = pgTable("telemetry", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  sessionId: text("session_id").notNull(),
  entropyScore: doublePrecision("entropy_score").notNull(),
  shannonEntropy: doublePrecision("shannon_entropy").notNull(),
  loopPenalty: doublePrecision("loop_penalty").notNull(),
  toolVariance: doublePrecision("tool_variance").notNull(),
  drift: doublePrecision("drift").notNull(),
  preventedWasteCost: doublePrecision("prevented_waste_cost").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const killSwitches = pgTable("kill_switches", {
  id: serial("id").primaryKey(),
  active: boolean("active").default(false).notNull(),
  reason: text("reason"),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  event: text("event").notNull(), // 'kill_switch_activated'
  secret: text("secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTelemetrySchema = createInsertSchema(telemetry).omit({ id: true, createdAt: true });
export const insertKillSwitchSchema = createInsertSchema(killSwitches).omit({ id: true, activatedAt: true });
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ id: true, createdAt: true });

export type Telemetry = typeof telemetry.$inferSelect;
export type InsertTelemetry = z.infer<typeof insertTelemetrySchema>;

export type KillSwitch = typeof killSwitches.$inferSelect;
export type InsertKillSwitch = z.infer<typeof insertKillSwitchSchema>;

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

// API request types
export const calculateEntropyRequestSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "tool", "system"]),
    content: z.string()
  })),
  toolCalls: z.array(z.object({
    name: z.string(),
    durationMs: z.number()
  })).optional()
});

export type CalculateEntropyRequest = z.infer<typeof calculateEntropyRequestSchema>;

export type CalculateEntropyResponse = {
  entropyScore: number;
  breakdown: {
    shannon: number;
    loopPenalty: number;
    toolVariance: number;
    drift: number;
  };
  killSwitchTriggered: boolean;
};

export type TelemetryQueryParams = {
  page?: string;
  limit?: string;
};

export type PaginatedTelemetryResponse = {
  items: Telemetry[];
  total: number;
};
