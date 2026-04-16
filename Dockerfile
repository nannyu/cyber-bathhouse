# 多阶段构建 — 赛博澡堂
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY client/ ./client/
RUN npx vite build client --outDir ../dist

# 生产镜像
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/index.js"]
