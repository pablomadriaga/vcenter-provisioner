# syntax=docker/dockerfile:1
# =============================================================================
# api-gateway Dockerfile
# =============================================================================
# Incluye: Node.js app + probe-scheduler.sh (shared scripts)
# =============================================================================

# ARG debe estar antes del primer FROM
ARG SHARED_SCRIPTS_TAG=local

FROM shared-scripts:${SHARED_SCRIPTS_TAG} AS scripts
FROM node:20.11.0-alpine3.19 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --quiet

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && \
    npm prune --production

FROM node:20.11.0-alpine3.19 AS runner

WORKDIR /app

RUN apk add --no-cache curl bash

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 antigravity && \
    adduser --system --uid 1001 --ingroup antigravity clouduser

COPY --from=scripts --chmod=755 /probe-scheduler.sh /probe-scheduler.sh
COPY --from=scripts --chmod=755 /shared-wrapper.sh /shared-wrapper.sh

COPY --from=builder --chown=clouduser:antigravity /app/package*.json ./
COPY --from=builder --chown=clouduser:antigravity /app/dist ./dist
COPY --from=builder --chown=clouduser:antigravity /app/node_modules ./node_modules

USER clouduser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV MONITORING_URL=http://monitoring-service:8082

ENTRYPOINT ["/shared-wrapper.sh"]

CMD ["node", "dist/index.js"]
