import { z } from "zod";

export const AI_SYSTEMS = ["claude-code"] as const;
export const WORKLOAD_TYPES = [
  "research",
  "content",
  "data-processing",
  "custom",
] as const;
export const PARALLEL_AGENTS = ["single", "small-team", "production"] as const;
export const QUALITY_LEVELS = ["solo", "team", "production"] as const;

export const ClawstrapConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  createdAt: z.string(),
  workspaceName: z.string().min(1),
  targetDirectory: z.string().min(1).default("."),
  aiSystem: z.enum(AI_SYSTEMS).default("claude-code"),
  workloadType: z.enum(WORKLOAD_TYPES),
  parallelAgents: z.enum(PARALLEL_AGENTS),
  qualityLevel: z.enum(QUALITY_LEVELS),
  sessionHandoff: z.boolean(),
});

export type ClawstrapConfig = z.infer<typeof ClawstrapConfigSchema>;
export type AiSystem = (typeof AI_SYSTEMS)[number];
export type WorkloadType = (typeof WORKLOAD_TYPES)[number];
export type ParallelAgents = (typeof PARALLEL_AGENTS)[number];
export type QualityLevel = (typeof QUALITY_LEVELS)[number];
