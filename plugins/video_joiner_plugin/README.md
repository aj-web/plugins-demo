# 插件开发者对接指南

本指南面向所有希望为本平台开发插件的开发者，详细说明插件的目录结构、manifest.json规范、前端与主框架的对接方式，以及开发注意事项。

---

## 1. 插件目录结构规范

每个插件应放置于APP的 `plugins/` 目录下的独立子目录，打包解压后推荐结构如下：

```
plugins/
  your_plugin_name/
    manifest.json           # 插件元信息与事件声明
    plugin_host.js          # 插件后端主进程入口（必需）
    frontend/
      index.html            # 插件前端页面（必需）
      main.js               # 插件前端主逻辑（必需）
    nodes/                  # 业务逻辑节点（可选，推荐）
    utils/ types/ ...       # 其它自定义目录
    node_modules/           # 插件私有依赖（推荐）
```

---

## 2. manifest.json 规范

manifest.json 用于声明插件元信息和所有可对接的业务事件。示例：

```json
{
  "id": "com.example.demo-plugin",
  "name": "Demo Plugin",
  "version": "1.0.0",
  "description": "演示插件",
  "author": "Your Name",
  "events": [
    {
      "id": "analyze-folders",
      "name": "分析文件夹",
      "description": "分析文件夹业务",
      "jsFile": "nodes/analyze.js",
      "class": "AnalyzeNode",
      "method": "analyzeFolders"
    },
    {
      "id": "process-tasks",
      "name": "处理任务",
      "description": "处理任务业务",
      "jsFile": "nodes/processor.js",
      "class": "ProcessorNode",
      "method": "processTasks"
    }
  ]
}
```
- `events` 数组每一项声明一个可被主框架调用的业务事件。
- 每个事件需指定 jsFile、class、method，主框架会自动路由。

---

## 3. 前端页面与主框架对接

### 3.1 页面入口
- 插件前端页面入口为 `frontend/index.html`，主框架会自动加载。
- 主逻辑建议写在 `frontend/main.js`，并在 index.html 里通过 `<script src="main.js" data-plugin="your_plugin_name"></script>` 引入。

### 3.2 事件调用方式
- 通过 `window.electronAPI.eventBus.trigger(eventType, params, pluginName)` 调用主框架事件分发。
- **pluginName 必须传递，建议通过 script 标签的 data-plugin 属性动态获取。**

#### 示例：
```js
const pluginName = document.currentScript.getAttribute('data-plugin');
const result = await window.electronAPI.eventBus.trigger('analyze-folders', { args: [folderPath] }, pluginName);
```

### 3.3 典型业务流程
1. 用户在前端页面选择文件夹/文件。
2. 前端通过 eventBus.trigger 调用后端业务节点（如 analyze-folders）。
3. 处理结果通过 Promise 返回，前端渲染到页面。
4. 需要停止处理时，调用 `eventBus.trigger('stop-processing', {}, pluginName)`。

---

## 4. 插件后端业务节点开发

- 每个业务节点建议为一个 class，导出为 `module.exports = { YourClassName }`。
- 必须与 manifest.json 里 class、method 保持一致。
- 业务节点文件路径以插件目录为根（如 `nodes/your-node.js`）。
- 支持异步方法（async/await）。

---

## 5. 与主框架通信注意事项

- **所有业务事件必须在 manifest.json 里声明，未声明的事件无法被调用。**
- pluginName 必须唯一，建议与目录名一致。
- 插件依赖请放在插件自己的 node_modules 下，避免与主框架冲突。
- 不要在 preload.js 里直接 require('fs') 等 Node.js API，所有文件操作应由主进程完成。
- 前端与主进程通信统一通过 `window.electronAPI.eventBus.trigger`。

---

## 6. 常见问题与调试建议

- 插件入口不显示：请检查 plugin_host.js 是否存在，目录名是否正确。
- 事件调用无响应：请检查 manifest.json 事件声明、jsFile 路径、class/method 是否正确。
- 控制台报错：请用 F12 打开开发者工具，查看详细报错信息。
- 多插件并行：每个插件的 pluginName 必须唯一，事件调用时必须传递。

---

## 7. 参考示例

请参考 `plugins/video_joiner_plugin` 目录下的完整实现。

---

如有更多问题，请联系主框架维护者或查阅平台文档。 