"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getPluginsStatus: () => {
    console.log("[preload] getPluginsStatus called");
    return electron.ipcRenderer.invoke("get-plugins-status");
  },
  getPluginResourcePath: (pluginName) => {
    console.log("[preload] getPluginResourcePath called with pluginName:", pluginName);
    return electron.ipcRenderer.invoke("get-plugin-resource-path", pluginName);
  },
  getPluginHttpUrl: (pluginName, subPath = "dist/index.html") => {
    console.log("[preload] getPluginHttpUrl called with:", { pluginName, subPath });
    return electron.ipcRenderer.invoke("get-plugin-http-url", pluginName, subPath);
  },
  // 通用invoke（受宿主白名单控制）
  invoke: (channel, ...args) => {
    console.log("[preload] invoke called with:", channel, args);
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  checkFileExists: (filePath) => {
    console.log("[preload] checkFileExists called with filePath:", filePath);
    return electron.ipcRenderer.invoke("check-file-exists", filePath);
  },
  selectFile: () => {
    console.log("[preload] selectFile called");
    return electron.ipcRenderer.invoke("select-file");
  },
  selectFolder: () => {
    console.log("[preload] selectFolder called");
    return electron.ipcRenderer.invoke("select-folder");
  },
  getPluginDirs: () => {
    console.log("[preload] getPluginDirs called");
    return electron.ipcRenderer.invoke("get-plugin-dirs");
  },
  startPluginProcess: (pluginName) => {
    console.log("[preload] startPluginProcess called with pluginName:", pluginName);
    return electron.ipcRenderer.invoke("start-plugin-process", pluginName);
  },
  triggerEvent: (pluginName, eventType, params) => {
    console.log("[preload] triggerEvent called with:", { pluginName, eventType, params });
    return electron.ipcRenderer.invoke("trigger-event", pluginName, eventType, params);
  },
  eventBus: {
    trigger: (eventType, params, pluginName) => {
      console.log("[preload] eventBus.trigger called with:", { eventType, params, pluginName });
      return electron.ipcRenderer.invoke("trigger-event", pluginName, eventType, params);
    }
  },
  downloadImagesAsZip: (images) => {
    console.log("[preload] downloadImagesAsZip called with images count:", images.length);
    return electron.ipcRenderer.invoke("download-images-as-zip", images);
  },
  onBusinessStopped: (callback) => {
    console.log("[preload] onBusinessStopped called");
    electron.ipcRenderer.on("business-stopped", callback);
  }
});
