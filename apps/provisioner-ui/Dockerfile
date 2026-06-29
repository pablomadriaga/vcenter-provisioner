# syntax=docker/dockerfile:1
# =============================================================================
# provisioner-ui Dockerfile
# =============================================================================
# Incluye: React build + nginx + probe-scheduler.sh (shared scripts)
# =============================================================================

ARG SHARED_SCRIPTS_TAG=local
FROM shared-scripts:${SHARED_SCRIPTS_TAG} AS scripts
FROM node:20.11.0-alpine3.19 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.25.3-alpine

ARG VERSION=1.2.0
LABEL version=${VERSION}
LABEL description="vCenter Provisioner UI - Batch VM Creation & Confirmation"
LABEL project="vcenter-provisioner"
LABEL service="provisioner-ui"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

COPY --from=scripts --chmod=755 /nginx-wrapper-simple.sh /nginx-wrapper.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:80/health || exit 1

EXPOSE 80

ENTRYPOINT ["/bin/sh", "/nginx-wrapper.sh"]
