import { db } from "./db";
import {
  telemetry,
  killSwitches,
  type Telemetry,
  type InsertTelemetry,
  type KillSwitch,
  type InsertKillSwitch,
  type PaginatedTelemetryResponse
} from "@shared/schema";
import { desc, eq, count, sql } from "drizzle-orm";

export interface IStorage {
  // Telemetry
  insertTelemetry(data: InsertTelemetry): Promise<Telemetry>;
  getTelemetry(page?: number, limit?: number): Promise<PaginatedTelemetryResponse>;
  getTelemetryStats(): Promise<{ totalWastePrevented: number; activeSessions: number; averageEntropy: number }>;
  
  // Kill Switch
  getKillSwitchStatus(): Promise<KillSwitch | undefined>;
  activateKillSwitch(reason?: string): Promise<KillSwitch>;
}

export class DatabaseStorage implements IStorage {
  async insertTelemetry(data: InsertTelemetry): Promise<Telemetry> {
    const [inserted] = await db.insert(telemetry).values(data).returning();
    return inserted;
  }

  async getTelemetry(page: number = 1, limit: number = 50): Promise<PaginatedTelemetryResponse> {
    const offset = (page - 1) * limit;
    
    const items = await db.select()
      .from(telemetry)
      .orderBy(desc(telemetry.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await db.select({ value: count() }).from(telemetry);

    return {
      items,
      total: totalCount.value
    };
  }

  async getTelemetryStats(): Promise<{ totalWastePrevented: number; activeSessions: number; averageEntropy: number }> {
    const [stats] = await db.select({
      totalWastePrevented: sql<number>`COALESCE(SUM(${telemetry.preventedWasteCost}), 0)`,
      activeSessions: count(sql`DISTINCT ${telemetry.sessionId}`),
      averageEntropy: sql<number>`COALESCE(AVG(${telemetry.entropyScore}), 0)`
    }).from(telemetry);

    return {
      totalWastePrevented: Number(stats.totalWastePrevented) || 0,
      activeSessions: Number(stats.activeSessions) || 0,
      averageEntropy: Number(stats.averageEntropy) || 0,
    };
  }

  async getKillSwitchStatus(): Promise<KillSwitch | undefined> {
    const [status] = await db.select()
      .from(killSwitches)
      .orderBy(desc(killSwitches.activatedAt))
      .limit(1);
    
    return status;
  }

  async activateKillSwitch(reason?: string): Promise<KillSwitch> {
    const [activated] = await db.insert(killSwitches).values({
      active: true,
      reason: reason || "Manual trigger via Dashboard",
    }).returning();
    return activated;
  }
}

export const storage = new DatabaseStorage();