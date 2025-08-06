import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getPluginsStatus: () => {
    console.log('[preload] getPluginsStatus called')
    return ipcRenderer.invoke('get-plugins-status')
  },
  getPluginResourcePath: (pluginName: string) => {
    console.log('[preload] getPluginResourcePath called with pluginName:', pluginName)
    return ipcRenderer.invoke('get-plugin-resource-path', pluginName)
  },
  checkFileExists: (filePath: string) => {
    console.log('[preload] checkFileExists called with filePath:', filePath)
    return ipcRenderer.invoke('check-file-exists', filePath)
  },
  selectFile: () => {
    console.log('[preload] selectFile called')
    return ipcRenderer.invoke('select-file')
  },
  selectFolder: () => {
    console.log('[preload] selectFolder called')
    return ipcRenderer.invoke('select-folder')
  },
  getPluginDirs: () => {
    console.log('[preload] getPluginDirs called')
    return ipcRenderer.invoke('get-plugin-dirs')
  },
  startPluginProcess: (pluginName: string) => {
    console.log('[preload] startPluginProcess called with pluginName:', pluginName)
    return ipcRenderer.invoke('start-plugin-process', pluginName)
  },
  triggerEvent: (pluginName: string, eventType: string, params?: any) => {
    console.log('[preload] triggerEvent called with:', { pluginName, eventType, params })
    return ipcRenderer.invoke('trigger-event', pluginName, eventType, params)
  },
  eventBus: {
    trigger: (eventType: string, params: any, pluginName: string) => {
      console.log('[preload] eventBus.trigger called with:', { eventType, params, pluginName })
      return ipcRenderer.invoke('trigger-event', pluginName, eventType, params)
    }
  },
  onBusinessStopped: (callback: () => void) => {
    console.log('[preload] onBusinessStopped called')
    ipcRenderer.on('business-stopped', callback)
  }
}) 