export interface ElectronAPI {
  getPluginsStatus: () => Promise<any[]>
  getPluginResourcePath: (pluginName: string) => Promise<string>
  checkFileExists: (filePath: string) => Promise<boolean>
  selectFile: () => Promise<string>
  selectFolder: () => Promise<string>
  getPluginDirs: () => Promise<string[]>
  startPluginProcess: (pluginName: string) => Promise<any>
  triggerEvent: (pluginName: string, eventType: string, params?: any) => Promise<any>
  eventBus: {
    trigger: (eventType: string, params: any, pluginName: string) => Promise<any>
  }
  onBusinessStopped: (callback: () => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
} 