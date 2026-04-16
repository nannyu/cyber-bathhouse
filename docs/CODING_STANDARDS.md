# 📏 编码规范

本文档定义赛博澡堂项目的代码风格和质量标准，所有贡献者必须遵循。

---

## 1. 语言与模块

- **语言**: JavaScript (ES2022+)
- **模块**: ES Modules (`import` / `export`)
- **禁止**: CommonJS (`require` / `module.exports`)
- **类型标注**: JSDoc 注释提供类型提示

## 2. 命名规范

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件名 | PascalCase（类）/ camelCase（工具） | `Character.js`, `utils.js` |
| 类名 | PascalCase | `class BubbleManager` |
| 方法/函数 | camelCase | `addBubble()`, `renderSteam()` |
| 常量 | UPPER_SNAKE_CASE | `const MAX_BUBBLE_DURATION = 3000` |
| 私有成员 | `_` 前缀 | `this._frameIndex`, `_calculateDamage()` |
| 事件名 | `模块:动作` 格式 | `'chat:send'`, `'fight:start'` |
| CSS 类名 | BEM 命名法 | `.sidebar__tab--active` |
| CSS 变量 | `--cb-` 前缀 + kebab-case | `--cb-neon-blue` |

## 3. 代码风格

```javascript
// ✅ 正确
export class Character {
  /** @type {string} */
  _name;

  /**
   * 创建角色实例
   * @param {string} name - 角色名称
   * @param {number} x - 初始 X 坐标
   * @param {number} y - 初始 Y 坐标
   */
  constructor(name, x, y) {
    this._name = name;
    this.x = x;
    this.y = y;
    this.state = 'idle';
  }

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    // 状态更新逻辑
  }
}
```

### 关键规则

1. **缩进**: 2 空格
2. **引号**: 单引号 `'`，模板字符串用反引号
3. **分号**: 必须加
4. **尾逗号**: 多行结构必须有 trailing comma
5. **行宽**: 最大 100 字符
6. **空行**: 方法之间 1 空行，模块导入后 1 空行

## 4. 文件组织

每个文件遵循以下结构顺序：

```javascript
// 1. 导入（按类型分组，组间空行）
import { EventBus } from '../core/EventBus.js';
import { SpriteRenderer } from './SpriteRenderer.js';

import { TILE_SIZE, COLORS } from '../constants.js';

// 2. 模块级常量
const MAX_SPEED = 2;
const ANIMATION_FPS = 8;

// 3. 类/函数定义
export class MyModule {
  // ...
}

// 4. 辅助函数（如果不导出，放在文件底部）
function _helperFunction() {
  // ...
}
```

## 5. Canvas 绘制规范

```javascript
// ✅ 正确：save/restore 包裹所有状态修改
render(ctx) {
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.fillStyle = COLORS.NEON_BLUE;
  ctx.fillRect(0, 0, this.width, this.height);
  ctx.restore();
}

// ❌ 错误：不包裹 save/restore
render(ctx) {
  ctx.translate(this.x, this.y);  // 会污染全局状态！
  ctx.fillRect(0, 0, this.width, this.height);
}
```

### Canvas 规则

1. **必须 `save()` / `restore()`**: 所有 `render()` 方法必须包裹
2. **像素对齐**: 坐标取整 `Math.floor(x)` 避免像素模糊
3. **禁用抗锯齿**: `ctx.imageSmoothingEnabled = false`（像素风核心）
4. **统一像素单位**: 1 像素单位 = 4px 实际屏幕像素（PIXEL_SCALE = 4）

## 6. 事件通信规范

```javascript
// 事件名格式：模块名:动作名
// 事件数据必须是普通对象

// ✅ 正确
EventBus.emit('chat:send', { userId: 'u1', text: '你好' });
EventBus.emit('fight:start', { attackerId: 'u1', defenderId: 'u2' });

// ❌ 错误
EventBus.emit('send', '你好');          // 无模块前缀，数据不是对象
EventBus.emit('FIGHT_START', { ... });  // 大写命名不符合规范
```

## 7. JSDoc 类型标注

所有**公开方法**和**类属性**必须有 JSDoc 注释：

```javascript
/**
 * 对话气泡
 * @typedef {Object} Bubble
 * @property {string} characterId - 所属角色 ID
 * @property {string} text - 气泡文字
 * @property {number} x - 显示 X 坐标
 * @property {number} y - 显示 Y 坐标
 * @property {number} opacity - 当前透明度 (0-1)
 * @property {number} lifetime - 剩余生命时间（毫秒）
 */
```

## 8. 目录与导入规则

- **相对路径导入**: 项目内模块用相对路径 `'./Module.js'`
- **文件后缀**: 导入时必须写 `.js` 后缀
- **循环依赖**: 严格禁止，通过事件总线解耦
- **桶文件**: 不使用 `index.js` 做重导出，直接导入具体文件

## 9. 性能准则

| 规则 | 说明 |
|------|------|
| 避免 `render()` 中创建对象 | 预分配复用 |
| 预计算帧数据 | 动画帧数据在初始化时计算 |
| 离屏 Canvas 缓存 | 静态像素精灵绘制一次后缓存 |
| 事件委托 | Canvas 点击用单个 listener + hitTest |
| `requestAnimationFrame` | 唯一的渲染驱动方式 |

## 10. Git 提交规范

```
<类型>(<范围>): <描述>

feat(engine): 添加角色打架动画
fix(ui): 修复聊天面板滚动问题
style(css): 调整霓虹灯颜色
refactor(engine): 重构角色状态机
docs: 更新架构文档
```

类型：`feat` | `fix` | `style` | `refactor` | `docs` | `perf` | `test` | `chore`
