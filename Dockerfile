# Stage 1: Test (with ALL dependencies)
FROM node:20-alpine AS tester

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy source and test files
COPY . .

# Run tests
RUN npm test

# Stage 2: Build (with dev dependencies)
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=tester /app .

# Transpile TypeScript
RUN npm run build

# Stage 3: Production (no dev dependencies)
FROM node:18-alpine

WORKDIR /app

# Install PRODUCTION dependencies only
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

# Copy transpiled JS files
COPY --from=builder /app/dist ./

# Security hardening
RUN apk add --no-cache dumb-init && \
    chown -R node:node /app && \
    rm -rf /var/cache/apk/*

USER node

HEALTHCHECK --interval=30s --timeout=3s \
    CMD node -e "require('http').get('http://localhost:${PORT}/api/healthCheck', (r) => { if (r.statusCode !== 200) throw new Error() })"

EXPOSE ${PORT}
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]