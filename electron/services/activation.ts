import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import https from 'https'

const ACTIVATION_API_URL = 'https://scriptv2.qfei.cn/api/client/login'
const CLIENT_ID = 3
const ACTIVATION_FILE_NAME = 'activation.json'

export interface ActivationStatus {
  activated: boolean
  userId: string
  clientId: number
  activatedAt?: string
}

interface ActivationFile {
  activated: boolean
  userId: string
  clientId: number
  activatedAt: string
}

interface ActivationResponse {
  code: number
  data?: string
  message?: string
}

class ActivationService {
  private getActivationFilePath(): string {
    return path.join(app.getPath('userData'), ACTIVATION_FILE_NAME)
  }

  getStatus(): ActivationStatus {
    try {
      const filePath = this.getActivationFilePath()
      if (!fs.existsSync(filePath)) {
        return { activated: false, userId: '', clientId: CLIENT_ID }
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<ActivationFile>
      if (data.activated === true && data.clientId === CLIENT_ID && typeof data.userId === 'string' && data.userId.trim()) {
        return {
          activated: true,
          userId: data.userId,
          clientId: CLIENT_ID,
          activatedAt: data.activatedAt
        }
      }
    } catch (error) {
      console.warn('[ActivationService] 读取激活状态失败:', error)
    }

    return { activated: false, userId: '', clientId: CLIENT_ID }
  }

  async activate(key: string): Promise<ActivationStatus & { success: boolean; message: string }> {
    const trimmedKey = (key || '').trim()
    if (!trimmedKey) {
      return {
        success: false,
        message: '请输入激活码',
        activated: false,
        userId: '',
        clientId: CLIENT_ID
      }
    }

    const response = await this.postActivation(trimmedKey)
    if (response.code !== 0 || !response.data) {
      return {
        success: false,
        message: response.message || '激活失败',
        activated: false,
        userId: '',
        clientId: CLIENT_ID
      }
    }

    const state: ActivationFile = {
      activated: true,
      userId: response.data,
      clientId: CLIENT_ID,
      activatedAt: new Date().toISOString()
    }

    await fs.promises.mkdir(path.dirname(this.getActivationFilePath()), { recursive: true })
    await fs.promises.writeFile(this.getActivationFilePath(), JSON.stringify(state, null, 2), 'utf-8')

    return {
      success: true,
      message: response.message || '激活成功',
      activated: true,
      userId: state.userId,
      clientId: CLIENT_ID,
      activatedAt: state.activatedAt
    }
  }

  getUserId(): string {
    return this.getStatus().userId
  }

  private postActivation(key: string): Promise<ActivationResponse> {
    const body = JSON.stringify({
      key,
      client_id: CLIENT_ID
    })
    const url = new URL(ACTIVATION_API_URL)

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          },
          timeout: 15000
        },
        (res) => {
          let responseBody = ''
          res.on('data', (chunk) => {
            responseBody += chunk
          })
          res.on('end', () => {
            try {
              const parsed = JSON.parse(responseBody || '{}') as ActivationResponse
              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(parsed.message || `激活接口请求失败: HTTP ${res.statusCode}`))
                return
              }
              resolve(parsed)
            } catch (error) {
              reject(new Error(`激活接口响应解析失败: ${error instanceof Error ? error.message : String(error)}`))
            }
          })
        }
      )

      req.on('timeout', () => {
        req.destroy(new Error('激活接口请求超时'))
      })
      req.on('error', (error) => reject(error))
      req.write(body)
      req.end()
    })
  }
}

export const activationService = new ActivationService()
