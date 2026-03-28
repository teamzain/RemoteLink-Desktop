FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/billing-service ./apps/billing-service

RUN npm install
RUN npm run build -w @remotelink/shared
RUN npm run build -w @remotelink/billing-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/billing-service/dist ./apps/billing-service/dist
COPY --from=builder /app/apps/billing-service/package.json ./apps/billing-service/package.json

EXPOSE 3004

CMD ["node", "apps/billing-service/dist/index.js"]
