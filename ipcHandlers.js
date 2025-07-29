const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { BrowserWindow } = require('electron');
const pathManager = require('./utils/path-manager');

const pluginProcesses = new Map();
const manifestCache = new Map(); // For caching manifest.json

async function getManifest(pluginName) {
  if (manifestCache.has(pluginName)) {
    return manifestCache.get(pluginName);
  }
  const manifestPath = pathManager.getPluginManifestPath(pluginName);
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
    const entry = pathManager.getPluginHostPath(pluginName);
    if (!fs.existsSync(entry)) {
      throw new Error('No plugin_host.js found');
    }
    
    // 设置 FFmpeg 路径环境变量
    const env = { ...process.env };
    const ffmpegPath = pathManager.getFfmpegPath();
    if (ffmpegPath) {
      env.FFMPEG_PATH = ffmpegPath;
      console.log('Found FFmpeg at:', ffmpegPath);
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
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
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
    return pathManager.getAvailablePlugins();
  });

  ipcMain.handle('start-plugin-process', async (event, pluginName) => {
    if (pluginProcesses.has(pluginName)) {
      return { success: true, pid: pluginProcesses.get(pluginName).pid };
    }
    const entry = pathManager.getPluginHostPath(pluginName);
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
      return pathManager.getPluginResourcePath(pluginName);
    } catch (error) {
      console.error('Error getting plugin resource path:', error);
      return null;
    }
  });

  // 新增：获取环境信息（用于调试）
  ipcMain.handle('get-environment-info', async () => {
    return pathManager.getEnvironmentInfo();
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