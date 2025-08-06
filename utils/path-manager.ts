import path from 'path'
import fs from 'fs'

/**
 * 路径管理器 - 统一处理开发环境和打包环境的路径差异
 */
class PathManager {
  private isPackaged: boolean
  private isDev: boolean

  constructor() {
    // 只有在真正打包后（resourcesPath 不包含 node_modules）才认为是打包环境
    this.isPackaged = !!(process.resourcesPath && !process.resourcesPath.includes('node_modules'))
    this.isDev = !this.isPackaged
  }

  /**
   * 获取应用根目录
   * @returns {string} 应用根目录路径
   */
  getAppRoot(): string {
    if (this.isPackaged) {
      // 打包环境：resourcesPath 的上级目录
      return path.dirname(process.resourcesPath)
    } else {
      // 开发环境：__dirname 指向 main.js 所在目录
      return path.resolve(__dirname, '..')
    }
  }

  /**
   * 获取插件目录路径
   * @returns {string} 插件目录路径
   */
  getPluginsDir(): string {
    if (this.isPackaged) {
      // 打包环境：resources/plugins
      return path.join(process.resourcesPath, 'plugins')
    } else {
      // 开发环境：项目根目录下的 plugins
      return path.join(this.getAppRoot(), 'plugins')
    }
  }

  /**
   * 获取指定插件的目录路径
   * @param {string} pluginName 插件名称
   * @returns {string} 插件目录路径
   */
  getPluginDir(pluginName: string): string {
    return path.join(this.getPluginsDir(), pluginName)
  }

  /**
   * 获取插件的 manifest.json 路径
   * @param {string} pluginName 插件名称
   * @returns {string} manifest.json 路径
   */
  getPluginManifestPath(pluginName: string): string {
    return path.join(this.getPluginDir(pluginName), 'manifest.json')
  }

  /**
   * 获取插件的入口文件路径（plugin_host.js）
   * @param {string} pluginName 插件名称
   * @returns {string} 插件入口文件路径
   */
  getPluginHostPath(pluginName: string): string {
    return path.join(this.getPluginDir(pluginName), 'plugin_host.js')
  }

  /**
   * 获取插件的业务文件路径
   * @param {string} pluginName 插件名称
   * @param {string} jsFile 业务文件名
   * @returns {string} 业务文件路径
   */
  getPluginBusinessPath(pluginName: string, jsFile: string): string {
    return path.join(this.getPluginDir(pluginName), jsFile)
  }

  /**
   * 获取插件的资源路径（用于前端加载）
   * @param {string} pluginName 插件名称
   * @returns {string} 插件资源路径
   */
  getPluginResourcePath(pluginName: string): string {
    // 统一使用 file:// 协议路径，确保路径正确
    const pluginPath = this.getPluginDir(pluginName)
    return `file://${pluginPath.replace(/\\/g, '/')}`
  }

  /**
   * 获取 FFmpeg 可执行文件路径
   * @returns {string|null} FFmpeg 路径，如果不存在则返回 null
   */
  getFfmpegPath(): string | null {
    const possiblePaths = [
      // 打包环境：resources/ffmpeg.exe
      this.isPackaged ? path.join(process.resourcesPath, 'ffmpeg.exe') : null,
      // 开发环境：项目根目录下的 ffmpeg.exe
      path.join(this.getAppRoot(), 'ffmpeg.exe'),
      // 当前工作目录下的 ffmpeg.exe
      path.join(process.cwd(), 'ffmpeg.exe')
    ].filter(Boolean) as string[]

    for (const ffmpegPath of possiblePaths) {
      if (fs.existsSync(ffmpegPath)) {
        return ffmpegPath
      }
    }
    return null
  }

  /**
   * 检查插件是否存在
   * @param {string} pluginName 插件名称
   * @returns {boolean} 插件是否存在
   */
  pluginExists(pluginName: string): boolean {
    const pluginDir = this.getPluginDir(pluginName)
    const manifestPath = this.getPluginManifestPath(pluginName)
    const hostPath = this.getPluginHostPath(pluginName)
    
    return fs.existsSync(pluginDir) && 
           fs.existsSync(manifestPath) && 
           fs.existsSync(hostPath)
  }

  /**
   * 获取所有可用的插件列表
   * @returns {string[]} 插件名称列表
   */
  getAvailablePlugins(): string[] {
    const pluginsDir = this.getPluginsDir()
    if (!fs.existsSync(pluginsDir)) {
      return []
    }

    try {
      return fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(pluginName => this.pluginExists(pluginName))
    } catch (error) {
      console.error('Error reading plugins directory:', error)
      return []
    }
  }

  /**
   * 获取环境信息（用于调试）
   * @returns {object} 环境信息
   */
  getEnvironmentInfo(): {
    isDev: boolean
    isPackaged: boolean
    appRoot: string
    pluginsDir: string
    ffmpegPath: string | null
    availablePlugins: string[]
  } {
    return {
      isDev: this.isDev,
      isPackaged: this.isPackaged,
      appRoot: this.getAppRoot(),
      pluginsDir: this.getPluginsDir(),
      ffmpegPath: this.getFfmpegPath(),
      availablePlugins: this.getAvailablePlugins()
    }
  }
}

// 创建单例实例
const pathManager = new PathManager()

export default pathManager 