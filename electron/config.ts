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
    clientType?: string
    clientId?: number
  }
  ipcAllowlist: string[]
}

export class ConfigManager {
  private configPath: string
  private config: AppConfig | null = null

  constructor() {
    this.configPath = path.join(__dirname, '../config.json')
  }

  getConfig(): AppConfig {
    if (this.config) {
      return this.config
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(`配置文件不存在: ${this.configPath}`)
    }

    try {
      const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
      this.config = {
        key: configData.key || '',
        title: configData.title || '优创客户端体验版',
        version: configData.version || '0.3.0',
        description: configData.description || '插件化客户端应用',
        tracker: configData.tracker || {
          enabled: true,
          baseUrl: 'https://scriptv2.qfei.cn/',
          clientType: 'VideoConverter',
          clientId: 2
        },
        ipcAllowlist: Array.isArray(configData.ipcAllowlist) ? configData.ipcAllowlist : []
      }

      if (!this.config.ipcAllowlist || this.config.ipcAllowlist.length === 0) {
        throw new Error('config.json 缺少必填字段 ipcAllowlist 或为空')
      }

      return this.config
    } catch (e) {
      throw new Error(`读取配置文件失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  getKey(): string {
    return this.getConfig().key
  }

  getIpcAllowlist(): string[] {
    return this.getConfig().ipcAllowlist
  }
}

export const configManager = new ConfigManager()