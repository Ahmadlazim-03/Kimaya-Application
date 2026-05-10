# ============================================
# Management Next.js Application — Multi-stage Dockerfile
# ============================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./

# Force-install devDependencies even when NODE_ENV=production is set at build
# time (Coolify injects this automatically into every stage). Without these,
# `npm ci` would skip TypeScript / Next / etc and the next stage's
# `npm run build` would fail.
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
RUN npm ci --legacy-peer-deps --include=dev

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Force Next.js production build regardless of what build-time NODE_ENV
# orchestrators (Coolify) propagate. The deps stage already installed dev
# dependencies, so they're present in node_modules.
ENV NODE_ENV=production

# NEXT_PUBLIC_* env vars are inlined into the client JS bundle at build time.
# Because .dockerignore excludes .env from the build context (correct for
# security), we MUST pass them as ARG → ENV here, otherwise the browser code
# will see `undefined` and Push subscription will fail before contacting the
# server.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client before building
RUN npx prisma generate

RUN npm run build

# --- Stage 3: Production Runner ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, seed, and node_modules for db push + seed at runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/jose ./node_modules/jose
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./entrypoint.sh"]
