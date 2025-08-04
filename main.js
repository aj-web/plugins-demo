const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const extract = require('extract-zip');
const { setupIpcHandlers } = require('./ipcHandlers');
const pathManager = require('./utils/path-manager');
const TrackerUtil = require('./tracker_util');

let mainWindow = null;
let tracker = null;

console.log('CWD:', process.cwd(), 'pluginsDir:', pathManager.getPluginsDir());

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
}

function scanPlugins() {
  return pathManager.getAvailablePlugins().map(pluginName => ({
    name: pluginName,
    status: 'ready'
  }));
}

function getConfigKey() {
  // 从 config.json 读取 key
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
        try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.key || '';
    } catch (e) {
      console.warn('读取 config.json 失败:', e);
      return '';
      }
      }
  return '';
}

function startApp() {
  console.log('[startApp] called');
  app.whenReady().then(async () => {
    console.log('[startApp] app ready');
    // Tracker 登录上报
    const key = getConfigKey();
    tracker = new TrackerUtil();
    global.tracker = tracker; // 全局挂载
    if (key) {
      try {
        const loginResult = await tracker.login(key);
        console.log('Tracker 登录成功:', loginResult);
      } catch (e) {
        console.warn('Tracker 登录失败:', e);
      }
    } else {
      console.warn('未在 config.json 中找到 key，跳过 Tracker 登录');
    }
    setupIpcHandlers();
    createMainWindow();
  });
  }

ipcMain.handle('get-plugins-status', async () => {
  console.log('[ipcMain.handle] get-plugins-status called');
  const result = scanPlugins();
  console.log('[ipcMain.handle] get-plugins-status result:', result);
  return result;
    });

startApp();