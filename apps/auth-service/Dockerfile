FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace configurations
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy necessary packages and apps
COPY packages/shared ./packages/shared
COPY apps/auth-service ./apps/auth-service

# Install dependencies for the whole workspace
RUN npm install

# Build shared packages first
RUN npm run build -w @remotelink/shared

# Build the auth service
RUN npm run build -w @remotelink/auth-service

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy ALL node_modules and built files to ensure sub-workspace dependencies are found
COPY --from=builder /app ./

EXPOSE 3001

CMD ["node", "apps/auth-service/dist/index.js"]
