import * as os from 'os'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// 自定义错误类
export class InvalidRegistryKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRegistryKeyError'
  }
}

// 配置接口定义
interface TrackerConfig {
  enabled: boolean
  baseUrl: string
  clientType?: string
  clientId?: number
}

interface AppConfig {
  key: string
  title: string
  version: string
  description: string
  tracker: TrackerConfig
}

class TrackerUtil {
  private config: AppConfig
  private key: string | null = null
  private openId: string | null = null
  private clientType: string
  private clientId: number

  constructor() {
    this.config = this.loadConfig()
    this.clientType = this.config.tracker.clientType || 'VideoConverter'
    this.clientId = this.config.tracker.clientId || 2
  }

  // 加载配置文件
  private loadConfig(): AppConfig {
    try {
      const configPath = path.join(process.cwd(), 'config.json')
      const configData = fs.readFileSync(configPath, 'utf8')
      return JSON.parse(configData)
    } catch (error) {
      console.error('Failed to load config.json:', error)
      // 返回默认配置
      return {
        key: 'your-actual-key-here',
        title: '优创客户端体验版',
        version: '0.3.0',
        description: '插件化客户端应用',
        tracker: {
          enabled: true,
          baseUrl: 'https://scriptv2.qfei.cn',
          clientType: 'VideoConverter',
          clientId: 2
        }
      }
    }
  }

  // 检查Tracker是否启用
  isEnabled(): boolean {
    return this.config.tracker.enabled
  }

  // 获取配置的key
  getKey(): string {
    return this.config.key
  }

  // 发送 POST 请求的通用方法
  private async sendRequest(path: string, data: any): Promise<any> {
    const url = new URL(this.config.tracker.baseUrl)
    const options: any = {
      hostname: url.hostname,
      path: `/api${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }
    
    // 如果有 openId，添加到 Cookie 中
    if (this.openId) {
      options.headers['Cookie'] = `open_id=${this.openId}`
    }

    return new Promise((resolve, reject) => {
      const https = require('https')
      const req = https.request(options, (res: any) => {
        let responseData = ''

        res.on('data', (chunk: any) => {
          responseData += chunk
        })

        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.log('服务器响应内容:', responseData)
            reject(new Error(`HTTP Error: ${res.statusCode}`))
            return
          }
          try {
            const parsedData = JSON.parse(responseData)
            resolve(parsedData)
          } catch (error) {
            console.log('响应内容:', responseData)
            reject(error)
          }
        })
      })

      req.on('error', (error: any) => {
        reject(error)
      })

      req.write(JSON.stringify(data))
      req.end()
    })
  }

  async login(key?: string): Promise<any> {
    // 如果没有传入key，使用配置文件中的key
    this.key = key || this.config.key
    
    // 检查Tracker是否启用
    if (!this.isEnabled()) {
      console.log('Tracker is disabled in config')
      return { success: false, message: 'Tracker is disabled' }
    }

    try {
      console.log('Tracker login attempt to:', this.config.tracker.baseUrl)
      
      const data = {
        key: this.key,
        client_id: this.clientId
      }
      
      const response = await this.sendRequest('/client/login', data)
      
      if (response.code === 0 && response.data) {
        this.openId = response.data
        console.log('Tracker login success:', response)
        return response
      } else if (response.code === 10001) {
        throw new InvalidRegistryKeyError(response.message)
      } else {
        throw new Error(response.message || '登录失败')
      }
    } catch (error) {
      console.error('Tracker login failed:', error)
      throw error
    }
  }

  // 事件追踪 - 与原始版本兼容
  async trackEvent({
    event_type,
    event_name,
    event_time = 0,
    page_name = '',
    customized_id = '',
    customized_type = '',
  }: {
    event_type: string
    event_name: string
    event_time?: number
    page_name?: string
    customized_id?: string
    customized_type?: string
  }): Promise<any> {
    // 检查Tracker是否启用
    if (!this.isEnabled()) {
      console.log('Tracker is disabled, skipping event:', event_name)
      return { success: false, message: 'Tracker is disabled' }
    }

    if (!this.openId) {
      throw new Error('请先登录系统')
    }

    const data = {
      uuid: randomUUID(),
      os: `${os.platform()} ${os.release()}`,
      client_type: this.clientType,
      customized_id,
      customized_type,
      event_type,
      event_time,
      event_name,
      page_name,
      client_time: Date.now() // 毫秒级时间戳
    }

    try {
      console.log(`Tracker trackEvent: ${event_name}`, data)
      const result = await this.sendRequest('/client/event_tracking', data)
      console.log('Tracker trackEvent success:', result)
      return result
    } catch (error) {
      console.error('Tracker trackEvent failed:', error)
      throw error
    }
  }

  // 兼容旧版本的report方法
  async report(event: string, data: any = {}): Promise<void> {
    // 检查Tracker是否启用
    if (!this.isEnabled()) {
      console.log('Tracker is disabled, skipping report:', event)
      return
    }

    if (!this.openId) {
      console.warn('Tracker report skipped - not logged in')
      return
    }

    try {
      await this.trackEvent({
        event_type: 'user_action',
        event_name: event,
        event_time: Date.now(),
        page_name: 'main',
        customized_id: data.customized_id || '',
        customized_type: data.customized_type || ''
      })
    } catch (error) {
      console.error('Tracker report failed:', error)
    }
  }

  // 获取当前配置信息
  getConfig(): { 
    baseUrl: string; 
    hasKey: boolean; 
    hasOpenId: boolean; 
    enabled: boolean;
    clientType: string;
    clientId: number;
  } {
    return {
      baseUrl: this.config.tracker.baseUrl,
      hasKey: !!this.key,
      hasOpenId: !!this.openId,
      enabled: this.isEnabled(),
      clientType: this.clientType,
      clientId: this.clientId
    }
  }

  // 获取openId
  getOpenId(): string | null {
    return this.openId
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!this.openId
  }

  // 重新加载配置
  reloadConfig(): void {
    this.config = this.loadConfig()
    this.clientType = this.config.tracker.clientType || 'VideoConverter'
    this.clientId = this.config.tracker.clientId || 2
    console.log('Tracker config reloaded')
  }
}

export default TrackerUtil 