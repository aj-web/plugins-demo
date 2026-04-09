# 插件开发 Skills 手册

> 本手册提供插件开发过程中的实用代码片段、最佳实践和常见模式。适合在开发时快速参考和复制。

## 📋 目录

1. [快速开始](#快速开始)
2. [通信封装](#通信封装)
3. [后端节点模板](#后端节点模板)
4. [前端组件模板](#前端组件模板)
5. [工具类封装](#工具类封装)
6. [常用业务模式](#常用业务模式)
7. [调试技巧](#调试技巧)

---

## 快速开始

### 创建新插件脚手架

```bash
# 1. 创建插件目录
mkdir plugins/my-plugin
cd plugins/my-plugin

# 2. 创建目录结构
mkdir -p nodes utils frontend dist

# 3. 创建基础文件
touch manifest.json plugin_host.js
```

### manifest.json 模板

```json
{
  "name": "插件显示名称",
  "version": "1.0.0",
  "description": "插件功能描述",
  "events": [
    {
      "id": "login",
      "class": "LoginNode",
      "method": "startLogin",
      "jsFile": "nodes/login.js"
    },
    {
      "id": "search",
      "class": "SearchNode",
      "method": "startSearch",
      "jsFile": "nodes/search.js"
    }
  ],
  "frontend": {
    "devServerUrl": "http://127.0.0.1:5175",
    "entry": "dist/index.html"
  }
}
```

### plugin_host.js 标准模板

```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

let shouldStop = false;

process.on('message', async (msg) => {
  // 处理停止信号
  if (msg && msg.type === 'stop') {
    shouldStop = true;
    console.log('plugin_host.js received stop');
    return;
  }

  if (msg && msg.jsFile) {
    try {
      // 1. 动态加载模块
      const mod = require('./' + msg.jsFile);
      let result;

      // 2. 实例化类并调用方法
      if (msg.call && msg.call.class && msg.call.method) {
        const Cls = mod[msg.call.class];
        if (!Cls) {
          throw new Error(`Class ${msg.call.class} not found`);
        }

        const instance = new Cls();
        if (typeof instance[msg.call.method] !== 'function') {
          throw new Error(`Method ${msg.call.method} not found`);
        }

        // 3. 执行方法
        result = await instance[msg.call.method](...(msg.call.args || []));
      } else if (msg.call && msg.call.method && typeof mod[msg.call.method] === 'function') {
        result = await mod[msg.call.method](...(msg.call.args || []));
      } else if (typeof mod === 'function') {
        result = await mod(msg.data);
      } else {
        result = mod;
      }

      // 4. 返回结果
      const response = { success: true, result };
      process.send && process.send(response);
    } catch (e) {
      const response = { success: false, error: e.message };
      process.send && process.send(response);
    }
  } else {
    const response = { success: false, error: 'No jsFile specified in message' };
    process.send && process.send(response);
  }
});
```

---

## 通信封装

### 前端通信工具 (ipc.js)

```javascript
// 通用的 IPC 通信封装
let seq = 0;

/**
 * 触发插件后端事件
 * @param {string} eventType - 事件类型（manifest.json 中配置的 id）
 * @param {object} params - 参数对象 { args: [] }
 * @returns {Promise<any>}
 */
export const triggerEvent = async (eventType, params = {}) => {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 600000); // 10分钟超时

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || '未知错误'));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    window.parent.postMessage(
      {
        source: 'plugin-frontend',
        action: 'trigger-event',
        id,
        payload: { eventType, params }
      },
      '*'
    );
  });
};

/**
 * 调用主进程 IPC 方法
 * @param {string} channel - IPC 通道名（必须在 config.json 白名单中）
 * @param {array} args - 参数数组
 * @returns {Promise<any>}
 */
export const invokeIpc = async (channel, args = []) => {
  console.log('[invokeIpc] Calling:', channel, args);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 600000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        console.log('[invokeIpc] Response:', data);
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || '未知错误'));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    window.parent.postMessage(
      {
        source: 'plugin-frontend',
        action: 'ipc-invoke',
        id,
        payload: { channel, args }
      },
      '*'
    );
  });
};
```

### 常用 IPC 调用

```javascript
// 1. 文件选择
const filePath = await invokeIpc('select-file');

// 2. 文件夹选择
const folderPath = await invokeIpc('select-folder');

// 3. 选择文件并转为 Data URL
const { files } = await invokeIpc('select-file-url');
// files: [{ filePath: string, dataUrl: string }]

// 4. 打开文件夹
await invokeIpc('open-folder', [folderPath]);

// 5. 读取 JSON 文件
const result = await invokeIpc('read-json-file', [jsonPath]);
// result: { success: boolean, data: any, error?: string }

// 6. 下载图片为 ZIP
await invokeIpc('download-images-as-zip', [imageList]);
// imageList: [{ url: string, index: number, platform?: string, productTitle?: string }]

// 7. 启动定时任务
await invokeIpc('start-scheduled-task', [{
  pluginName: '插件名',
  eventType: '事件ID',
  params: { args: [] },
  cronExpression: '0 */2 * * *',  // 每2小时
  enabled: true
}]);

// 8. 停止定时任务
await invokeIpc('stop-scheduled-task', [taskKey]);

// 9. 列出定时任务
const { tasks } = await invokeIpc('list-scheduled-tasks');
```

---

## 后端节点模板

### 基础节点类

```javascript
'use strict';

class MyNode {
  constructor() {
    // 初始化资源
    this.config = {};
    console.log('[MyNode] 初始化');
  }

  /**
   * 业务方法
   * @param {string} param1 - 参数1
   * @param {number} param2 - 参数2
   * @returns {Promise<{success: boolean, data?: any, message?: string}>}
   */
  async myMethod(param1, param2) {
    try {
      console.log('[MyNode.myMethod] 开始执行', { param1, param2 });
      
      // 参数验证
      if (!param1) {
        return {
          success: false,
          message: '参数 param1 不能为空'
        };
      }

      // 业务逻辑
      const result = await this.processData(param1, param2);

      console.log('[MyNode.myMethod] 执行成功');
      return {
        success: true,
        data: result,
        message: '执行成功'
      };
    } catch (error) {
      console.error('[MyNode.myMethod] 执行失败:', error);
      return {
        success: false,
        message: error.message || '执行失败'
      };
    }
  }

  async processData(param1, param2) {
    // 具体实现
    return { param1, param2 };
  }
}

exports.MyNode = MyNode;
```

### 浏览器自动化节点

```javascript
'use strict';

const { BrowserManager } = require('../utils/browser-manager');
const { LoginStateUtils } = require('../utils/login-state-utils');

class BrowserNode {
  constructor() {
    this.browserManager = new BrowserManager();
    this.browser = null;
    this.page = null;
  }

  /**
   * 启动浏览器并登录
   */
  async startLogin() {
    try {
      console.log('[BrowserNode] 启动登录流程');

      // 1. 创建浏览器
      this.browser = await this.browserManager.createBrowser();
      this.page = await this.browser.newPage();

      // 2. 打开登录页
      await this.page.goto('https://example.com/login');

      // 3. 等待用户登录
      const loginResult = await LoginStateUtils.waitForLogin(this.page);

      if (!loginResult.success) {
        await this.browser.close();
        return {
          success: false,
          message: '登录失败或超时'
        };
      }

      // 4. 保存 Cookie
      const cookies = await this.page.context().cookies();
      await this.saveCookies(cookies);

      await this.browser.close();

      return {
        success: true,
        message: '登录成功'
      };
    } catch (error) {
      console.error('[BrowserNode] 登录失败:', error);
      if (this.browser) {
        await this.browser.close();
      }
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    try {
      const cookies = await this.loadCookies();
      return {
        success: true,
        data: { isLoggedIn: cookies && cookies.length > 0 }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  async saveCookies(cookies) {
    // Cookie 保存逻辑
  }

  async loadCookies() {
    // Cookie 加载逻辑
    return [];
  }
}

exports.BrowserNode = BrowserNode;
```

### 数据处理节点

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

class DataProcessNode {
  constructor() {
    this.outputDir = null;
  }

  /**
   * 批量处理数据
   * @param {Array<any>} dataList - 数据列表
   * @param {object} config - 处理配置
   */
  async batchProcess(dataList, config) {
    try {
      console.log('[DataProcessNode] 开始批量处理', { count: dataList.length });

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < dataList.length; i++) {
        const item = dataList[i];
        console.log(`[DataProcessNode] 处理进度: ${i + 1}/${dataList.length}`);

        try {
          const result = await this.processSingle(item, config);
          results.push(result);
          successCount++;
        } catch (error) {
          console.error(`[DataProcessNode] 处理第 ${i + 1} 项失败:`, error);
          results.push({
            success: false,
            error: error.message
          });
          failCount++;
        }
      }

      return {
        success: true,
        data: {
          results,
          successCount,
          failCount,
          total: dataList.length
        },
        message: `处理完成：成功 ${successCount} 个，失败 ${failCount} 个`
      };
    } catch (error) {
      console.error('[DataProcessNode] 批量处理失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 处理单个数据
   */
  async processSingle(item, config) {
    // 具体处理逻辑
    return {
      success: true,
      data: item
    };
  }
}

exports.DataProcessNode = DataProcessNode;
```

---

## 前端组件模板

### Vue 3 基础模板

```javascript
const { createApp, ref, computed, onMounted } = window.Vue;

// 导入通信工具
import { triggerEvent, invokeIpc } from './ipc.js';

const App = {
  setup() {
    // 响应式状态
    const loading = ref(false);
    const isLoggedIn = ref(false);
    const selectedFile = ref('');
    const result = ref(null);

    // 计算属性
    const statusText = computed(() => {
      return isLoggedIn.value ? '已登录' : '未登录';
    });

    // 方法
    const handleLogin = async () => {
      loading.value = true;
      try {
        const res = await triggerEvent('login', { args: [] });
        
        if (res && res.success) {
          isLoggedIn.value = true;
          showMessage('登录成功', 'success');
        } else {
          showMessage('登录失败', 'error');
        }
      } catch (error) {
        console.error('登录失败:', error);
        showMessage(error.message, 'error');
      } finally {
        loading.value = false;
      }
    };

    const selectFile = async () => {
      try {
        const filePath = await invokeIpc('select-file');
        if (filePath) {
          selectedFile.value = filePath;
          showMessage('文件选择成功', 'success');
        }
      } catch (error) {
        console.error('文件选择失败:', error);
        showMessage(error.message, 'error');
      }
    };

    const startProcess = async () => {
      if (!isLoggedIn.value) {
        showMessage('请先登录', 'warning');
        return;
      }

      loading.value = true;
      try {
        const res = await triggerEvent('process', {
          args: [selectedFile.value]
        });

        if (res && res.success) {
          result.value = res.data;
          showMessage('处理完成', 'success');
        } else {
          showMessage('处理失败: ' + res.message, 'error');
        }
      } catch (error) {
        console.error('处理失败:', error);
        showMessage(error.message, 'error');
      } finally {
        loading.value = false;
      }
    };

    // 工具方法
    const showMessage = (message, type = 'info') => {
      if (window.ElementPlus && window.ElementPlus.ElMessage) {
        window.ElementPlus.ElMessage({ message, type, duration: 3000 });
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    };

    // 生命周期
    onMounted(async () => {
      console.log('组件已挂载');
      // 检查登录状态
      try {
        const res = await triggerEvent('check-login', { args: [] });
        if (res && res.data && res.data.isLoggedIn) {
          isLoggedIn.value = true;
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    });

    return {
      loading,
      isLoggedIn,
      statusText,
      selectedFile,
      result,
      handleLogin,
      selectFile,
      startProcess
    };
  }
};

// 挂载应用
const app = createApp(App);
if (window.ElementPlus) app.use(window.ElementPlus);
app.mount('#app');
```

### HTML 模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>插件名称</title>
  <!-- Element Plus CSS -->
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
    }
    #app {
      max-width: 1200px;
      margin: 0 auto;
    }
    .section {
      margin-bottom: 24px;
      padding: 20px;
      background: #2a2a2a;
      border-radius: 8px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .row {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>插件名称</h1>

    <!-- 登录区域 -->
    <div class="section">
      <div class="section-title">登录</div>
      <div class="row">
        <el-button 
          @click="handleLogin" 
          type="primary" 
          :loading="loading"
          :disabled="isLoggedIn"
        >
          {{ isLoggedIn ? '已登录' : '点击登录' }}
        </el-button>
        <el-tag :type="isLoggedIn ? 'success' : 'info'">
          {{ statusText }}
        </el-tag>
      </div>
    </div>

    <!-- 文件选择区域 -->
    <div class="section">
      <div class="section-title">文件选择</div>
      <div class="row">
        <el-button @click="selectFile" :disabled="loading">
          选择文件
        </el-button>
        <span v-if="selectedFile">已选择: {{ selectedFile }}</span>
      </div>
    </div>

    <!-- 操作区域 -->
    <div class="section">
      <div class="section-title">操作</div>
      <div class="row">
        <el-button 
          @click="startProcess" 
          type="primary" 
          :loading="loading"
          :disabled="!isLoggedIn || !selectedFile"
        >
          开始处理
        </el-button>
      </div>
    </div>

    <!-- 结果区域 -->
    <div class="section" v-if="result">
      <div class="section-title">结果</div>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>

  <!-- Vue 3 -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <!-- Element Plus -->
  <script src="https://unpkg.com/element-plus"></script>
  <!-- 主脚本 -->
  <script type="module" src="./main.js"></script>
</body>
</html>
```

### Vite 配置模板

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  base: '',  // 重要：使用相对路径
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          // 分离第三方库（可选）
          // vendor: ['vue', 'element-plus']
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5175,  // 与 manifest.json 一致
    strictPort: true
  }
});
```

---

## 工具类封装

### 浏览器管理器

```javascript
// utils/browser-manager.js
'use strict';

const playwright = require('playwright');
const path = require('path');

class BrowserManager {
  constructor() {
    this.chromePath = this.getChromePath();
  }

  getChromePath() {
    // 优先使用环境变量
    if (process.env.CHROME_PATH) {
      return process.env.CHROME_PATH;
    }

    // 查找本地 Chrome
    const possiblePaths = [
      path.join(process.cwd(), 'chromium-1181', 'chrome-win', 'chrome.exe'),
      // 其他可能的路径
    ];

    for (const chromePath of possiblePaths) {
      if (require('fs').existsSync(chromePath)) {
        return chromePath;
      }
    }

    return null;
  }

  async createBrowser(options = {}) {
    const launchOptions = {
      headless: false,
      executablePath: this.chromePath,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      ...options
    };

    console.log('[BrowserManager] 启动浏览器:', launchOptions);

    const browser = await playwright.chromium.launch(launchOptions);
    return browser;
  }

  async createContext(browser, cookies = []) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
    }

    return context;
  }
}

exports.BrowserManager = BrowserManager;
```

### Cookie 管理器

```javascript
// utils/cookie-manager.js
'use strict';

const fs = require('fs');
const path = require('path');

class CookieManager {
  constructor(cookieDir) {
    this.cookieDir = cookieDir || path.join(__dirname, '../cookies');
    this.ensureDir(this.cookieDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getCookieFilePath(platform) {
    return path.join(this.cookieDir, `${platform}_cookies.json`);
  }

  saveCookies(platform, cookies) {
    const filePath = this.getCookieFilePath(platform);
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2), 'utf-8');
    console.log(`[CookieManager] Cookies 已保存: ${filePath}`);
  }

  loadCookies(platform) {
    const filePath = this.getCookieFilePath(platform);
    if (!fs.existsSync(filePath)) {
      console.log(`[CookieManager] Cookie 文件不存在: ${filePath}`);
      return [];
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const cookies = JSON.parse(content);
      console.log(`[CookieManager] Cookies 已加载: ${filePath}`);
      return cookies;
    } catch (error) {
      console.error(`[CookieManager] 加载 Cookies 失败:`, error);
      return [];
    }
  }

  clearCookies(platform) {
    const filePath = this.getCookieFilePath(platform);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[CookieManager] Cookies 已清除: ${filePath}`);
    }
  }

  hasCookies(platform) {
    const filePath = this.getCookieFilePath(platform);
    return fs.existsSync(filePath);
  }
}

exports.CookieManager = CookieManager;
```

### Excel 读取器

```javascript
// utils/excel-reader.js
'use strict';

const XLSX = require('xlsx');

class ExcelReader {
  /**
   * 读取 Excel 文件
   * @param {string} filePath - Excel 文件路径
   * @param {object} options - 选项
   * @returns {Promise<{success: boolean, data?: any[], message?: string}>}
   */
  async readExcel(filePath, options = {}) {
    try {
      console.log('[ExcelReader] 读取文件:', filePath);

      // 读取工作簿
      const workbook = XLSX.readFile(filePath);

      // 获取第一个工作表
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 转换为 JSON
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: options.header || undefined,
        defval: options.defval || '',
        raw: options.raw !== false
      });

      console.log(`[ExcelReader] 读取成功，共 ${data.length} 行`);

      return {
        success: true,
        data,
        message: `成功读取 ${data.length} 行数据`
      };
    } catch (error) {
      console.error('[ExcelReader] 读取失败:', error);
      return {
        success: false,
        message: error.message || '读取 Excel 文件失败'
      };
    }
  }

  /**
   * 写入 Excel 文件
   * @param {string} filePath - 输出文件路径
   * @param {any[]} data - 数据数组
   * @param {object} options - 选项
   */
  async writeExcel(filePath, data, options = {}) {
    try {
      console.log('[ExcelReader] 写入文件:', filePath);

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(data, {
        header: options.header || undefined
      });

      // 添加工作表到工作簿
      const sheetName = options.sheetName || 'Sheet1';
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // 写入文件
      XLSX.writeFile(workbook, filePath);

      console.log('[ExcelReader] 写入成功');

      return {
        success: true,
        message: '写入 Excel 文件成功'
      };
    } catch (error) {
      console.error('[ExcelReader] 写入失败:', error);
      return {
        success: false,
        message: error.message || '写入 Excel 文件失败'
      };
    }
  }
}

exports.ExcelReader = ExcelReader;
```

### 登录状态工具

```javascript
// utils/login-state-utils.js
'use strict';

class LoginStateUtils {
  /**
   * 等待用户登录
   * @param {Page} page - Playwright Page 对象
   * @param {object} options - 配置选项
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  static async waitForLogin(page, options = {}) {
    const {
      loginUrl = '',
      loggedInUrlPattern = null,
      checkSelector = null,
      timeout = 300000,  // 5分钟
      checkInterval = 1000
    } = options;

    console.log('[LoginStateUtils] 等待用户登录...');

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // 方式1: 检查 URL 变化
        if (loggedInUrlPattern) {
          const currentUrl = page.url();
          if (new RegExp(loggedInUrlPattern).test(currentUrl)) {
            console.log('[LoginStateUtils] 登录成功（URL 匹配）');
            return { success: true };
          }
        }

        // 方式2: 检查特定元素
        if (checkSelector) {
          const element = await page.$(checkSelector);
          if (element) {
            console.log('[LoginStateUtils] 登录成功（元素匹配）');
            return { success: true };
          }
        }

        // 方式3: 检查 Cookie
        const cookies = await page.context().cookies();
        if (cookies && cookies.length > 0) {
          // 检查关键 Cookie
          const hasAuthCookie = cookies.some(c => 
            c.name.toLowerCase().includes('auth') ||
            c.name.toLowerCase().includes('session') ||
            c.name.toLowerCase().includes('token')
          );
          if (hasAuthCookie) {
            console.log('[LoginStateUtils] 登录成功（Cookie 检测）');
            return { success: true };
          }
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error('[LoginStateUtils] 检查登录状态时出错:', error);
      }
    }

    console.log('[LoginStateUtils] 登录超时');
    return {
      success: false,
      message: '登录超时，请重试'
    };
  }

  /**
   * 等待页面跳转
   */
  static async waitForNavigation(page, timeout = 30000) {
    try {
      await page.waitForLoadState('networkidle', { timeout });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: '页面加载超时'
      };
    }
  }
}

exports.LoginStateUtils = LoginStateUtils;
```

---

## 常用业务模式

### 模式1: 登录检查 + 业务处理

```javascript
class MyNode {
  async processWithLogin() {
    try {
      // 1. 检查登录状态
      const cookies = await this.cookieManager.loadCookies('platform');
      if (!cookies || cookies.length === 0) {
        return {
          success: false,
          message: '请先登录'
        };
      }

      // 2. 创建浏览器上下文
      const browser = await this.browserManager.createBrowser();
      const context = await this.browserManager.createContext(browser, cookies);
      const page = await context.newPage();

      // 3. 执行业务逻辑
      const result = await this.doBusinessLogic(page);

      // 4. 清理资源
      await browser.close();

      return result;
    } catch (error) {
      console.error('处理失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
```

### 模式2: 批量任务 + 进度反馈

```javascript
async batchProcessWithProgress(items, config) {
  const total = items.length;
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const item = items[i];
    
    // 进度日志
    console.log(`进度: ${i + 1}/${total} (${((i + 1) / total * 100).toFixed(1)}%)`);

    try {
      const result = await this.processSingle(item, config);
      results.push({ ...result, item });
      successCount++;
    } catch (error) {
      console.error(`处理第 ${i + 1} 项失败:`, error);
      results.push({
        success: false,
        error: error.message,
        item
      });
      failCount++;
    }

    // 可选：延迟避免频繁请求
    if (config.delay && i < total - 1) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }
  }

  return {
    success: true,
    data: {
      results,
      successCount,
      failCount,
      total
    }
  };
}
```

### 模式3: 重试机制

```javascript
async retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`尝试 ${attempt}/${maxRetries}...`);
      const result = await operation();
      return result;
    } catch (error) {
      console.error(`尝试 ${attempt} 失败:`, error);
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`操作失败，已重试 ${maxRetries} 次: ${lastError.message}`);
}

// 使用示例
async myMethod() {
  const result = await this.retryOperation(
    async () => {
      // 可能失败的操作
      return await this.unstableOperation();
    },
    3,  // 最多重试 3 次
    2000  // 每次重试间隔 2 秒
  );

  return result;
}
```

### 模式4: 停止信号检查

```javascript
// plugin_host.js 中设置停止标志
let shouldStop = false;
process.on('message', (msg) => {
  if (msg?.type === 'stop') {
    shouldStop = true;
  }
});

// 在节点中检查停止标志
class MyNode {
  async longRunningTask(items) {
    for (let i = 0; i < items.length; i++) {
      // 检查停止标志
      if (shouldStop) {
        console.log('收到停止信号，任务中断');
        return {
          success: false,
          message: '任务已停止',
          processedCount: i
        };
      }

      await this.processItem(items[i]);
    }

    return {
      success: true,
      processedCount: items.length
    };
  }
}
```

### 模式5: 文件下载 + 保存

```javascript
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

async downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      // 确保目录存在
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入文件
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });

      fileStream.on('error', (error) => {
        fs.unlink(outputPath, () => {});
        reject(error);
      });
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('下载超时'));
    });
  });
}
```

---

## 调试技巧

### 1. 日志输出

```javascript
// 在插件后端
console.log('[MyNode] 普通日志');
console.warn('[MyNode] 警告日志');
console.error('[MyNode] 错误日志');

// 带数据的日志
console.log('[MyNode] 处理数据:', JSON.stringify(data, null, 2));

// 在插件前端
console.log('[Frontend] 前端日志');
```

### 2. PostMessage 调试

```javascript
// 在插件前端添加全局监听
window.addEventListener('message', (event) => {
  console.log('[DEBUG] 收到宿主消息:', event.data);
});

// 在 PluginView.vue 中添加日志
console.log('[DEBUG] 发送到插件:', data);
```

### 3. 错误追踪

```javascript
try {
  await riskyOperation();
} catch (error) {
  console.error('错误详情:', {
    message: error.message,
    stack: error.stack,
    context: { /* 上下文信息 */ }
  });
  
  // 返回详细错误信息
  return {
    success: false,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
}
```

### 4. 性能监控

```javascript
async myMethod() {
  const startTime = Date.now();
  
  try {
    const result = await this.doWork();
    const duration = Date.now() - startTime;
    console.log(`[Performance] myMethod 耗时: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Performance] myMethod 失败，耗时: ${duration}ms`);
    throw error;
  }
}
```

### 5. 条件断点

```javascript
// 在关键位置添加条件断点
if (debugCondition) {
  debugger;  // 满足条件时暂停
  console.log('调试信息:', data);
}
```

### 6. 模拟延迟

```javascript
// 模拟网络延迟
async simulateDelay(ms = 1000) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// 使用
await this.simulateDelay(2000);  // 延迟 2 秒
```

---

## 附录: 常用代码片段

### Cron 表达式速查

```bash
# 每分钟
* * * * *

# 每小时
0 * * * *

# 每天 8:00
0 8 * * *

# 每2小时
0 */2 * * *

# 每周一 9:00
0 9 * * 1

# 每月1号 0:00
0 0 1 * *

# 工作日 9:00-18:00 每小时
0 9-18 * * 1-5
```

### package.json 模板

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "main": "plugin_host.js",
  "scripts": {
    "dev": "cd frontend && npm run dev",
    "build": "cd frontend && npm run build"
  },
  "dependencies": {
    "playwright": "^1.40.0",
    "xlsx": "^0.18.5"
  }
}
```

### .gitignore 模板

```
node_modules/
dist/
*.log
.DS_Store
cookies/
temp/
output/
```

---

**手册版本**: v1.0.0  
**最后更新**: 2026-02-10  
**适用系统**: 插件化客户端 v0.3.0+

