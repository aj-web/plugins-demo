
### 2. 前端开发

#### index.html 示例
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <title>你的插件</title>
    <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
</head>
<body>
    <div id="app">
        <el-button @click="onAction">执行操作</el-button>
    </div>
    
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <script src="https://unpkg.com/element-plus"></script>
    <script type="module" src="./main.js"></script>
</body>
</html>
```

#### main.js 示例
```javascript
const { createApp, ref } = window.Vue

// 事件触发器
let seq = 0
const triggerEvent = async (eventType, params = {}) => {
    return new Promise((resolve, reject) => {
        const id = ++seq
        const timeout = setTimeout(() => reject(new Error('请求超时')), 600000)
        
        const messageHandler = (event) => {
            const data = event.data || {}
            if (data.source === 'host' && data.id === id) {
                window.removeEventListener('message', messageHandler)
                clearTimeout(timeout)
                if (data.success) resolve(data.result)
                else reject(new Error(data.error || '未知错误'))
            }
        }
        
        window.addEventListener('message', messageHandler)
        window.parent.postMessage({
            source: 'plugin-frontend',
            action: 'trigger-event',
            id,
            payload: { eventType, params }
        }, '*')
    })
}

// IPC调用器
const invokeIpc = async (channel, args = []) => {
    return new Promise((resolve, reject) => {
        const id = ++seq
        const timeout = setTimeout(() => reject(new Error('请求超时')), 6000000)
        
        const messageHandler = (event) => {
            const data = event.data || {}
            if (data.source === 'host' && data.id === id) {
                window.removeEventListener('message', messageHandler)
                clearTimeout(timeout)
                if (data.success) resolve(data.result)
                else reject(new Error(data.error || '未知错误'))
            }
        }
        
        window.addEventListener('message', messageHandler)
        window.parent.postMessage({
            source: 'plugin-frontend',
            action: 'ipc-invoke',
            id,
            payload: { channel, args }
        }, '*')
    })
}

const App = {
    setup() {
        const onAction = async () => {
            try {
                // 调用插件事件
                const result = await triggerEvent('your-event', { 
                    args: ['参数1', '参数2'] 
                })
                console.log('执行结果:', result)
                
                // 调用主进程API
                const filePath = await invokeIpc('select-file')
                console.log('选择的文件:', filePath)
            } catch (error) {
                console.error('执行失败:', error)
            }
        }
        
        return { onAction }
    }
}

const app = createApp(App)
if (window.ElementPlus) app.use(window.ElementPlus)
app.mount('#app')
```

### 3. 后端节点开发

#### 节点类示例
```javascript
"use strict";

class YourNode {
    constructor() {
        // 初始化属性
        this.someProperty = 'value'
    }

    /**
     * 执行主要功能
     * @param {string} param1 参数1
     * @param {string} param2 参数2
     * @returns {Promise<{success: boolean, data?: any, message?: string}>}
     */
    async yourMethod(param1, param2) {
        try {
            console.log('开始执行功能:', param1, param2)
            
            // 你的业务逻辑
            const result = await this.doSomething(param1, param2)
            
            return {
                success: true,
                data: result,
                message: '执行成功'
            }
        } catch (error) {
            console.error('执行失败:', error)
            return {
                success: false,
                message: error.message || '执行失败'
            }
        }
    }

    async doSomething(param1, param2) {
        // 具体实现
        return { param1, param2 }
    }
}

exports.YourNode = YourNode
```

### 4. 配置文件

#### manifest.json
```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "events": [
    {
      "id": "your-event",
      "class": "YourNode",
      "method": "yourMethod",
      "jsFile": "nodes/your-node.js"
    }
  ],
  "frontend": {
    "devServerUrl": "http://127.0.0.1:5175",
    "entry": "dist/index.html"
  }
}
```

#### package.json
```json
{
  "name": "your-plugin",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "playwright": "^1.40.0",
    "xlsx": "^0.18.5"
  }
}
```

### 5. 构建和部署

#### 开发模式
```bash
# 前端开发
cd frontend
npm run dev

# 构建生产版本
npm run build
```

#### 部署
1. 将插件文件夹复制到 `plugins/` 目录
2. 确保 `dist/` 目录包含构建后的文件
3. 重启 Electron 应用

## 实际开发示例 (ADX插件)

### 1. 前端界面
```html
<!-- 搜索功能 -->
<div class="row">
    <el-input v-model="keyword" placeholder="输入关键词" />
    <el-button @click="onSearch">搜索</el-button>
</div>

<!-- Excel文件选择 -->
<div class="row">
    <el-button @click="selectExcelFile">选择Excel文件</el-button>
    <span v-if="selectedFileName">已选择: {{ selectedFileName }}</span>
</div>
```

### 2. 前端逻辑
```javascript
const onSearch = async () => {
    const res = await triggerEvent('adx-search', { 
        args: [keyword.value.trim()] 
    })
    console.log('搜索返回:', res)
}

const selectExcelFile = async () => {
    const result = await invokeIpc('select-file')
    if (result) {
        selectedFileName.value = result.split('\\').pop()
        const res = await triggerEvent('adx-read-excel', {
            args: [result]
        })
        console.log('Excel读取返回:', res)
    }
}
```

### 3. 后端实现
```javascript
class ADXSearchNode {
    async startSearch(keyword) {
        // 浏览器自动化
        this.browser = await this.browserManager.createBrowser()
        this.page = await this.browser.newPage()
        
        // 登录检查
        const loginResult = await LoginStateUtils.waitForLogin(this.page)
        if (!loginResult.success) {
            return { success: false, message: '登录失败' }
        }
        
        // 执行搜索
        await this.performSearch(keyword)
        
        // 提取数据
        const results = await this.extractCoverImages(40, 5)
        
        return { success: true, data: results }
    }
    
    async readExcel(filePath) {
        const result = await this.excelReader.readExcel(filePath)
        console.log('Excel数据:', result.data)
        return result
    }
}
```

## 开发技巧

### 1. 调试方法
- 使用 `console.log()` 在控制台输出日志
- 前端日志在浏览器开发者工具中查看
- 后端日志在 Electron 主进程控制台中查看

### 2. 错误处理
```javascript
try {
    const result = await someAsyncOperation()
    return { success: true, data: result }
} catch (error) {
    console.error('操作失败:', error)
    return { success: false, message: error.message }
}
```

### 3. 参数传递
- 前端使用 `args` 数组传递参数
- 后端方法直接接收参数
- 支持多个参数传递

### 4. 异步操作
- 所有方法都应该是 `async` 函数
- 使用 `await` 等待异步操作完成
- 合理使用 `Promise` 和 `setTimeout`

## 常见问题

### 1. 插件无法加载
- 检查 `manifest.json` 格式是否正确
- 确认 `jsFile` 路径是否存在
- 查看控制台错误信息

### 2. 前端无法通信
- 检查 `triggerEvent` 函数是否正确
- 确认事件ID是否匹配
- 查看网络请求是否正常

### 3. 后端方法调用失败
- 检查方法名是否正确
- 确认参数类型和数量
- 查看后端日志输出

## 最佳实践

1. **代码组织** - 按功能模块组织代码
2. **错误处理** - 完善的错误处理和日志记录
3. **参数验证** - 验证输入参数的有效性
4. **资源管理** - 及时释放浏览器、文件等资源
5. **用户体验** - 提供加载状态和错误提示

## 扩展功能

### 添加新的主进程API
1. 在 `electron/ipcHandlers.ts` 中添加新的IPC处理器
2. 在前端使用 `invokeIpc` 调用新API

### 添加新的工具类
1. 在 `utils/` 目录创建新的工具类
2. 在节点中导入和使用

### 添加新的依赖
1. 在 `package.json` 中添加依赖
2. 在代码中导入使用

---

这个框架为插件开发提供了完整的解决方案，支持快速开发和部署。通过遵循上述指南，你可以轻松开发出功能强大的插件。