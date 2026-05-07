# ── Stage: production image ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --prefer-offline

# Copy application source
COPY src/ ./src/

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
