import path from 'path'
import fs from 'fs'

export interface AppConfig {
  key: string
  title: string
  version: string
  description: string
  tracker?: {
    enabled: boolean
    baseUrl: string
  }
  ipcAllowlist?: string[]
}

export class ConfigManager {
  private configPath: string
  private config: AppConfig | null = null
  private watchersInitialized = false

  constructor() {
    this.configPath = path.join(__dirname, '../config.json')
  }

  getConfig(): AppConfig {
    if (this.config) {
      return this.config
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        this.config = {
          key: configData.key || '',
          title: configData.title || '优创客户端体验版',
          version: configData.version || '0.3.0',
          description: configData.description || '插件化客户端应用',
          tracker: configData.tracker || {
            enabled: true,
            baseUrl: 'https://scriptv2.qfei.cn/'
          },
          ipcAllowlist: Array.isArray(configData.ipcAllowlist) ? configData.ipcAllowlist : undefined
        }

        if (!this.config.ipcAllowlist || this.config.ipcAllowlist.length === 0) {
          throw new Error('config.json 缺少必填字段 ipcAllowlist 或为空，请配置允许的 IPC 通道')
        }
      } catch (e) {
        console.warn('读取 config.json 失败:', e)
        throw e
      }
    } else {
      throw new Error('缺少 config.json 配置文件，至少需要提供 ipcAllowlist')
    }

    return this.config
  }

  getKey(): string {
    return this.getConfig().key
  }

  getIpcAllowlist(): string[] {
    const list = this.getConfig().ipcAllowlist
    if (!list || list.length === 0) throw new Error('ipcAllowlist 未配置或为空')
    return list
  }

  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.getConfig(), ...newConfig }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      console.error('写入 config.json 失败:', e)
    }
  }

  watchIpcAllowlist(onChange: (allowlist: string[]) => void): void {
    if (this.watchersInitialized) return
    this.watchersInitialized = true

    const notify = () => {
      try {
        // 清除缓存强制重载
        this.config = null
        const list = this.getIpcAllowlist()
        onChange(list)
      } catch (e) {
        console.warn('读取配置以刷新 allowlist 失败:', e)
      }
    }

    if (fs.existsSync(this.configPath)) {
      fs.watch(this.configPath, { persistent: false }, () => {
        notify()
      })
    }
  }
}

export const configManager = new ConfigManager() 