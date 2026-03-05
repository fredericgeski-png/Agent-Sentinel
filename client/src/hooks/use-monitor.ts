import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api, buildUrl } from "@shared/routes";
import { type CalculateEntropyRequest } from "@shared/schema";

// Zod error logger helper
function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useTelemetryStats() {
  return useQuery({
    queryKey: [api.telemetry.stats.path],
    queryFn: async () => {
      const res = await fetch(api.telemetry.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch telemetry stats");
      const data = await res.json();
      return parseWithLogging(api.telemetry.stats.responses[200], data, "telemetry.stats");
    },
    refetchInterval: 2000,
  });
}

export function useKillSwitchStatus() {
  return useQuery({
    queryKey: [api.killSwitch.status.path],
    queryFn: async () => {
      const res = await fetch(api.killSwitch.status.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch kill switch status");
      const data = await res.json();
      return parseWithLogging(api.killSwitch.status.responses[200], data, "killSwitch.status");
    },
    refetchInterval: 2000,
  });
}

export function useTelemetryList(page = 1, limit = 15) {
  return useQuery({
    queryKey: [api.telemetry.list.path, page, limit],
    queryFn: async () => {
      const url = buildUrl(api.telemetry.list.path);
      const res = await fetch(`${url}?page=${page}&limit=${limit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch telemetry list");
      const data = await res.json();
      return parseWithLogging(api.telemetry.list.responses[200], data, "telemetry.list");
    },
    refetchInterval: 5000, // Poll every 5s
  });
}

export function useActivateKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => {
      const res = await fetch(api.killSwitch.activate.path, {
        method: api.killSwitch.activate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to activate kill switch");
      return parseWithLogging(api.killSwitch.activate.responses[200], await res.json(), "killSwitch.activate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.killSwitch.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.telemetry.stats.path] });
    },
  });
}

export function useCalculateEntropy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CalculateEntropyRequest) => {
      const validated = api.entropy.calculate.input.parse(data);
      const res = await fetch(api.entropy.calculate.path, {
        method: api.entropy.calculate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.entropy.calculate.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to calculate entropy");
      }
      return parseWithLogging(api.entropy.calculate.responses[200], await res.json(), "entropy.calculate");
    },
    onSuccess: () => {
      // Force refresh of stats and list after a simulation
      queryClient.invalidateQueries({ queryKey: [api.telemetry.stats.path] });
      queryClient.invalidateQueries({ queryKey: [api.telemetry.list.path] });
    }
  });
}
