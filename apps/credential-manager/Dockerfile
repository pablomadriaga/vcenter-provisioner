# =============================================================================
# credential-manager Dockerfile
# =============================================================================
# Servicio: Gestión de credenciales y conexiones vCenter
# Lenguaje: TypeScript/Node.js
# Puerto: 8090
# =============================================================================

FROM node:24.16.0-alpine3.24 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:24.16.0-alpine3.24 AS runner

WORKDIR /app

# Install curl for healthcheck (alpine minimal doesn't have it)
RUN apk add --no-cache curl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 8090

CMD ["node", "dist/index.js"]
