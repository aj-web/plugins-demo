const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const extract = require('extract-zip');
const { setupIpcHandlers } = require('./ipcHandlers');

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
let mainWindow = null;

console.log('CWD:', process.cwd(), 'pluginsDir:', pluginsDir);

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
  const files = fs.readdirSync(pluginsDir);
  const plugins = [];
  console.log('[scanPlugins] files:', files);
  for (const file of files) {
    const fullPath = path.join(pluginsDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (fs.existsSync(path.join(fullPath, 'plugin_host.js'))) {
        plugins.push({ name: file, status: 'ready' });
      }
    }
  }
  console.log('[scanPlugins] plugins:', plugins);
  return plugins;
}

async function asyncUnzipAll(onUnzipDone) {
  const files = fs.readdirSync(pluginsDir);
  console.log('[asyncUnzipAll] files:', files);
  for (const file of files) {
    if (file.endsWith('.zip')) {
      const pluginName = file.replace(/\.zip$/, '');
      const zipPath = path.join(pluginsDir, file);
      const destDir = path.join(pluginsDir, pluginName);
      if (!fs.existsSync(destDir)) {
        extract(zipPath, { dir: destDir })
          .then(() => {
            if (mainWindow) {
              mainWindow.webContents.send('plugin-unzipped', pluginName);
            }
            if (onUnzipDone) onUnzipDone(pluginName);
          });
  }
    }
  }
}

function startApp() {
  console.log('[startApp] called');
  app.whenReady().then(() => {
    console.log('[startApp] app ready');
    setupIpcHandlers();
    createMainWindow();
    asyncUnzipAll();
});
}

ipcMain.handle('get-plugins-status', async () => {
  console.log('[ipcMain.handle] get-plugins-status called');
  const result = scanPlugins();
  console.log('[ipcMain.handle] get-plugins-status result:', result);
  return result;
    });

startApp();