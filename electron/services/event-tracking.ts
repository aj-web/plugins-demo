import { randomUUID } from 'crypto'
import https from 'https'
import { activationService } from './activation'

const EVENT_TRACKING_API_URL = 'https://scriptv2.qfei.cn/api/client/event_tracking'
const CLIENT_TYPE = 'smart-short-drama'
const DEFAULT_OS = 'Windows'
const DEFAULT_EVENT_TYPE = 'click'
const DRAMA_OUTPUT_EVENT_NAME = 'drama_output'
const TASK_COMPLETE_REPORT_CONCURRENCY = 5

export interface TrackClickPayload {
  eventName: string
  pageName: string
}

export interface TrackTaskCompletePayload {
  taskId: string
  moduleName: string
  generatedVideoCount?: number
  pageName?: string
}

interface EventTrackingResponse {
  code?: number
  data?: unknown
  message?: string
}

const TASK_COMPLETE_EVENT_MAP: Record<string, { eventName: string; pageName: string }> = {
  爆款扒产: { eventName: DRAMA_OUTPUT_EVENT_NAME, pageName: 'adx_scraper' },
  爆款复刻: { eventName: DRAMA_OUTPUT_EVENT_NAME, pageName: 'replication' },
  爆款混剪: { eventName: DRAMA_OUTPUT_EVENT_NAME, pageName: 'remix' },
  高光混剪: { eventName: DRAMA_OUTPUT_EVENT_NAME, pageName: 'highlight' }
}

class EventTrackingService {
  async trackClick(payload: TrackClickPayload): Promise<{ success: boolean; data?: EventTrackingResponse; message: string }> {
    const eventName = (payload?.eventName || '').trim()
    const pageName = (payload?.pageName || '').trim()

    if (!eventName || !pageName) {
      return { success: false, message: '缺少埋点事件名称或页面名称' }
    }

    const body = this.createBaseEventBody({
      eventType: DEFAULT_EVENT_TYPE,
      eventName,
      pageName
    })

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

  async trackTaskComplete(payload: TrackTaskCompletePayload): Promise<{ success: boolean; data?: EventTrackingResponse; message: string }> {
    const taskId = (payload?.taskId || '').trim()
    const moduleName = (payload?.moduleName || '').trim()

    if (!taskId || !moduleName) {
      return { success: false, message: '缺少任务 ID 或任务模块名称' }
    }

    const eventConfig = TASK_COMPLETE_EVENT_MAP[moduleName] || {
      eventName: DRAMA_OUTPUT_EVENT_NAME,
      pageName: 'unknown'
    }
    const eventName = eventConfig.eventName
    const pageName = (payload?.pageName || eventConfig.pageName).trim()
    const generatedVideoCount = Math.max(0, Math.floor(Number.isFinite(payload.generatedVideoCount) ? Number(payload.generatedVideoCount) : 0))

    if (generatedVideoCount === 0) {
      console.log('[EventTracking] 任务无视频产出，跳过 drama_output 上报:', {
        taskId,
        moduleName,
        pageName
      })
      return {
        success: true,
        data: {
          code: 0,
          message: '任务无视频产出，跳过上报'
        },
        message: '任务无视频产出，跳过上报'
      }
    }

    console.log('[EventTracking] 准备上报任务完成事件:', {
      taskId,
      moduleName,
      eventName,
      pageName,
      generatedVideoCount
    })

    const reportResults = await this.postRepeatedOutputEvents({
      count: generatedVideoCount,
      eventName,
      pageName,
      taskId,
      moduleName
    })

    const failedCount = reportResults.filter((result) => !result.success).length
    const successCount = reportResults.length - failedCount

    console.log('[EventTracking] 任务产出物埋点上报完成:', {
      taskId,
      moduleName,
      generatedVideoCount,
      successCount,
      failedCount
    })

    return {
      success: failedCount === 0,
      data: {
        code: failedCount === 0 ? 0 : -1,
        data: {
          total: generatedVideoCount,
          successCount,
          failedCount
        },
        message: failedCount === 0 ? '任务产出物上报完成' : `任务产出物上报部分失败: ${failedCount}/${generatedVideoCount}`
      },
      message: failedCount === 0 ? '任务产出物上报完成' : `任务产出物上报部分失败: ${failedCount}/${generatedVideoCount}`
    }
  }

  private async postRepeatedOutputEvents(options: {
    count: number
    eventName: string
    pageName: string
    taskId: string
    moduleName: string
  }): Promise<Array<{ success: boolean; response?: EventTrackingResponse; error?: string }>> {
    const results: Array<{ success: boolean; response?: EventTrackingResponse; error?: string }> = []
    let nextIndex = 0

    const worker = async () => {
      while (nextIndex < options.count) {
        const currentIndex = nextIndex++
        const body = this.createBaseEventBody({
          eventType: DEFAULT_EVENT_TYPE,
          eventName: options.eventName,
          pageName: options.pageName
        })

        console.log('[EventTracking] 上报产出物事件:', {
          taskId: options.taskId,
          moduleName: options.moduleName,
          index: currentIndex + 1,
          total: options.count,
          eventName: options.eventName,
          pageName: options.pageName,
          uuid: body.uuid,
          clientTime: body.client_time
        })

        try {
          const response = await this.postEvent(body)
          results[currentIndex] = {
            success: response.code === undefined || response.code === 0,
            response
          }
        } catch (error) {
          results[currentIndex] = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    }

    const workerCount = Math.min(TASK_COMPLETE_REPORT_CONCURRENCY, options.count)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return results
  }

  private createBaseEventBody(options: {
    eventType: string
    eventName: string
    pageName: string
    customizedId?: string
    customizedType?: string
  }): Record<string, unknown> {
    return {
      uuid: randomUUID(),
      os: DEFAULT_OS,
      client_type: CLIENT_TYPE,
      customized_id: options.customizedId || '',
      customized_type: options.customizedType || '',
      event_type: options.eventType,
      event_time: 0,
      event_name: options.eventName,
      page_name: options.pageName,
      client_time: Date.now()
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
