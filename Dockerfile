# syntax=docker/dockerfile:1.7

# Multi-stage build: deps -> build -> runtime
# Image goal: small, deterministic, runs `npm run build` then serves via the
# bundled Express server (which switches to static-file mode when
# NODE_ENV=production).

ARG NODE_VERSION=20-bookworm-slim

# ---------- deps stage ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------- build stage ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env passthroughs (only inject what the client legitimately needs).
ARG SENTRY_DSN
ENV SENTRY_DSN=${SENTRY_DSN}
RUN npm run build

# ---------- runtime stage ----------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app

# Only ship what the server actually needs at runtime: production deps + the
# server entrypoint + the prebuilt client bundle.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY server.ts ./server.ts
COPY server ./server

# Drop privileges. The official node image already provides a `node` user.
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/api/health',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
