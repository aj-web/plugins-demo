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
          }
        }
      } catch (e) {
        console.warn('读取 config.json 失败:', e)
        this.config = this.getDefaultConfig()
      }
    } else {
      this.config = this.getDefaultConfig()
    }

    return this.config
  }

  getKey(): string {
    return this.getConfig().key
  }

  private getDefaultConfig(): AppConfig {
    return {
      key: '',
      title: '优创客户端体验版',
      version: '0.3.0',
      description: '插件化客户端应用',
      tracker: {
        enabled: true,
        baseUrl: 'https://scriptv2.qfei.cn/'
      }
    }
  }

  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.getConfig(), ...newConfig }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      console.error('写入 config.json 失败:', e)
    }
  }
}

export const configManager = new ConfigManager() 