# Stage 1: Build and test
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Run tests
RUN npm test

# Transpile
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy transpiled JS files from builder
COPY --from=builder /app/dist ./

# Security hardening
RUN apk add --no-cache dumb-init && \
    chown -R node:node /app && \
    rm -rf /var/cache/apk/*

USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD node -e "require('http').get('http://localhost:${PORT}/api/healthCheck', (r) => { if (r.statusCode !== 200) throw new Error() })"

EXPOSE ${PORT}

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]