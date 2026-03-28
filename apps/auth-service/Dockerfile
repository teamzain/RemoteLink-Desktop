# Use Node.js LTS
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace configurations
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy necessary packages and apps
COPY packages/shared ./packages/shared
COPY apps/auth-service ./apps/auth-service

# Install dependencies
RUN npm install

# Build shared packages first
RUN npm run build -w @remotelink/shared

# Build the auth service
RUN npm run build -w @remotelink/auth-service

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/package.json

EXPOSE 3001

CMD ["node", "apps/auth-service/dist/index.js"]
