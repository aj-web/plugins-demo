import { app, ipcMain } from 'electron'
import { setupIpcHandlers } from './ipcHandlers'
import { windowManager } from './window'
import { configManager } from './config'
import TrackerUtil from './tracker-util'
import { pluginManager } from './services/plugin-manager'
import { staticServer } from './static-server'
import { logger } from './logger'

let tracker: TrackerUtil | null = null

// 添加详细的启动日志
logger.log('=== 应用启动开始 ===')
logger.log('CWD:', process.cwd())
logger.log('NODE_ENV:', process.env.NODE_ENV)
logger.log('isPackaged:', app.isPackaged)
logger.log('app.getAppPath():', app.getAppPath())
logger.log('app.getPath(userData):', app.getPath('userData'))
logger.log('process.resourcesPath:', process.resourcesPath)
logger.log('__dirname:', __dirname)

async function startApp(): Promise<void> {
  logger.log('[startApp] 开始启动应用')
  
  try {
    logger.log('[startApp] 等待应用准备就绪...')
    await app.whenReady()
    logger.log('[startApp] 应用已准备就绪')
    
    // 启动插件静态服务器
    logger.log('[startApp] 启动插件静态服务器...')
    staticServer.start()
    logger.log('[startApp] 插件静态服务器已启动')
    
    // Tracker 登录上报
    logger.log('[startApp] 读取配置文件...')
    const config = configManager.getConfig()
    logger.log('[startApp] 配置文件内容:', config)
    
    if (config.tracker?.enabled) {
      logger.log('[startApp] 初始化 Tracker...')
      tracker = new TrackerUtil()
      ;(global as any).tracker = tracker
      
      try {
        logger.log('[startApp] Tracker 配置:', tracker.getConfig())
        const loginResult = await tracker.login()
        logger.log('[startApp] Tracker 登录成功:', loginResult)
      } catch (e) {
        logger.warn('[startApp] Tracker 登录失败:', e)
      }
    } else {
      logger.warn('[startApp] Tracker 未启用，跳过 Tracker 登录')
    }
    
    logger.log('[startApp] 设置 IPC 处理器...')
    setupIpcHandlers()
    logger.log('[startApp] IPC 处理器已设置')
    
    // 创建主窗口
    logger.log('[startApp] 创建主窗口...')
    windowManager.createMainWindow()
    logger.log('[startApp] 主窗口已创建')
    
    logger.log('[startApp] 加载窗口内容...')
    windowManager.loadContent()
    logger.log('[startApp] 窗口内容加载完成')
    
    logger.log('[startApp] 应用启动完成')
  } catch (error) {
    logger.error('[startApp] 应用启动失败:', error)
    throw error
  }
}

// 应用生命周期事件
app.on('window-all-closed', () => {
  logger.log('[app] window-all-closed 事件触发')
  if (process.platform !== 'darwin') {
    logger.log('[app] 退出应用')
    app.quit()
  }
})

app.on('activate', () => {
  logger.log('[app] activate 事件触发')
  if (windowManager.getMainWindow() === null) {
    logger.log('[app] 重新创建窗口')
    windowManager.createMainWindow()
    windowManager.loadContent()
  }
})

app.on('before-quit', () => {
  logger.log('[app] before-quit 事件触发')
  pluginManager.cleanup()
  logger.log('[app] 插件管理器已清理')
})

// 全局错误处理
process.on('uncaughtException', (error) => {
  logger.error('[process] 未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[process] 未处理的 Promise 拒绝:', { reason, promise })
})

// IPC 处理器
ipcMain.handle('get-plugins-status', async () => {
  logger.log('[ipc] get-plugins-status 被调用')
  try {
    const result = pluginManager.getAvailablePlugins()
    logger.log('[ipc] get-plugins-status 返回结果:', result)
    return result
  } catch (error) {
    logger.error('[ipc] get-plugins-status 出错:', error)
    throw error
  }
})

// 启动应用
logger.log('开始启动应用...')
startApp().catch((error) => {
  logger.error('应用启动失败:', error)
  app.quit()
}) 