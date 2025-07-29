# Video Joiner Plugin

专业的视频拼接插件，支持多格式视频文件的上传、分析、拼接处理。基于 Electron 插件框架，前端与 Node 代码完全解耦，支持自动节点注册与单元测试。

## 项目结构

```
video_joiner_plugin_new/
├── manifest.json              # 插件描述与节点注册
├── package.json               # 依赖与脚本
├── README.md                  # 项目说明
├── src/
│   ├── docs/                  # 开发与API文档
│   ├── frontend/              # 前端页面与入口(main.ts, index.html)
│   ├── nodes/                 # 所有节点实现（每个节点一个文件）
│   ├── scripts/               # 构建、开发、打包脚本
│   ├── tests/                 # 单元测试
│   ├── types/                 # TypeScript 类型定义
│   └── utils/                 # 工具函数
├── tsconfig.json              # TypeScript 配置
├── webpack.config.js          # 前端构建配置
└── ...
```

## 快速开始

```bash
npm install
npm run dev         # 开发模式，自动构建前端
npm run build       # 构建前端
npm run package     # 打包为zip
npm test            # 运行全部单元测试
```

## 插件开发思路

- **前端**：只负责 UI 展示与参数收集，通过 `window.electronAPI` 与主进程通信。
- **Node 业务**：所有节点代码仅在主进程/Node 环境下运行，前端绝不直接 import Node-only 模块。
- **节点注册**：所有节点在 `manifest.json` 注册，主进程自动加载。
- **测试**：每个节点配套单元测试，mock/真实实现可切换。

## 常用脚本说明

| 指令            | 说明                                 |
|-----------------|--------------------------------------|
| npm run dev     | 开发模式，自动构建前端               |
| npm run build   | 构建前端到 dist                      |
| npm run package | 打包 dist 目录为 zip                 |
| npm run clean   | 清理 dist 目录                       |
| npm run lint    | 代码风格检查                         |
| npm test        | 运行全部单元测试                     |

## 详细开发规范

详见 [DEVELOPMENT.md](./src/docs/DEVELOPMENT.md)

## License

MIT License