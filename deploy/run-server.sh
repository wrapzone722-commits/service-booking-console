#!/bin/sh
# Гарантирует PORT=8080 для health check (Timeweb и др.)
export PORT="${PORT:-8080}"
exec node dist/server/node-build.mjs
