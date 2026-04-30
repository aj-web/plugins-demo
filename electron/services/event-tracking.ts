import { randomUUID } from 'crypto'
import https from 'https'
import { activationService } from './activation'

const EVENT_TRACKING_API_URL = 'https://scriptv2.qfei.cn/api/client/event_tracking'
const CLIENT_TYPE = 'smart-short-drama'
const DEFAULT_OS = 'Windows'
const DEFAULT_EVENT_TYPE = 'click'

export interface TrackClickPayload {
  eventName: string
  pageName: string
}

interface EventTrackingResponse {
  code?: number
  data?: unknown
  message?: string
}

class EventTrackingService {
  async trackClick(payload: TrackClickPayload): Promise<{ success: boolean; data?: EventTrackingResponse; message: string }> {
    const eventName = (payload?.eventName || '').trim()
    const pageName = (payload?.pageName || '').trim()

    if (!eventName || !pageName) {
      return { success: false, message: '缺少埋点事件名称或页面名称' }
    }

    const body = {
      uuid: randomUUID(),
      os: DEFAULT_OS,
      client_type: CLIENT_TYPE,
      customized_id: '',
      customized_type: '',
      event_type: DEFAULT_EVENT_TYPE,
      event_time: 0,
      event_name: eventName,
      page_name: pageName,
      client_time: Date.now()
    }

    console.log('[EventTracking] 准备上报点击事件:', {
      eventName,
      pageName,
      uuid: body.uuid,
      clientTime: body.client_time
    })

    const response = await this.postEvent(body)
    console.log('[EventTracking] 埋点接口返回:', {
      eventName,
      pageName,
      response
    })

    return {
      success: response.code === undefined || response.code === 0,
      data: response,
      message: response.message || '上报完成'
    }
  }

  private postEvent(body: Record<string, unknown>): Promise<EventTrackingResponse> {
    const requestBody = JSON.stringify(body)
    const url = new URL(EVENT_TRACKING_API_URL)
    const openId = activationService.getUserId() || 'anonymous'
    const maskedOpenId = openId === 'anonymous' ? openId : `${openId.slice(0, 8)}...${openId.slice(-6)}`

    return new Promise((resolve, reject) => {
      const headers: Record<string, string | number> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        Cookie: `open_id=${encodeURIComponent(openId)}`
      }

      console.log('[EventTracking] 发送埋点请求:', {
        url: EVENT_TRACKING_API_URL,
        openId: maskedOpenId,
        method: 'POST',
        headers: {
          'Content-Type': headers['Content-Type'],
          'Content-Length': headers['Content-Length'],
          Cookie: `open_id=${maskedOpenId}`
        },
        body,
        rawBody: requestBody
      })

      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers,
          timeout: 15000
        },
        (res) => {
          let responseBody = ''
          console.log('[EventTracking] 埋点接口响应状态:', {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
          })
          res.on('data', (chunk) => {
            responseBody += chunk
          })
          res.on('end', () => {
            console.log('[EventTracking] 埋点接口原始响应:', responseBody)
            try {
              const parsed = JSON.parse(responseBody || '{}') as EventTrackingResponse
              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(parsed.message || `埋点接口请求失败: HTTP ${res.statusCode}`))
                return
              }
              resolve(parsed)
            } catch (error) {
              reject(new Error(`埋点接口响应解析失败: ${error instanceof Error ? error.message : String(error)}`))
            }
          })
        }
      )

      req.on('timeout', () => {
        console.error('[EventTracking] 埋点接口请求超时')
        req.destroy(new Error('埋点接口请求超时'))
      })
      req.on('error', (error) => {
        console.error('[EventTracking] 埋点接口请求错误:', error)
        reject(error)
      })
      req.write(requestBody)
      req.end()
    })
  }
}

export const eventTrackingService = new EventTrackingService()
