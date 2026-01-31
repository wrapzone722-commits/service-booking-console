import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
// В production всегда 8080 — так ожидает Dockerfile и платформы (Timeweb). Игнорируем PORT извне.
const port =
  process.env.NODE_ENV === "production"
    ? 8080
    : Number(process.env.PORT || 8080);

// In production, serve the built SPA files (path from CWD so Docker/Node resolve correctly)
const distPath = path.join(process.cwd(), "dist", "spa");

// Serve static files (index.html, JS, CSS, assets)
app.use(express.static(distPath, { index: "index.html" }));

// Handle React Router - serve index.html for all non-API routes
// path-to-regexp v8 (Express 5) rejects "*" and "/(.*)"; use RegExp to match any path
app.get(/.*/, (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

// Слушать на 0.0.0.0, чтобы контейнер принимал запросы снаружи (Timeweb, Docker)
app.listen(Number(port), "0.0.0.0", () => {
  console.log(`🚀 Fusion Starter server running on port ${port} (PORT from env: ${process.env.PORT ? "yes" : "default 8080"})`);
  console.log(`📱 SPA: ${distPath}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
