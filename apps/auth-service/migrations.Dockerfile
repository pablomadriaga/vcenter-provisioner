# =============================================================================
# migrations.Dockerfile
# =============================================================================
# Purpose: Run database migrations using node-pg-migrate
# Following Context7 best practices:
#   - Separate image for migrations (not dependent on host)
#   - Uses Docker build cache
#   - Reproducible and immutable
#   - Ready for Kubernetes Job
# =============================================================================

FROM node:24-alpine AS builder

WORKDIR /app

# Copy from project root (context: ../.. in docker-compose)
COPY apps/auth-service/package*.json ./
COPY apps/auth-service/.node-pg-migrate.js ./
COPY apps/auth-service/migrations ./migrations

# Install dependencies (includes devDependencies for node-pg-migrate)
RUN npm install

# Run migrations
CMD ["npx", "node-pg-migrate", "up"]
