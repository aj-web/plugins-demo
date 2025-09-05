插件通信框架使用指南
====================

概述
----
插件前端通过 iframe 沙箱运行，无法直接访问宿主页面的 window.electronAPI。因此使用 postMessage 作为通信桥梁，通过宿主页面转发到主进程。

通信方式分为两种：
1. trigger-event：调用插件自己的节点事件
2. ipc-invoke：调用宿主提供的通用 IPC 功能

整体架构
--------
插件前端 iframe（沙箱） ↔ postMessage ↔ 宿主页面 PluginView.vue（有 electronAPI） ↔ 主进程

一、trigger-event 通信流程
========================

用途：调用插件自己定义的节点事件，执行插件业务逻辑

1. 插件前端发送请求
```javascript
// 生成唯一请求ID
const requestId = Date.now() + Math.random();

// 发送 trigger-event 请求
window.parent.postMessage({
  source: 'plugin-frontend',
  action: 'trigger-event',
  id: requestId,
  payload: {
    eventType: 'image-search',  // 事件类型，对应 manifest.json 中的 id
    params: {
      args: [filePath, skuId]   // 方法参数数组
    }
  }
}, '');
```

2. 宿主页面处理
```javascript
// PluginView.vue 监听到消息后
if (message.action === 'trigger-event') {
  // 调用主进程的 triggerEvent 方法
  const result = await window.electronAPI.triggerEvent(
    pluginName,           // 插件名称
    message.payload.eventType,  // 事件类型
    message.payload.params      // 参数对象
  );
  
  // 回包给插件
  window.postMessage({
    source: 'host',
    id: message.id,
    success: true,
    result: result
  }, '*');
}
```

3. 主进程路由执行
```javascript
// 主进程根据 manifest.json 路由到对应节点
{
  "id": "image-search",
  "class": "ImageSearchNode",
  "method": "runSearch",
  "jsFile": "nodes/image-search.js"
}

// 创建节点实例并调用方法
const instance = new ImageSearchNode();
const result = await instance.runSearch(filePath, skuId);
```

4. 插件前端接收结果
```javascript
// 监听一次性消息，匹配请求ID
const handleMessage = (event) => {
  if (event.data.source === 'host' && event.data.id === requestId) {
    if (event.data.success) {
      console.log('执行成功:', event.data.result);
    } else {
      console.error('执行失败:', event.data.error);
    }
    // 移除监听器
    window.removeEventListener('message', handleMessage);
  }
};

window.addEventListener('message', handleMessage);
```

二、ipc-invoke 通信流程
======================

用途：调用宿主提供的通用 IPC 功能，如文件选择、系统对话框等

1. 插件前端发送请求
```javascript
// 生成唯一请求ID
const selectId = Date.now() + Math.random();

// 发送 ipc-invoke 请求
window.parent.postMessage({
  source: 'plugin-frontend',
  action: 'ipc-invoke',
  id: selectId,
  payload: {
    channel: 'select-file',  // IPC 通道名称
    args: []                 // 通道参数
  }
}, '');
```

2. 宿主页面处理
```javascript
// PluginView.vue 监听到消息后
if (message.action === 'ipc-invoke') {
  // 检查通道白名单
  const allowedChannels = ['select-file', 'show-message-box', 'get-app-version'];
  
  if (allowedChannels.includes(message.payload.channel)) {
    // 调用对应的 IPC 方法
    const result = await window.electronAPI.invoke(
      message.payload.channel,
      ...message.payload.args
    );
    
    // 回包给插件
    window.postMessage({
      source: 'host',
      id: message.id,
      success: true,
      result: result
    }, '*');
  } else {
    // 通道不在白名单中
    window.postMessage({
      source: 'host',
      id: message.id,
      success: false,
      error: '通道未授权'
    }, '*');
  }
}
```

3. 主进程执行 IPC
```javascript
// 主进程处理 IPC 调用
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '文本文件', extensions: ['txt'] }]
  });
  return result.filePaths[0];
});
```

4. 插件前端接收结果
```javascript
// 监听一次性消息
const handleSelectResult = (event) => {
  if (event.data.source === 'host' && event.data.id === selectId) {
    if (event.data.success) {
      const filePath = event.data.result;
      console.log('选择的文件:', filePath);
      // 继续处理文件...
    } else {
      console.error('选择文件失败:', event.data.error);
    }
    window.removeEventListener('message', handleSelectResult);
  }
};

window.addEventListener('message', handleSelectResult);
```

两种方式的区别对比
==================

| 特性 | trigger-event | ipc-invoke |
|------|---------------|------------|
| 用途 | 执行插件业务逻辑 | 调用系统通用功能 |
| 目标 | 插件自己的节点 | 宿主提供的 IPC 通道 |
| 参数 | 业务参数（args 数组） | IPC 通道参数 |
| 执行环境 | plugin_host.js 子进程 | 主进程 |
| 返回值 | 业务执行结果 | IPC 调用结果 |
| 安全性 | 完全可控 | 需要白名单验证 |

使用场景示例
============

场景1：图片搜索（使用 trigger-event）
```javascript
// 1. 先选择图片文件
const filePath = await invokeIPC('select-file');

// 2. 执行图片搜索
const searchResult = await triggerEvent('image-search', {
  args: [filePath, skuId]
});
```

场景2：批量下载（使用 trigger-event）
```javascript
// 执行下载任务
const downloadResult = await triggerEvent('batch-download', {
  args: [imageUrls, downloadPath, options]
});
```

场景3：显示消息框（使用 ipc-invoke）
```javascript
// 显示确认对话框
const result = await invokeIPC('show-message-box', {
  type: 'question',
  title: '确认',
  message: '是否继续下载？'
});
```

最佳实践
========

1. **参数传递**
   - trigger-event 使用 args 数组传递方法参数
   - ipc-invoke 使用 args 数组传递 IPC 参数

2. **错误处理**
   - 始终检查 success 字段
   - 使用 try-catch 包装异步调用

3. **资源管理**
   - 及时移除消息监听器
   - 避免内存泄漏

4. **调试技巧**
   - 在宿主页面添加日志
   - 检查浏览器控制台输出

安全考虑
========

1. **白名单机制**：ipc-invoke 只允许预定义的通道
2. **参数验证**：在插件节点中验证输入参数
3. **沙箱隔离**：iframe 无法访问宿主环境
4. **数据序列化**：只传递可序列化的数据

总结
----
- **trigger-event**：用于插件内部业务逻辑，完全可控
- **ipc-invoke**：用于系统功能调用，需要白名单授权
- 两种方式都通过 postMessage 桥接，确保安全隔离
- 插件开发者只需要关注业务逻辑，通信细节由框架处理