import { execSync } from "node:child_process";
import type { Adapter } from "./index.js";

export class CodexLocalAdapter implements Adapter {
  async complete(prompt: string): Promise<string> {
    const escaped = prompt.replace(/'/g, "'\\''");
    try {
      const result = execSync(`codex '${escaped}'`, {
        encoding: "utf-8",
        timeout: 60_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return result.trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ENOENT")) {
        throw new Error("Codex CLI not found. Install it or use a different adapter.");
      }
      throw err;
    }
  }
}
