import { ipcMain, dialog } from 'electron';
import { pluginManager } from './services/plugin-manager';
import { scheduler } from './services/scheduler';
import pathManager from '../utils/path-manager';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { staticServer } from './static-server';
import { configManager } from './config';
import { activationService } from './services/activation';
import { eventTrackingService } from './services/event-tracking';

const dynamicAllowlist = new Set<string>();

// 复用的文件转 data URL 工具
const mimeMap: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
};

const filePathToDataUrl = async (filePath: string): Promise<string> => {
  if (!filePath) return '';
  const localPath = filePath.startsWith('file://') ? filePath.replace(/^file:\/\//, '') : filePath;
  const buffer = await fs.promises.readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mime = mimeMap[ext] || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
};

export function setupIpcHandlers(): void {
  console.log('[ipcHandlers] Setting up IPC handlers');

  // 初始化 allowlist - 简化版本，不需要动态监听
  const allowlist = configManager.getIpcAllowlist();
  allowlist.forEach((c) => dynamicAllowlist.add(c));
  console.log('[ipcHandlers] IPC allowlist initialized:', Array.from(dynamicAllowlist));

  ipcMain.handle('get-ipc-allowlist', async () => {
    return Array.from(dynamicAllowlist);
  });

  ipcMain.handle('activation:get-status', async () => {
    return { success: true, data: activationService.getStatus() };
  });

  ipcMain.handle('activation:activate', async (event, key: string) => {
    try {
      const result = await activationService.activate(key);
      return { success: result.success, data: result, message: result.message };
    } catch (error) {
      console.error('[ipcHandlers] activation:activate error:', error);
      return { success: false, data: null, message: error instanceof Error ? error.message : '激活失败' };
    }
  });

  ipcMain.handle('activation:get-user-id', async () => {
    return { success: true, data: { userId: activationService.getUserId() } };
  });

  ipcMain.handle('event-tracking:track-click', async (event, payload: { eventName: string; pageName: string }) => {
    console.log('[ipcHandlers] event-tracking:track-click called:', payload);
    try {
      const result = await eventTrackingService.trackClick(payload);
      console.log('[ipcHandlers] event-tracking:track-click result:', result);
      return { success: result.success, data: result.data, message: result.message };
    } catch (error) {
      console.error('[ipcHandlers] event-tracking:track-click error:', error);
      return { success: false, data: null, message: error instanceof Error ? error.message : '埋点上报失败' };
    }
  });

  ipcMain.handle('select-file', async () => {
    console.log('[ipcHandlers] select-file called');
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[ipcHandlers] select-file result:', result.filePaths[0]);
      return result.filePaths[0];
    }
    return '';
  });

  ipcMain.handle('select-file-url', async () => {
    console.log('[ipcHandlers] select-file-url called');
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[ipcHandlers] select-file-url result:', result.filePaths);
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          try {
            const dataUrl = await filePathToDataUrl(filePath);
            return { filePath, dataUrl };
          } catch (error) {
            console.error('[ipcHandlers] select-file-url read error:', error);
            return { filePath, dataUrl: '' };
          }
        })
      );
      return { files };
    }
    return { files: [] };
  });

  ipcMain.handle('select-folder', async () => {
    console.log('[ipcHandlers] select-folder called');
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[ipcHandlers] select-folder result:', result.filePaths[0]);
      return result.filePaths[0];
    }
    return '';
  });

  ipcMain.handle('get-plugin-dirs', async () => {
    console.log('[ipcHandlers] get-plugin-dirs called');
    const result = pathManager.getAvailablePlugins();
    console.log('[ipcHandlers] get-plugin-dirs result:', result);
    return result;
  });

  ipcMain.handle('start-plugin-process', async (event, pluginName: string) => {
    console.log('[ipcHandlers] start-plugin-process called with pluginName:', pluginName);
    try {
      const manifest = await pluginManager.getManifest(pluginName);
      console.log('[ipcHandlers] start-plugin-process success, manifest:', manifest);
      return { success: true, manifest };
    } catch (error) {
      console.error('[ipcHandlers] start-plugin-process error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('trigger-event', async (event, pluginName: string, eventType: string, params: any = {}) => {
    console.log('[ipcHandlers] trigger-event called with:', { pluginName, eventType, params });
    try {
      const result = await pluginManager.triggerEvent(pluginName, eventType, params);
      console.log('[ipcHandlers] trigger-event success, result:', result);
      return result;
    } catch (error) {
      console.error('[ipcHandlers] trigger-event error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('get-plugin-resource-path', async (event, pluginName: string) => {
    console.log('[ipcHandlers] get-plugin-resource-path called with pluginName:', pluginName);
    const resourcePath = pathManager.getPluginResourcePath(pluginName);
    console.log('[ipcHandlers] get-plugin-resource-path success, resourcePath:', resourcePath);
    return resourcePath;
  });

  ipcMain.handle('get-plugin-http-url', async (event, pluginName: string, subPath: string = 'dist/index.html') => {
    console.log('[ipcHandlers] get-plugin-http-url called with:', { pluginName, subPath });

    // 使用新的映射获取方法
    const actualPluginName = pluginManager.getActualPluginName(pluginName);
    console.log('[ipcHandlers] get-plugin-http-url actualPluginName:', actualPluginName);

    const base = staticServer.getBaseUrl();
    const url = `${base}/${actualPluginName}/${subPath}`;
    console.log('[ipcHandlers] get-plugin-http-url result:', url);
    return url;
  });

  ipcMain.handle('check-file-exists', async (event, filePath: string) => {
    console.log('[ipcHandlers] check-file-exists called with filePath:', filePath);
    try {
      // 将 file:// URL 转换为本地路径
      const localPath = filePath.replace(/^file:\/\//, '');
      const exists = fs.existsSync(localPath);
      console.log('[ipcHandlers] check-file-exists result:', exists);
      return exists;
    } catch (error) {
      console.error('[ipcHandlers] check-file-exists error:', error);
      return false;
    }
  });

  ipcMain.handle('open-folder', async (event, folderPath: string) => {
    console.log('[ipcHandlers] open-folder called with folderPath:', folderPath);
    try {
      const { shell } = require('electron');
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      console.error('[ipcHandlers] open-folder error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('read-json-file', async (event, filePath: string) => {
    try {
      // 解析特殊路径格式
      let actualPath = filePath;

      if (filePath.startsWith('appdata://')) {
        const relativePath = filePath.replace('appdata://', '');
        const appDataPath =
          process.env.APPDATA || (process.platform === 'darwin' ? path.join(require('os').homedir(), 'Library', 'Application Support') : path.join(require('os').homedir(), '.config'));
        actualPath = path.join(appDataPath, relativePath);
      }

      if (!fs.existsSync(actualPath)) {
        console.log('[ipcHandlers] read-json-file file not exists:', actualPath);
        return { success: false, data: null, error: '文件不存在' };
      }

      const content = fs.readFileSync(actualPath, 'utf-8');
      if (!content.trim()) {
        return { success: true, data: { version: '1.0', tasks: [] }, error: null };
      }

      const data = JSON.parse(content);
      return { success: true, data, error: null };
    } catch (error) {
      console.error('[ipcHandlers] read-json-file error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('start-scheduled-task', async (event, config) => {
    console.log('[ipcHandlers] start-scheduled-task called with config:', config);
    try {
      const result = scheduler.startPluginScheduledTask(config);
      return result;
    } catch (error) {
      console.error('[ipcHandlers] start-scheduled-task error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('stop-scheduled-task', async (event, taskKey: string) => {
    console.log('[ipcHandlers] stop-scheduled-task called with taskKey:', taskKey);
    return scheduler.stopTask(taskKey);
  });

  ipcMain.handle('list-scheduled-tasks', async () => {
    console.log('[ipcHandlers] list-scheduled-tasks called');
    return { success: true, tasks: scheduler.listTasks() };
  });

  // ZIP打包下载API
  ipcMain.handle('download-images-as-zip', async (event, images: Array<{ url: string; index: number; platform?: string; productTitle?: string }>) => {
    console.log('[ipcHandlers] download-images-as-zip called with images count:', images.length);
    console.log('[ipcHandlers] download-images-as-zip images data:', images);

    try {
      // 选择保存位置
      const result = await dialog.showSaveDialog({
        title: '保存ZIP文件',
        defaultPath: `淘宝好评图片_${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP文件', extensions: ['zip'] }]
      });

      if (result.canceled || !result.filePath) {
        console.log('[ipcHandlers] download-images-as-zip canceled by user');
        return { success: false, error: '用户取消了保存' };
      }

      const zipPath = result.filePath;
      console.log('[ipcHandlers] download-images-as-zip saving to:', zipPath);

      // 创建ZIP文件
      const output = fs.createWriteStream(zipPath);
      const archiver = require('archiver');
      const archive = archiver('zip', {
        zlib: { level: 9 } // 设置压缩级别
      });

      // 监听ZIP创建完成
      const zipPromise = new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log('[ipcHandlers] download-images-as-zip completed, total bytes:', archive.pointer());
          resolve({ success: true, filePath: zipPath });
        });

        archive.on('error', (err: Error) => {
          console.error('[ipcHandlers] download-images-as-zip archive error:', err);
          reject(err);
        });
      });

      // 连接输出流
      archive.pipe(output);

      // 下载并添加图片到ZIP
      let processed = 0;
      const total = images.length;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          console.log('[ipcHandlers] download-images-as-zip processing image:', image.url);
          console.log('[ipcHandlers] download-images-as-zip image data:', image);

          // 下载图片
          const imageBuffer = await downloadImage(image.url);

          // 命名：{平台}-{简化标题}-{序号}.jpg
          const platform = (image.platform || '').toString().trim() || '未知平台';
          const rawTitle = (image.productTitle || '').toString().trim() || '未命名商品';
          const sanitizedTitle = rawTitle
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .slice(0, 40)
            .trim();
          const seq = String(i + 1).padStart(Math.max(2, String(images.length).length), '0');
          const fileName = `${platform}-${sanitizedTitle}-${seq}.jpg`;

          // 直接添加到ZIP根目录
          archive.append(imageBuffer, { name: fileName });

          processed++;
          console.log('[ipcHandlers] download-images-as-zip progress:', processed, '/', total, 'filename:', fileName);
        } catch (error) {
          console.error('[ipcHandlers] download-images-as-zip image download error:', error);
          processed++;
          // 继续处理其他图片，不中断整个流程
        }
      }

      // 完成ZIP创建
      await archive.finalize();

      const zipResult = await zipPromise;
      console.log('[ipcHandlers] download-images-as-zip success:', zipResult);
      return zipResult;
    } catch (error) {
      console.error('[ipcHandlers] download-images-as-zip error:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });
}

// 下载图片的辅助函数
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('下载超时'));
    });
  });
}
