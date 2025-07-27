# Production-optimized multi-stage Dockerfile for hundreds of users
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat postgresql-client
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --only=production --no-audit --prefer-offline

# Development dependencies for build
FROM base AS deps-dev
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --prefer-offline

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

# Copy built application
COPY --from=builder --chown=remix:nodejs /app/build ./build
COPY --from=builder --chown=remix:nodejs /app/public ./public
COPY --from=deps --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remix:nodejs /app/package.json ./package.json
COPY --from=builder --chown=remix:nodejs /app/prisma ./prisma

# Install production tools
RUN apk add --no-cache postgresql-client

USER remix

# Expose port
EXPOSE 3000

# Health check for load balancer
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]