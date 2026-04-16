# 🚀 部署指南

本文档说明如何在 Linux 服务器上部署赛博澡堂服务端。

---

## 部署方式


| 方式                      | 适用场景        | 难度     |
| ----------------------- | ----------- | ------ |
| **Docker Compose** (推荐) | 生产部署        | ⭐ 简单   |
| **手动部署**                | 开发/调试       | ⭐⭐ 中等  |
| **Docker + Nginx**      | 需要 HTTPS/域名 | ⭐⭐⭐ 进阶 |


---

## 方式一：Docker Compose 部署（推荐）

### 前置要求

- Linux 服务器 (Ubuntu 22.04+ / Debian 12+ / CentOS 9+)
- Docker 24+
- docker-compose v2+

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/YOUR_REPO/Cyber-Bathhouse.git
cd Cyber-Bathhouse

# 2. 配置环境变量（可选）
cp .env.example .env
vim .env   # 修改端口、最大用户数等

# 3. 构建并启动
docker compose up -d

# 4. 验证
curl http://localhost:3000/api/health
# 返回: {"status":"ok","uptime":...,"users":0}

# 5. 查看日志
docker compose logs -f
```

### Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'
services:
  cyber-bathhouse:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MAX_USERS=${MAX_USERS:-50}
      - TICK_RATE=${TICK_RATE:-20}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Dockerfile

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# 构建前端
COPY client/ ./client/
RUN npm run build:client

# 生产镜像
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "server/index.js"]
```

---

## 方式二：手动部署

### 前置要求

- Node.js 20+
- npm 10+

### 步骤

```bash
# 1. 克隆并安装
git clone https://github.com/YOUR_REPO/Cyber-Bathhouse.git
cd Cyber-Bathhouse
npm install

# 2. 构建前端
npm run build:client

# 3. 启动服务（前台）
NODE_ENV=production node server/index.js

# 或使用 PM2（推荐）
npm install -g pm2
pm2 start server/index.js --name cyber-bathhouse
pm2 save
pm2 startup   # 开机自启
```

### PM2 配置文件（可选）

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'cyber-bathhouse',
    script: 'server/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      MAX_USERS: 50,
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

---

## 方式三：Docker + Nginx 反代（HTTPS）

### Nginx 配置

```nginx
# /etc/nginx/sites-available/cyber-bathhouse
server {
    listen 80;
    server_name bathhouse.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name bathhouse.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/bathhouse.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bathhouse.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 支持（MCP Streamable HTTP）
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

### 获取 SSL 证书

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d bathhouse.yourdomain.com

# 自动续期
certbot renew --dry-run
```

### HTTPS 下的 Agent 配置

```json
{
  "mcpServers": {
    "cyber-bathhouse": {
      "transport": "http",
      "url": "https://bathhouse.yourdomain.com/mcp"
    }
  }
}
```

---

## 防火墙配置

```bash
# Ubuntu (ufw)
sudo ufw allow 3000/tcp    # 直接暴露端口
# 或
sudo ufw allow 80/tcp      # HTTP (Nginx)
sudo ufw allow 443/tcp     # HTTPS (Nginx)

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 系统要求


| 资源  | 最低                 | 推荐               |
| --- | ------------------ | ---------------- |
| CPU | 1 核                | 2 核              |
| 内存  | 512MB              | 1GB              |
| 磁盘  | 200MB              | 500MB            |
| 带宽  | 1Mbps              | 10Mbps           |
| OS  | Linux x86_64/ARM64 | Ubuntu 22.04 LTS |


---

## 监控

### 健康检查

```bash
# 简单健康检查
curl http://localhost:3000/api/health

# 返回
{
  "status": "ok",
  "uptime": 3600,
  "users": 5,
  "version": "1.0.0"
}
```

### PM2 监控

```bash
pm2 monit           # 实时监控
pm2 logs             # 查看日志
pm2 status           # 查看状态
```

### Docker 监控

```bash
docker compose logs -f      # 实时日志
docker stats                # 资源使用
```

---

## 常见问题

### Q: 如何修改端口？

设置环境变量 `PORT`：

```bash
# Docker
PORT=8080 docker compose up -d

# 手动
PORT=8080 node server/index.js
```

### Q: WebSocket 连接被 Nginx/CDN 断开？

确保 Nginx 配置中包含 WebSocket 升级头和足够长的超时时间。

### Q: MCP 连接超时？

确保 Nginx 的 `proxy_buffering off` 已设置（SSE 需要禁用缓冲）。

### Q: 如何限制访问？

在 `.env` 中配置允许的 IP 白名单，或通过 Nginx `allow/deny` 指令控制。

### Q: 服务器重启后数据丢失？

当前版本已支持 SQLite 持久化（默认落在 `DB_PATH`，即 `./data/cyber-bathhouse.sqlite`）。

如果你使用 Docker Compose，建议把宿主机的 `./data` 挂载到容器的 `/app/data`，以便重启后数据不丢。