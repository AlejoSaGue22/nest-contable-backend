# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache tini

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/data-source.ts ./data-source.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY json-municipios.json ./

RUN mkdir -p /app/storage/facturas /app/uploads/company /app/uploads/empresas

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main"]
