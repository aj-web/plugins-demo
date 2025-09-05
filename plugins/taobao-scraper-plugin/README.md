
# 淘宝商品好评图片爬取插件

专业的淘宝和1688商品好评图片爬取插件，支持图片搜索、商品详情页爬取和批量下载。基于 TypeScript + Vue 3 + Playwright 构建。

## 功能特性

- ✅ **多平台支持** - 支持淘宝和1688平台
- ✅ **图片搜索** - 支持以图搜图功能
- ✅ **SKU搜索** - 支持直接通过商品ID搜索
- ✅ **评价图片爬取** - 自动爬取商品评价中的图片
- ✅ **Cookie管理** - 智能Cookie保存和复用
- ✅ **批量下载** - 支持ZIP格式批量下载
- ✅ **反检测机制** - 内置反爬虫检测
- ✅ **智能补偿** - 自动补偿图片不足的商品

## 项目架构
taobao-crawl/
├── src/
│ ├── frontend/ # Vue 3 前端界面
│ │ ├── index.html # 前端入口
│ │ ├── main.js # Vue 应用主文件
│ │ ├── package.json # 前端依赖
│ │ └── vite.config.ts # Vite 配置
│ ├── nodes/ # 核心功能节点
│ │ ├── taobao-login.ts # 淘宝登录
│ │ ├── image-search.ts # 图片搜索
│ │ ├── 1688-login.ts # 1688登录
│ │ └── 1688-search.ts # 1688搜索
│ ├── utils/ # 工具函数
│ │ ├── global-cookie-manager.ts # Cookie管理
│ │ ├── config-manager.ts # 配置管理
│ │ └── file-utils.ts # 文件操作
│ ├── types/ # 类型定义
│ │ └── index.ts # 通用类型
│ ├── scripts/ # 构建脚本
│ │ ├── build.js # 构建脚本
│ │ ├── dev.js # 开发脚本
│ │ └── package.js # 打包脚本
│ └── plugin_host.ts # 插件主机
├── dist/ # 构建输出
├── manifest.json # 插件清单
└── package.json # 项目配置

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd src/frontend
npm install
cd ../..
```

### 2. 开发模式

```bash
# 启动开发环境（同时启动TypeScript监听和前端开发服务器）
npm run dev
```

### 3. 构建生产版本

```bash
# 构建完整项目
npm run build

# 打包为ZIP文件
npm run package
```

## 使用说明

### 1. 登录平台

- **淘宝登录**：点击"淘宝登录"按钮，扫码登录
- **1688登录**：点击"1688登录"按钮，扫码登录

### 2. 搜索商品

#### 图片搜索
1. 点击"选择图片"按钮上传图片
2. 点击"开始搜索"按钮
3. 系统自动搜索相似商品

#### SKU搜索
1. 在SKU ID输入框中输入商品ID（如：866648458353）
2. 点击"开始搜索"按钮
3. 系统直接访问商品详情页

### 3. 下载图片

- **选择图片**：点击图片进行选择
- **批量下载**：点击"全部下载"按钮
- **商品下载**：点击"下载此商品图片"按钮

## 技术栈

### 后端
- **TypeScript** - 类型安全的JavaScript
- **Playwright** - 浏览器自动化
- **Node.js** - 运行时环境

### 前端
- **Vue 3** - 渐进式JavaScript框架
- **Vite** - 快速构建工具
- **TypeScript** - 类型安全

### 构建工具
- **TypeScript Compiler** - 编译TypeScript
- **Vite** - 前端构建
- **Archiver** - ZIP打包

## 核心类说明

### ImageSearchNode
淘宝图片搜索核心类，负责图片搜索和评价爬取。

```typescript
class ImageSearchNode {
  async runSearch(filePath?: string, skuId?: string): Promise<string>
  async crawlReviewImages(products: ProductData[]): Promise<CrawlResult[]>
}
```

### Search1688Node
1688搜索核心类，支持1688平台的图片搜索。

```typescript
class Search1688Node {
  async startSearch(filePath?: string, skuId?: string): Promise<string>
  async crawlReviewImages(searchResults: ProductData[]): Promise<CrawlResult[]>
}
```

### GlobalCookieManager
全局Cookie管理器，支持多平台Cookie管理。

```typescript
class GlobalCookieManager {
  saveCookies(platform: Platform, cookies: Cookie[]): void
  getCookies(platform: Platform): Cookie[]
  hasCookies(platform: Platform): boolean
}
```

## 配置说明

### manifest.json
插件清单文件，定义插件元数据和事件处理。

```json
{
  "name": "taobao-scraper-plugin",
  "version": "1.0.0",
  "events": [
    {
      "id": "taobao-login",
      "class": "TaobaoLoginNode",
      "method": "startLogin"
    }
  ]
}
```

### tsconfig.json
TypeScript编译配置。

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "strict": true
  }
}
```

## 开发指南

### 添加新平台

1. 在 `src/nodes/` 创建新的登录和搜索类
2. 在 `src/types/index.ts` 添加平台类型
3. 在 `manifest.json` 注册新事件
4. 在前端添加平台切换逻辑

### 自定义搜索逻辑

1. 继承基础搜索类
2. 重写搜索方法
3. 实现平台特定的爬取逻辑

## 注意事项

1. **Cookie管理** - 登录状态会自动保存，无需重复登录
2. **反检测** - 内置反爬虫机制，请合理使用
3. **图片质量** - 自动过滤占位图和无效图片
4. **下载限制** - 建议分批下载，避免请求过于频繁

## 故障排除

### 常见问题

1. **登录失败** - 检查网络连接，重新登录
2. **搜索无结果** - 尝试更换图片或检查SKU ID
3. **下载失败** - 检查磁盘空间和网络连接

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm run dev
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 更新日志

### v1.0.0
- ✅ 支持淘宝和1688平台
- ✅ 图片搜索和SKU搜索
- ✅ 评价图片爬取
- ✅ Vue 3 前端界面
- ✅ TypeScript 重构
- ✅ 智能Cookie管理
- ✅ ZIP批量下载