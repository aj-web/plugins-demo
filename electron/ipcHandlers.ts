import { ipcMain, dialog } from 'electron'
import { pluginManager } from './services/plugin-manager'
import pathManager from '../utils/path-manager'
import fs from 'fs'

export function setupIpcHandlers(): void {
  console.log('[ipcHandlers] Setting up IPC handlers')
  
  ipcMain.handle('select-file', async () => {
    console.log('[ipcHandlers] select-file called')
    const result = await dialog.showOpenDialog({ properties: ['openFile'] })
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[ipcHandlers] select-file result:', result.filePaths[0])
      return result.filePaths[0]
    }
    return ''
  })

  ipcMain.handle('select-folder', async () => {
    console.log('[ipcHandlers] select-folder called')
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('[ipcHandlers] select-folder result:', result.filePaths[0])
      return result.filePaths[0]
    }
    return ''
  })

  ipcMain.handle('get-plugin-dirs', async () => {
    console.log('[ipcHandlers] get-plugin-dirs called')
    const result = pathManager.getAvailablePlugins()
    console.log('[ipcHandlers] get-plugin-dirs result:', result)
    return result
  })

  ipcMain.handle('start-plugin-process', async (event, pluginName: string) => {
    console.log('[ipcHandlers] start-plugin-process called with pluginName:', pluginName)
    try {
      const manifest = await pluginManager.getManifest(pluginName)
      console.log('[ipcHandlers] start-plugin-process success, manifest:', manifest)
      return { success: true, manifest }
    } catch (error) {
      console.error('[ipcHandlers] start-plugin-process error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('trigger-event', async (event, pluginName: string, eventType: string, params: any = {}) => {
    console.log('[ipcHandlers] trigger-event called with:', { pluginName, eventType, params })
    try {
      const result = await pluginManager.triggerEvent(pluginName, eventType, params)
      console.log('[ipcHandlers] trigger-event success, result:', result)
      return result
    } catch (error) {
      console.error('[ipcHandlers] trigger-event error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('get-plugin-resource-path', async (event, pluginName: string) => {
    console.log('[ipcHandlers] get-plugin-resource-path called with pluginName:', pluginName)
    const resourcePath = pathManager.getPluginResourcePath(pluginName)
    console.log('[ipcHandlers] get-plugin-resource-path success, resourcePath:', resourcePath)
    return resourcePath
  })

  ipcMain.handle('check-file-exists', async (event, filePath: string) => {
    console.log('[ipcHandlers] check-file-exists called with filePath:', filePath)
    try {
      // 将 file:// URL 转换为本地路径
      const localPath = filePath.replace(/^file:\/\//, '')
      const exists = fs.existsSync(localPath)
      console.log('[ipcHandlers] check-file-exists result:', exists)
      return exists
    } catch (error) {
      console.error('[ipcHandlers] check-file-exists error:', error)
      return false
    }
  })
} 