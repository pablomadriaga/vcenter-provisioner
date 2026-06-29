# syntax=docker/dockerfile:1
# =============================================================================
# vcenter-operations Dockerfile
# =============================================================================
# Servicio: Operaciones de infraestructura vCenter (crear VMs, listar, etc.)
# Lenguaje: Go
# Puerto: 8091
# Incluye: Go service + probe-scheduler.sh (shared scripts)
# =============================================================================

ARG SHARED_SCRIPTS_TAG=local
FROM shared-scripts:${SHARED_SCRIPTS_TAG} AS scripts
FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache ca-certificates curl bash

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -o /app/service .

FROM alpine:3.19.1

WORKDIR /app

RUN apk add --no-cache curl bash

RUN addgroup --system --gid 1001 antigravity && \
    adduser --system --uid 1001 --ingroup antigravity clouduser

COPY --from=scripts --chmod=755 /probe-scheduler.sh /probe-scheduler.sh
COPY --from=scripts --chmod=755 /go-wrapper.sh /go-wrapper.sh

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/service .

USER clouduser

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8091/health || exit 1

EXPOSE 8091

ENV PORT=8091
ENV GIN_MODE=release
ENV MONITORING_URL=http://monitoring-service:8082

ENTRYPOINT ["/go-wrapper.sh"]
