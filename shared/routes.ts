import { z } from "zod";
import { 
  insertTelemetrySchema, 
  telemetry, 
  killSwitches, 
  calculateEntropyRequestSchema 
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  entropy: {
    calculate: {
      method: 'POST' as const,
      path: '/api/v1/calculate-entropy' as const,
      input: calculateEntropyRequestSchema,
      responses: {
        200: z.object({
          entropyScore: z.number(),
          breakdown: z.object({
            shannon: z.number(),
            loopPenalty: z.number(),
            toolVariance: z.number(),
            drift: z.number(),
          }),
          killSwitchTriggered: z.boolean(),
        }),
        400: errorSchemas.validation,
      },
    },
  },
  killSwitch: {
    activate: {
      method: 'POST' as const,
      path: '/api/v1/kill-switch/activate' as const,
      input: z.object({ reason: z.string().optional() }),
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/v1/kill-switch/status' as const,
      responses: {
        200: z.object({
          active: z.boolean(),
          reason: z.string().nullable(),
          activatedAt: z.string().nullable(),
        }),
      },
    }
  },
  telemetry: {
    list: {
      method: 'GET' as const,
      path: '/api/v1/telemetry' as const,
      input: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      }).optional(),
      responses: {
        200: z.object({
          items: z.array(z.custom<typeof telemetry.$inferSelect>()),
          total: z.number(),
        }),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/v1/telemetry/stats' as const,
      responses: {
        200: z.object({
          totalWastePrevented: z.number(),
          activeSessions: z.number(),
          averageEntropy: z.number(),
        }),
      }
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
