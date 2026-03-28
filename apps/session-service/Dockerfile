FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/session-service ./apps/session-service

RUN npm install
RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/session-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/session-service/dist ./apps/session-service/dist
COPY --from=builder /app/apps/session-service/package.json ./apps/session-service/package.json

EXPOSE 3003

CMD ["node", "apps/session-service/dist/index.js"]
