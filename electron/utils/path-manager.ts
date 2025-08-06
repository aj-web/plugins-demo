import path from 'path'
import fs from 'fs'

class PathManager {
  private pluginsDir: string

  constructor() {
    // 判断是否为开发环境：检查是否存在 node_modules 目录和 package.json
    const isDev = fs.existsSync(path.join(process.cwd(), 'package.json')) && 
                  fs.existsSync(path.join(process.cwd(), 'node_modules'))
    
    console.log('[PathManager] 当前工作目录:', process.cwd())
    console.log('[PathManager] 是否为开发环境:', isDev)
    console.log('[PathManager] NODE_ENV:', process.env.NODE_ENV)
    
    if (isDev) {
      // 开发环境：使用项目根目录下的 plugins 文件夹
      this.pluginsDir = path.join(process.cwd(), 'plugins')
    } else {
      // 生产环境：使用 Electron 资源目录
      this.pluginsDir = path.join(process.resourcesPath, 'plugins')
    }
  }

  getPluginsDir(): string {
    return this.pluginsDir
  }

  getAvailablePlugins(): string[] {
    console.log('[PathManager] 插件目录路径:', this.pluginsDir)
    console.log('[PathManager] 插件目录是否存在:', fs.existsSync(this.pluginsDir))
    
    if (!fs.existsSync(this.pluginsDir)) {
      console.log('[PathManager] 插件目录不存在，返回空数组')
      return []
    }

    const items = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
    console.log('[PathManager] 插件目录内容:', items.map(item => ({ name: item.name, isDirectory: item.isDirectory() })))
    
    const directories = items.filter(item => item.isDirectory())
    console.log('[PathManager] 目录项:', directories.map(item => item.name))
    
    const pluginsWithManifest = directories
      .map(item => item.name)
      .filter(name => {
        const manifestPath = this.getPluginManifestPath(name)
        const hasManifest = fs.existsSync(manifestPath)
        console.log('[PathManager] 插件', name, 'manifest路径:', manifestPath, '存在:', hasManifest)
        return hasManifest
      })
    
    console.log('[PathManager] 最终找到的插件:', pluginsWithManifest)
    return pluginsWithManifest
  }

  getPluginDir(pluginName: string): string {
    return path.join(this.pluginsDir, pluginName)
  }

  getPluginManifestPath(pluginName: string): string {
    return path.join(this.getPluginDir(pluginName), 'manifest.json')
  }

  getPluginHostPath(pluginName: string): string {
    return path.join(this.getPluginDir(pluginName), 'plugin_host.js')
  }

  getFfmpegPath(): string | null {
    // 开发环境
    const devPath = path.join(process.cwd(), 'ffmpeg.exe')
    if (fs.existsSync(devPath)) {
      return devPath
    }

    // 生产环境
    const prodPath = path.join(process.resourcesPath, 'ffmpeg.exe')
    if (fs.existsSync(prodPath)) {
      return prodPath
    }

    return null
  }
}

export default new PathManager() 