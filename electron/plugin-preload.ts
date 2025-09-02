import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pluginAPI', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...rest) => listener(...rest))
  }
}) 