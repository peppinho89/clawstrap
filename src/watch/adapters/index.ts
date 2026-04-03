import type { ClawstrapConfig } from "../../schema.js";
import { ClaudeLocalAdapter } from "./claude-local.js";
import { ClaudeApiAdapter } from "./claude-api.js";
import { OllamaAdapter } from "./ollama.js";
import { CodexLocalAdapter } from "./codex-local.js";

export interface Adapter {
  /** Send a prompt, return the response text. Throws on failure. */
  complete(prompt: string): Promise<string>;
}

export type AdapterType = "claude-local" | "claude-api" | "ollama" | "codex-local";

// Local type augmentation for the watch field not yet in schema.ts
type ClawstrapConfigWithWatch = ClawstrapConfig & {
  watch?: { adapter?: AdapterType };
};

export function createAdapter(config: ClawstrapConfigWithWatch): Adapter {
  const type = config.watch?.adapter ?? "claude-local";
  switch (type) {
    case "claude-local":  return new ClaudeLocalAdapter();
    case "claude-api":    return new ClaudeApiAdapter();
    case "ollama":        return new OllamaAdapter();
    case "codex-local":   return new CodexLocalAdapter();
    default:              return new ClaudeLocalAdapter();
  }
}
