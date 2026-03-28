FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/signaling-service ./apps/signaling-service

RUN npm install
RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/signaling-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/signaling-service/dist ./apps/signaling-service/dist
COPY --from=builder /app/apps/signaling-service/package.json ./apps/signaling-service/package.json

EXPOSE 3002

CMD ["node", "apps/signaling-service/dist/index.js"]
