# Tracker配置说明

## 🔧 问题解决

您之前遇到的"not configured"问题已经修复。现在Tracker系统已经正确配置为连接到您的API地址：`https://scriptv2.qfei.cn/`

## 📋 配置详情

### 1. **config.json配置**
```json
{
  "key": "your-actual-key-here",
  "title": "优创客户端体验版",
  "version": "0.3.0",
  "description": "插件化客户端应用",
  "tracker": {
    "enabled": true,
    "baseUrl": "https://scriptv2.qfei.cn",
    "clientType": "VideoConverter",
    "clientId": 2
  }
}
```

### 2. **Tracker功能**
- ✅ **登录功能**: 应用启动时自动登录到您的API
- ✅ **事件上报**: 支持各种事件的数据上报
- ✅ **错误处理**: 完善的错误处理和日志记录
- ✅ **配置管理**: 通过config.json统一管理所有配置
- ✅ **动态配置**: 支持运行时重新加载配置
- ✅ **启用/禁用**: 可通过配置控制Tracker功能开关

### 3. **API端点**
- **登录**: `POST https://scriptv2.qfei.cn/api/client/login`
- **事件追踪**: `POST https://scriptv2.qfei.cn/api/client/event_tracking`

### 4. **请求格式**

#### 登录请求
```json
{
  "key": "your-actual-key-here",
  "client_id": 2
}
```

#### 事件追踪请求
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "os": "win32 10.0.19045",
  "client_type": "VideoConverter",
  "customized_id": "",
  "customized_type": "",
  "event_type": "user_action",
  "event_time": 1703123456789,
  "event_name": "app_start",
  "page_name": "main",
  "client_time": 1703123456789
}
```

## 🚀 使用步骤

### 1. **配置Tracker**
编辑`config.json`文件，根据需要调整配置：

#### 启用Tracker（推荐）
```json
{
  "key": "您的实际key",
  "tracker": {
    "enabled": true,
    "baseUrl": "https://scriptv2.qfei.cn",
    "clientType": "VideoConverter",
    "clientId": 2
  }
}
```

#### 禁用Tracker
```json
{
  "key": "您的实际key",
  "tracker": {
    "enabled": false
  }
}
```

#### 使用不同的API地址
```json
{
  "key": "您的实际key",
  "tracker": {
    "enabled": true,
    "baseUrl": "https://your-custom-api.com",
    "clientType": "VideoConverter",
    "clientId": 2
  }
}
```

### 2. **启动应用**
```bash
npm run build
npm run electron:dev
```

### 3. **查看日志**
启动后查看控制台输出，应该能看到：
```
Tracker 配置: { baseUrl: 'https://scriptv2.qfei.cn/', hasKey: true }
Tracker login attempt to: https://scriptv2.qfei.cn/
Tracker login success: { success: true, ... }
```

## 🔍 故障排除

### 问题1: "Tracker 未启用或未配置 key"
**解决方案**: 检查`config.json`中的key是否正确设置

### 问题2: "Tracker login failed"
**解决方案**: 
1. 检查网络连接
2. 确认API地址`https://scriptv2.qfei.cn/`可访问
3. 验证key的有效性

### 问题3: "HTTP 404/500错误"
**解决方案**: 
1. 确认API端点路径正确
2. 检查服务器状态
3. 验证请求格式

## 📝 技术实现

### 配置管理
Tracker的所有配置现在统一维护在`config.json`中：

```typescript
interface TrackerConfig {
  enabled: boolean        // 是否启用Tracker
  baseUrl: string        // API服务器地址
  clientType?: string    // 客户端类型
  clientId?: number      // 客户端ID
}

interface AppConfig {
  key: string           // 登录密钥
  title: string         // 应用标题
  version: string       // 应用版本
  description: string   // 应用描述
  tracker: TrackerConfig // Tracker配置
}
```

### TrackerUtil类
```typescript
class TrackerUtil {
  private config: AppConfig
  private key: string | null = null
  private openId: string | null = null
  private clientType: string
  private clientId: number

  constructor() // 从config.json自动加载配置

  // 配置管理
  isEnabled(): boolean           // 检查是否启用
  getKey(): string              // 获取配置的key
  reloadConfig(): void          // 重新加载配置

  // 核心功能
  async login(key?: string): Promise<any>  // 登录（可选传入key）
  async trackEvent(options): Promise<any>  // 事件追踪
  async report(event: string, data: any): Promise<void> // 兼容旧版本

  // 状态查询
  getConfig(): TrackerConfigInfo
  getOpenId(): string | null
  isLoggedIn(): boolean
}
```

### 配置管理
- 通过`configManager`读取配置
- 支持动态配置更新
- 完善的错误处理机制

## ✅ 修复效果

现在Tracker系统应该能够：
1. ✅ 正确连接到您的API地址
2. ✅ 成功进行登录验证
3. ✅ 正常上报事件数据
4. ✅ 提供详细的日志信息
5. ✅ 优雅处理错误情况
6. ✅ **完全兼容原始版本**：API端点、请求格式、错误处理

## 🔄 **与原始版本兼容性**

### ✅ **完全兼容的功能**
- **API端点**: `/api/client/login` 和 `/api/client/event_tracking`
- **请求格式**: 包含`client_id`、`uuid`、`os`等完整字段
- **错误处理**: 支持`InvalidRegistryKeyError`等自定义错误
- **会话管理**: 完整的`openId`管理和Cookie支持
- **事件追踪**: 完整的`trackEvent`方法，支持所有原始参数

### 🔧 **新增功能**
- **TypeScript支持**: 完整的类型定义
- **配置管理**: 通过config.json灵活配置
- **开发环境支持**: 支持不同的API地址配置
- **更好的错误处理**: 详细的错误信息和日志

请将`config.json`中的key替换为您的实际key，然后重新启动应用测试。 