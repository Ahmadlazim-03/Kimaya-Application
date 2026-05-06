#!/bin/sh
set -e

echo "Running Prisma DB push..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "Prisma push issue"

echo "Running seed script..."
node prisma/seed.js 2>&1 || echo "Seed issue"

echo "Starting Management application..."
exec node server.js
