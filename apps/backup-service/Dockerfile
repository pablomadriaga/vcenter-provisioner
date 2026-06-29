# syntax=docker/dockerfile:1
# =============================================================================
# backup-service Dockerfile
# =============================================================================
# Incluye: Python + probe-scheduler.sh (shared scripts)
# =============================================================================

ARG SHARED_SCRIPTS_TAG=local
FROM shared-scripts:${SHARED_SCRIPTS_TAG} AS scripts
FROM python:3.12.2-slim-bookworm AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12.2-slim-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl bash && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY --from=scripts --chmod=755 /probe-scheduler.sh /probe-scheduler.sh
COPY --from=scripts --chmod=755 /shared-wrapper.sh /shared-wrapper.sh

RUN addgroup --system --gid 1001 antigravity && \
    adduser --system --uid 1001 --ingroup antigravity clouduser

COPY --from=builder /install /usr/local
COPY app ./app

USER clouduser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

EXPOSE 8002

ENTRYPOINT ["/shared-wrapper.sh"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]
