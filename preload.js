const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startPluginProcess: (pluginName) => ipcRenderer.invoke('start-plugin-process', pluginName),
  getPluginsStatus: () => ipcRenderer.invoke('get-plugins-status'),
  onPluginUnzipped: (callback) => ipcRenderer.on('plugin-unzipped', (event, pluginName) => callback(pluginName)),
  stopBusiness: (pluginName) => ipcRenderer.invoke('stop-business', pluginName),
  onBusinessStopped: (callback) => ipcRenderer.on('business-stopped', callback),
  getPluginResourcePath: (pluginName) => ipcRenderer.invoke('get-plugin-resource-path', pluginName),
  eventBus: {
    trigger: async (eventType, params, pluginName) => {
      if (!pluginName) throw new Error('pluginName is required');
      return await ipcRenderer.invoke('trigger-event', pluginName, eventType, params);
    }
  }
});