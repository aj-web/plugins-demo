import { fork } from 'child_process'
import path from 'path'
import fs from 'fs'
import pathManager from '../../utils/path-manager'

export interface PluginManifest {
  name: string
  version: string
  description: string
  events: Array<{
    id: string
    class: string
    method: string
    jsFile: string
  }>
  frontend?: {
    devServerUrl?: string
    entry?: string
  }
}

export class PluginManager {
  private pluginProcesses = new Map<string, any>()
  private manifestCache = new Map<string, PluginManifest>()
  private displayNameToFolderMap = new Map<string, string>()

  async getManifest(pluginName: string): Promise<PluginManifest> {
    console.log('[PluginManager] getManifest called with pluginName:', pluginName)
    
    if (this.manifestCache.has(pluginName)) {
      console.log('[PluginManager] getManifest returning cached manifest for:', pluginName)
      return this.manifestCache.get(pluginName)!
    }

    // 使用新的映射获取方法
    const actualPluginName = this.getActualPluginName(pluginName)
    const manifestPath = pathManager.getPluginManifestPath(actualPluginName)
    console.log('[PluginManager] getManifest manifestPath:', manifestPath)
    
    if (!fs.existsSync(manifestPath)) {
      console.error('[PluginManager] getManifest manifest not found at:', manifestPath)
      throw new Error('manifest.json not found')
    }

    const manifestRaw = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestRaw) as PluginManifest
    console.log('[PluginManager] getManifest parsed manifest:', manifest)
    
    this.manifestCache.set(pluginName, manifest)
    return manifest
  }

  async triggerEvent(pluginName: string, eventType: string, params: any = {}): Promise<any> {
    console.log('[PluginManager] triggerEvent called with:', { pluginName, eventType, params })
    
    const manifest = await this.getManifest(pluginName)
    const eventRoute = manifest.events?.find(e => e.id === eventType)
    
    console.log('[PluginManager] triggerEvent found eventRoute:', eventRoute)
    
    if (!eventRoute) {
      console.error('[PluginManager] triggerEvent event not found in manifest for eventType:', eventType)
      throw new Error('event not found in manifest')
    }

    if (eventType === 'stop-processing') {
      console.log('[PluginManager] triggerEvent calling stopPluginProcess for:', pluginName)
      return this.stopPluginProcess(pluginName)
    }

    console.log('[PluginManager] triggerEvent calling executePluginEvent for:', { pluginName, eventRoute })
    return this.executePluginEvent(pluginName, eventRoute, params)
  }

  private stopPluginProcess(pluginName: string): { success: boolean; error?: string } {
    const child = this.pluginProcesses.get(pluginName)
    if (child) {
      child.send({ type: 'stop' })
      return { success: true }
    }
    return { success: false, error: 'No plugin process' }
  }

  private async executePluginEvent(pluginName: string, eventRoute: any, params: any): Promise<any> {
    console.log('[PluginManager] executePluginEvent called with:', { pluginName, eventRoute, params })
    
    const callData = {
      class: eventRoute.class,
      method: eventRoute.method,
      args: params.args || []
    }
    const data = { ...params, call: callData }
    
    console.log('[PluginManager] executePluginEvent callData:', callData)
    console.log('[PluginManager] executePluginEvent data:', data)
    
    let child = this.pluginProcesses.get(pluginName)
    console.log('[PluginManager] executePluginEvent existing child process:', !!child)
    
    if (!child) {
      console.log('[PluginManager] executePluginEvent starting new plugin process for:', pluginName)
      child = await this.startPluginProcess(pluginName)
    }

    console.log('[PluginManager] executePluginEvent sending to plugin process:', { jsFile: eventRoute.jsFile, ...data })
    return this.sendToPluginProcess(child, { jsFile: eventRoute.jsFile, ...data })
  }

  private async startPluginProcess(pluginName: string): Promise<any> {
    console.log('[PluginManager] startPluginProcess called with pluginName:', pluginName)
    
    // 使用新的映射获取方法
    const actualPluginName = this.getActualPluginName(pluginName)
    console.log('[PluginManager] startPluginProcess actualPluginName:', actualPluginName)
    
    const entry = pathManager.getPluginHostPath(actualPluginName)
    console.log('[PluginManager] startPluginProcess entry path:', entry)
    
    if (!fs.existsSync(entry)) {
      console.error('[PluginManager] startPluginProcess plugin_host.js not found at:', entry)
      throw new Error('No plugin_host.js found')
    }

    // 设置 FFmpeg 路径环境变量
    const env = { ...process.env }
    const ffmpegPath = pathManager.getFfmpegPath()
    if (ffmpegPath) {
      env.FFMPEG_PATH = ffmpegPath
      console.log('[PluginManager] startPluginProcess Found FFmpeg at:', ffmpegPath)
    }

    // 设置 Chrome 路径环境变量
    const chromePath = pathManager.getChromePath()
    if (chromePath) {
      env.CHROME_PATH = chromePath
      env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromePath
      console.log('[PluginManager] startPluginProcess Found Chrome at:', chromePath)
    }

    console.log('[PluginManager] startPluginProcess forking process with entry:', entry)
    const child = fork(entry, [], { env })
    this.pluginProcesses.set(pluginName, child)
    console.log('[PluginManager] startPluginProcess child process created, pid:', child.pid)

    child.on('message', (msg: any) => {
      console.log('[PluginManager] startPluginProcess received message from child:', msg)
      if (msg && msg.type === 'stopped') {
        console.log('[PluginManager] startPluginProcess plugin stopped, notifying windows')
        // 通知所有窗口插件已停止
        const { BrowserWindow } = require('electron')
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('business-stopped')
        }
      }
    })

    child.on('exit', (code: number) => {
      console.log('[PluginManager] startPluginProcess child process exited with code:', code)
      this.pluginProcesses.delete(pluginName)
    })

    child.on('error', (error: any) => {
      console.error('[PluginManager] startPluginProcess child process error:', error)
    })

    return child
  }

  private sendToPluginProcess(child: any, data: any): Promise<any> {
    console.log('[PluginManager] sendToPluginProcess called with data:', data)
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[PluginManager] sendToPluginProcess timeout after 10 minutes')
        reject(new Error('Plugin process timeout'))
      }, 1200000)

      child.once('message', (response: any) => {
        console.log('[PluginManager] sendToPluginProcess received response:', response)
        clearTimeout(timeout)
        if (response && response.error) {
          console.error('[PluginManager] sendToPluginProcess response has error:', response.error)
          reject(new Error(response.error))
        } else {
          console.log('[PluginManager] sendToPluginProcess resolving with response:', response)
          resolve(response)
        }
      })

      console.log('[PluginManager] sendToPluginProcess sending data to child process')
      child.send(data)
    })
  }

  getAvailablePlugins(): Array<{ name: string; status: string }> {
    const pluginDirs = pathManager.getAvailablePlugins()
    return pluginDirs.map(pluginName => {
      let displayName = pluginName
      
      try {
        const manifestPath = pathManager.getPluginManifestPath(pluginName)
        if (fs.existsSync(manifestPath)) {
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
          const manifest = JSON.parse(manifestContent)
          if (manifest.name && typeof manifest.name === 'string') {
            displayName = manifest.name
            // 使用新的映射设置方法
            this.setDisplayNameMapping(displayName, pluginName)
          }
        }
      } catch (error) {
        console.warn(`Failed to read manifest for plugin ${pluginName}:`, error)
      }
      
      return {
        name: displayName,
        status: 'ready'
      }
    })
  }

  /**
   * 设置显示名称到文件夹名的映射
   * @param displayName 显示名称
   * @param folderName 实际文件夹名
   */
  setDisplayNameMapping(displayName: string, folderName: string): void {
    console.log('[PluginManager] setDisplayNameMapping:', { displayName, folderName })
    this.displayNameToFolderMap.set(displayName, folderName)
  }

  /**
   * 根据显示名称获取实际的文件夹名
   * @param pluginName 显示名称或文件夹名
   * @returns 实际的文件夹名
   */
  getActualPluginName(pluginName: string): string {
    const actualName = this.displayNameToFolderMap.get(pluginName) || pluginName
    console.log('[PluginManager] getActualPluginName:', { pluginName, actualName })
    return actualName
  }

  cleanup(): void {
    this.pluginProcesses.forEach((child, pluginName) => {
      child.kill()
      this.pluginProcesses.delete(pluginName)
    })
    this.manifestCache.clear()
    this.displayNameToFolderMap.clear()
  }
}

export const pluginManager = new PluginManager() 