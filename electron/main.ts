import { app, ipcMain } from 'electron'
import { setupIpcHandlers } from './ipcHandlers'
import { windowManager } from './window'
import { configManager } from './config'
import TrackerUtil from './tracker-util'
import { pluginManager } from './services/plugin-manager'
import { staticServer } from './static-server'

let tracker: TrackerUtil | null = null

console.log('CWD:', process.cwd())

async function startApp(): Promise<void> {
  console.log('[startApp] called')
  await app.whenReady()
  console.log('[startApp] app ready')
  
  // 启动插件静态服务器（开发/生产都启动，端口动态）
  staticServer.start()
  
  // Tracker 登录上报
  const config = configManager.getConfig()
  
  if (config.tracker?.enabled) {
    tracker = new TrackerUtil()
    ;(global as any).tracker = tracker // 全局挂载
    
    try {
      console.log('Tracker 配置:', tracker.getConfig())
      const loginResult = await tracker.login() // 使用配置文件中的key
      console.log('Tracker 登录成功:', loginResult)
    } catch (e) {
      console.warn('Tracker 登录失败:', e)
    }
  } else {
    console.warn('Tracker 未启用，跳过 Tracker 登录')
  }
  
  setupIpcHandlers()
  
  // 创建主窗口
  windowManager.createMainWindow()
  windowManager.loadContent()
}

// 应用生命周期事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (windowManager.getMainWindow() === null) {
    windowManager.createMainWindow()
    windowManager.loadContent()
  }
})

app.on('before-quit', () => {
  // 清理插件进程
  pluginManager.cleanup()
})

// IPC处理器
ipcMain.handle('get-plugins-status', async () => {
  console.log('[ipcMain.handle] get-plugins-status called')
  const result = pluginManager.getAvailablePlugins()
  console.log('[ipcMain.handle] get-plugins-status result:', result)
  return result
})

startApp() 