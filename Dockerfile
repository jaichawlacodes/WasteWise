# ── Stage 1: Install production dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

# ── Stage 2: Build the Next.js application ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Build-time public variables (bundled into client JS by Next.js)
ARG NEXT_PUBLIC_GEMINI_API_KEY=""
ARG WEB3_AUTH_CLIENT_ID=""
ARG NEXT_PUBLIC_GEMINI_MODEL=""
ARG NEXT_PUBLIC_WEB3AUTH_NETWORK="sapphire_mainnet"

ENV NEXT_PUBLIC_GEMINI_API_KEY=$NEXT_PUBLIC_GEMINI_API_KEY
ENV WEB3_AUTH_CLIENT_ID=$WEB3_AUTH_CLIENT_ID
ENV NEXT_PUBLIC_GEMINI_MODEL=$NEXT_PUBLIC_GEMINI_MODEL
ENV NEXT_PUBLIC_WEB3AUTH_NETWORK=$NEXT_PUBLIC_WEB3AUTH_NETWORK

RUN npm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone output (server runtime + traced dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static assets (Next.js client-side bundles)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public assets (images, favicons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
