# 优创客户端 - 重构版本

这是一个基于 Vue 3 + TypeScript + Electron 的插件化客户端应用。

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **桌面应用**: Electron
- **样式**: CSS3 + Element Plus 暗色主题

## 项目结构

```
plugins-demo/
├── src/                    # Vue 3 前端源码
│   ├── components/         # Vue 组件
│   ├── views/             # 页面组件
│   ├── stores/            # Pinia 状态管理
│   ├── router/            # Vue Router 配置
│   ├── types/             # TypeScript 类型定义
│   ├── style.css          # 全局样式
│   └── main.ts            # 应用入口
├── electron/              # Electron 主进程
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   ├── ipcHandlers.ts     # IPC 处理器
│   ├── utils/             # 工具类
│   └── tracker-util.ts    # 追踪工具
├── plugins/               # 插件目录（保持不变）
├── dist/                  # 构建输出目录
├── dist-electron/         # Electron 构建输出
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 项目配置
```

## 开发环境设置

### 安装依赖

```bash
cnpm install
```

### 开发模式

```bash
# 启动完整开发环境（推荐）
npm run dev:start

# 或者分别启动
npm run dev              # 启动 Vite 开发服务器
npm run start:electron   # 启动 Electron
```

### 构建

```bash
# 构建前端
npm run build

# 构建 Electron 应用
npm run electron:build

# 构建安装包
npm run build-win        # Windows
npm run build-mac        # macOS
npm run build-linux      # Linux
```

## 主要特性

### 1. 现代化技术栈
- 使用 Vue 3 Composition API 和 TypeScript 提供更好的开发体验
- 使用 Vite 提供更快的开发服务器和构建速度
- 使用 Element Plus 提供现代化的 UI 组件

### 2. 插件系统
- 保持原有的插件架构不变
- 支持动态加载插件
- 插件样式隔离
- 插件进程管理

### 3. 暗色主题
- 内置暗色主题支持
- 现代化的 UI 设计
- 响应式布局

### 4. 类型安全
- 完整的 TypeScript 支持
- 类型安全的 API 调用
- 更好的 IDE 支持

## 插件开发

插件开发方式保持不变，插件需要包含以下文件：

- `manifest.json` - 插件配置文件
- `plugin_host.js` - 插件主进程文件
- `frontend/` - 插件前端文件
  - `index.html` - 插件页面
  - `main.js` - 插件脚本
  - `style.css` - 插件样式

## 迁移说明

### 从旧版本迁移

1. **插件兼容性**: 所有现有插件无需修改即可使用
2. **配置文件**: `config.json` 保持不变
3. **资源文件**: `plugins/` 目录和 `ffmpeg.exe` 保持不变

### 新功能

1. **更好的开发体验**: 热重载、TypeScript 支持
2. **现代化 UI**: Element Plus 组件库
3. **更好的性能**: Vite 构建优化
4. **类型安全**: 完整的 TypeScript 支持

## 开发指南

### 添加新页面

1. 在 `src/views/` 创建新的 Vue 组件
2. 在 `src/router/index.ts` 添加路由配置
3. 在侧边栏中添加导航项

### 添加新功能

1. 在 `src/stores/` 创建状态管理
2. 在 `src/components/` 创建可复用组件
3. 在 `electron/` 添加主进程功能

### 插件开发

插件开发方式与之前相同，但建议：

1. 使用现代 JavaScript 语法
2. 添加适当的错误处理
3. 遵循插件开发规范

## 构建和部署

### 开发环境

```bash
npm run dev:start
```

### 生产环境

```bash
npm run build
npm run electron:build
```

### 打包应用

```bash
# Windows
npm run build-win

# macOS
npm run build-mac

# Linux
npm run build-linux
```

## 故障排除

### 常见问题

1. **插件加载失败**: 检查插件目录结构和 manifest.json
2. **样式问题**: 确保插件样式正确隔离
3. **IPC 通信失败**: 检查 preload 脚本和 IPC 处理器

### 调试

1. 开发模式会自动打开开发者工具
2. 使用 `console.log` 进行调试
3. 检查 Electron 主进程日志

## 许可证

MIT License 