#!/bin/sh
set -e

echo "🔄 Running Prisma DB push (sync schema)..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "⚠️ Prisma push encountered an issue"

echo "🌱 Running seed script..."
node prisma/seed.js 2>&1 || echo "⚠️ Seed encountered an issue"

echo "🚀 Starting SIYAP application..."
exec node server.js
