const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { BrowserWindow } = require('electron');

const pluginProcesses = new Map();
const manifestCache = new Map(); // For caching manifest.json

// 添加打包后的插件路径检测
const getPluginsDir = () => {
  // 开发环境：使用项目根目录的 plugins
  const devPluginsDir = path.join(__dirname, 'plugins');
  if (fs.existsSync(devPluginsDir)) {
    return devPluginsDir;
  }
  
  // 打包环境：使用 resources/plugins
  const prodPluginsDir = path.join(process.resourcesPath, 'plugins');
  if (fs.existsSync(prodPluginsDir)) {
    return prodPluginsDir;
  }
  
  return devPluginsDir; // 默认返回
};

const pluginsDir = getPluginsDir();

async function getManifest(pluginName) {
  if (manifestCache.has(pluginName)) {
    return manifestCache.get(pluginName);
  }
  const manifestPath = path.join(pluginsDir, pluginName, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  manifestCache.set(pluginName, manifest);
  return manifest;
}

async function triggerEvent(pluginName, eventType, params = {}) {
  const manifest = await getManifest(pluginName);
  const eventRoute = (manifest.events || []).find(e => e.id === eventType);
  if (!eventRoute) throw new Error('event not found in manifest');
  if (eventType === 'stop-processing') {
    const child = pluginProcesses.get(pluginName);
    if (child) {
      child.send({ type: 'stop' });
      return { success: true };
    }
    return { success: false, error: 'No plugin process' };
  }
  const callData = {
    class: eventRoute.class,
    method: eventRoute.method,
    args: params.args || []
  };
  const data = { ...params, call: callData };
  let child = pluginProcesses.get(pluginName);
  if (!child) {
    const pluginDir = path.join(pluginsDir, pluginName);
    const entry = path.join(pluginDir, 'plugin_host.js');
    if (!fs.existsSync(entry)) {
      throw new Error('No plugin_host.js found');
    }
    
    // 设置 FFmpeg 路径环境变量
    const env = { ...process.env };
    // 尝试找到 FFmpeg 可执行文件
    const possibleFfmpegPaths = [
      path.join(process.resourcesPath || '', 'ffmpeg.exe'),
      path.join(__dirname, 'ffmpeg.exe'),
      path.join(process.cwd(), 'ffmpeg.exe')
    ];
    
    for (const ffmpegPath of possibleFfmpegPaths) {
      if (fs.existsSync(ffmpegPath)) {
        env.FFMPEG_PATH = ffmpegPath;
        console.log('Found FFmpeg at:', ffmpegPath);
        break;
      }
    }
    
    child = fork(entry, [], { env });
    pluginProcesses.set(pluginName, child);
    child.on('message', (msg) => {
      if (msg && msg.type === 'stopped') {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('business-stopped');
        }
      }
    });
    child.on('exit', (code) => {
      pluginProcesses.delete(pluginName);
    });
  }
  return await sendToPluginProcess(child, { jsFile: eventRoute.jsFile, ...data });
}

function setupIpcHandlers() {
  ipcMain.handle('read-txt', async (event, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (e) {
      return '读取失败: ' + e.message;
    }
  });

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [ { name: 'Text Files', extensions: ['txt'] } ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return '';
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return '';
  });

  ipcMain.handle('get-plugin-dirs', async () => {
    const pluginsRoot = pluginsDir;
    try {
      const dirs = fs.readdirSync(pluginsRoot, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      return dirs;
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('start-plugin-process', async (event, pluginName) => {
    if (pluginProcesses.has(pluginName)) {
      return { success: true, pid: pluginProcesses.get(pluginName).pid };
    }
    const pluginDir = path.join(pluginsDir, pluginName);
    const entry = path.join(pluginDir, 'plugin_host.js');
    if (!fs.existsSync(entry)) {
      return { success: false, error: 'No plugin_host.js found' };
    }
    const child = fork(entry);
    pluginProcesses.set(pluginName, child);
    child.on('message', (msg) => {
      if (msg && msg.type === 'stopped') {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('business-stopped');
        }
      }
    });
    child.on('exit', (code) => {
      pluginProcesses.delete(pluginName);
    });
    return { success: true, pid: child.pid };
  });

  ipcMain.handle('stop-business', async (event, pluginName) => {
    const child = pluginProcesses.get(pluginName);
    if (child) {
      child.send({ type: 'stop' });
      return { success: true };
    }
    return { success: false, error: 'No plugin process' };
  });

  ipcMain.handle('trigger-event', async (event, pluginName, eventType, params) => {
    try {
      return await triggerEvent(pluginName, eventType, params);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-plugin-resource-path', async (event, pluginName) => {
    try {
      // 检查开发环境
      const devPluginPath = path.join(__dirname, 'plugins', pluginName);
      if (fs.existsSync(devPluginPath)) {
        return `./plugins/${pluginName}`;
      }
      
      // 检查打包环境
      const prodPluginPath = path.join(process.resourcesPath, 'plugins', pluginName);
      if (fs.existsSync(prodPluginPath)) {
        // 在打包环境中，我们需要返回一个特殊的协议路径
        return `file://${prodPluginPath.replace(/\\/g, '/')}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting plugin resource path:', error);
      return null;
    }
  });
}

function sendToPluginProcess(child, data) {
  return new Promise((resolve, reject) => {
    child.once('message', (result) => {
      resolve(result);
    });
    child.once('error', (err) => {
      reject(err);
    });
    child.send(data);
  });
}

module.exports = { setupIpcHandlers }; 