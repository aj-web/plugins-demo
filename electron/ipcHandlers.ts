import { ipcMain, dialog } from 'electron'
import { pluginManager } from './services/plugin-manager'
import pathManager from '../utils/path-manager'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { pipeline } from 'stream/promises'
import archiver from 'archiver'
import { staticServer } from './static-server'
import { configManager } from './config'

const dynamicAllowlist = new Set<string>()

export function setupIpcHandlers(): void {
  console.log('[ipcHandlers] Setting up IPC handlers')

  // 初始化 allowlist
  configManager.getIpcAllowlist().forEach(c => dynamicAllowlist.add(c))
  configManager.watchIpcAllowlist((list) => {
    dynamicAllowlist.clear()
    list.forEach(c => dynamicAllowlist.add(c))
    console.log('[ipcHandlers] allowlist updated:', Array.from(dynamicAllowlist))
  })
  
  ipcMain.handle('get-ipc-allowlist', async () => {
    return Array.from(dynamicAllowlist)
  })
  
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

  ipcMain.handle('get-plugin-http-url', async (event, pluginName: string, subPath: string = 'dist/index.html') => {
    console.log('[ipcHandlers] get-plugin-http-url called with:', { pluginName, subPath })
    const base = staticServer.getBaseUrl()
    const url = `${base}/${pluginName}/${subPath}`
    console.log('[ipcHandlers] get-plugin-http-url result:', url)
    return url
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

  // ZIP打包下载API
  ipcMain.handle('download-images-as-zip', async (event, images: Array<{url: string, index: number}>) => {
    console.log('[ipcHandlers] download-images-as-zip called with images count:', images.length)
    console.log('[ipcHandlers] download-images-as-zip images data:', images)
    
    try {
      // 选择保存位置
      const result = await dialog.showSaveDialog({
        title: '保存ZIP文件',
        defaultPath: `淘宝好评图片_${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [
          { name: 'ZIP文件', extensions: ['zip'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        console.log('[ipcHandlers] download-images-as-zip canceled by user')
        return { success: false, error: '用户取消了保存' }
      }

      const zipPath = result.filePath
      console.log('[ipcHandlers] download-images-as-zip saving to:', zipPath)

      // 创建ZIP文件
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // 设置压缩级别
      })

      // 监听ZIP创建完成
      const zipPromise = new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log('[ipcHandlers] download-images-as-zip completed, total bytes:', archive.pointer())
          resolve({ success: true, filePath: zipPath })
        })

        archive.on('error', (err: Error) => {
          console.error('[ipcHandlers] download-images-as-zip archive error:', err)
          reject(err)
        })
      })

      // 连接输出流
      archive.pipe(output)

      // 下载并添加图片到ZIP
      let processed = 0
      const total = images.length

      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        try {
          console.log('[ipcHandlers] download-images-as-zip processing image:', image.url)
          console.log('[ipcHandlers] download-images-as-zip image data:', image)
          
          // 下载图片
          const imageBuffer = await downloadImage(image.url)
          
          // 使用选择顺序作为文件名（从1开始）
          const fileName = `${i + 1}.jpg`
          
          // 直接添加到ZIP根目录，不按商品分组
          archive.append(imageBuffer, { name: fileName })
          
          processed++
          console.log('[ipcHandlers] download-images-as-zip progress:', processed, '/', total, 'filename:', fileName)
          
        } catch (error) {
          console.error('[ipcHandlers] download-images-as-zip image download error:', error)
          processed++
          // 继续处理其他图片，不中断整个流程
        }
      }

      // 完成ZIP创建
      await archive.finalize()
      
      const zipResult = await zipPromise
      console.log('[ipcHandlers] download-images-as-zip success:', zipResult)
      return zipResult

    } catch (error) {
      console.error('[ipcHandlers] download-images-as-zip error:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })
}

// 下载图片的辅助函数
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => {
        chunks.push(chunk)
      })

      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer)
      })
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('下载超时'))
    })
  })
} 