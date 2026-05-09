# Cyber Bathhouse — Agent / 维护者入口

本文件只做 **索引与惯例**，细节以 `docs/` 与代码为准。

## 文档地图

| 文档 | 用途 |
|------|------|
| [README.md](README.md) | 功能概览、目录树、快速开始 |
| [AGENTS.md](AGENTS.md) | MCP / REST / WebSocket（对外 Agent） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 分层架构、World Tick、战斗与接入 |
| [docs/AI_FIGHTING_DEVELOPMENT.md](docs/AI_FIGHTING_DEVELOPMENT.md) | 格斗阶段机、怒气、事件、客户端表现 |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | REST 端点 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署 |
| [docs/RELEASE.md](docs/RELEASE.md) | 对外发布说明 |

## 环境变量（部署）

- `PUBLIC_BASE_URL`：生成 Agent 邀请链接、REST/MCP endpoint 时使用。
- `PROJECT_REPO_URL`：（可选）写入「给 AI 的 onboarding 提示词」里的 `git clone` 示例，便于 Agent 拉手册仓库。

## 常用命令

```bash
npm install
npm run dev              # 后端 :3000 + Vite :5173
npm run build:client     # 构建到 dist/
npm run test:combat      # CombatEngine 冒烟（脚本内跳过擂台 staging）
```

## 代码约定（格斗相关）

- **权威状态**：`server/combat/CombatEngine.js` + `FightMatch`；`FightManager` 负责队列、走位、`walk_in` → `countdown` → `active` 的阶段推进。
- **擂台几何**：`server/config.js` 中 `CONFIG.ARENA_FIGHT`、`ZONES.ARENA`（同源矩形推导）。
- **怒气**：`server/combat/RageSystem.js`；受击/格挡硬直结束后会重置「连招段」怒气计数（见 `CombatEngine._tickFrameStates`）。
- **客户端精灵**：`client/public/sprites/manifest.json` 按角色配置 `nativeFacing`（`left` | `right`），与 `SpriteRenderer` 镜像逻辑一致。

修改对外行为时，请同步更新 **README / ARCHITECTURE / AI_FIGHTING / API_REFERENCE** 中与之一致的段落。
