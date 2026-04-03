import type { Adapter } from "./index.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate";
const DEFAULT_MODEL = "llama3.2";

export class OllamaAdapter implements Adapter {
  private model: string;
  private url: string;

  constructor(model?: string, url?: string) {
    this.model = model ?? DEFAULT_MODEL;
    this.url = url ?? DEFAULT_OLLAMA_URL;
  }

  async complete(prompt: string): Promise<string> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}. Is Ollama running?`);
    }

    const data = await response.json() as { response: string };
    return data.response.trim();
  }
}
