import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { workspaceRoutes } from "./routes/workspace.js";
import { agentsRoutes } from "./routes/agents.js";
import { skillsRoutes } from "./routes/skills.js";
import { projectsRoutes } from "./routes/projects.js";
import { governanceRoutes } from "./routes/governance.js";
import { healthRoutes } from "./routes/health.js";
import { exportRoutes } from "./routes/export.js";
import { eventsRoutes } from "./routes/events.js";

export function createApp(rootDir: string) {
  const app = new Hono<{ Variables: { rootDir: string } }>();

  // CORS — allow React dev server
  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
  );

  // Inject rootDir into every request context
  app.use("*", async (c, next) => {
    c.set("rootDir", rootDir);
    await next();
  });

  // Mount route groups
  app.route("/", workspaceRoutes);
  app.route("/", agentsRoutes);
  app.route("/", skillsRoutes);
  app.route("/", projectsRoutes);
  app.route("/", governanceRoutes);
  app.route("/", healthRoutes);
  app.route("/", exportRoutes);
  app.route("/", eventsRoutes);

  // Static files (production build of React app)
  const uiDist = path.join(
    new URL(".", import.meta.url).pathname,
    "..",
    "ui",
    "dist"
  );
  app.use("/*", serveStatic({ root: uiDist }));
  app.get("*", serveStatic({ root: uiDist, path: "index.html" }));

  return app;
}

export function startServer(port: number, rootDir: string) {
  const resolvedRoot = path.resolve(rootDir);
  const app = createApp(resolvedRoot);

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`  API:       http://localhost:${port}`);
  console.log(`  Workspace: ${resolvedRoot}\n`);

  return app;
}

// Direct execution (npm run dev in dashboard/)
const isDirectRun = process.argv[1]?.endsWith("api/index.ts") || process.argv[1]?.endsWith("api/index.js");
if (isDirectRun) {
  const rootDir = path.resolve(process.env.CLAWSTRAP_ROOT ?? process.cwd());
  const port = Number(process.env.PORT) || 4200;
  startServer(port, rootDir);
}
