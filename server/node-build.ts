import path from "path";
import fs from "fs";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
// Платформа (Timeweb) может задать PORT; по умолчанию 8080
const port = Number(process.env.PORT || 8080);
const cwdDist = path.join(process.cwd(), "dist", "spa");
const distPath = fs.existsSync(cwdDist) ? cwdDist : path.join(path.dirname(process.argv[1] || "."), "..", "spa");

// Serve static files (index.html, JS, CSS, assets)
app.use(express.static(distPath, { index: "index.html" }));

// Handle React Router - serve index.html for all non-API routes
// path-to-regexp v8 (Express 5) rejects "*" and "/(.*)"; use RegExp to match any path
app.get(/.*/, (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  const indexFile = path.join(distPath, "index.html");
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res.status(503).send("Application starting...");
});

// Слушать на 0.0.0.0, чтобы контейнер принимал запросы снаружи (Timeweb, Docker)
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Fusion Starter server running on port ${port} (PORT from env: ${process.env.PORT ? "yes" : "default 8080"})`);
  console.log(`📱 SPA: ${distPath}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  console.error("Listen failed:", err.message);
  process.exit(1);
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
