import fs from 'fs'
import path from 'path'
import { app } from 'electron'

class Logger {
  private logFile: string
  private isInitialized: boolean = false

  constructor() {
    // 在用户目录下创建日志文件
    const userDataPath = app.getPath('userData')
    this.logFile = path.join(userDataPath, 'app-debug.log')
    this.initialize()
  }

  private initialize() {
    try {
      // 确保目录存在
      const logDir = path.dirname(this.logFile)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }

      // 清空之前的日志文件
      fs.writeFileSync(this.logFile, '')
      this.isInitialized = true
      this.log('Logger initialized', { logFile: this.logFile })
    } catch (error) {
      console.error('Failed to initialize logger:', error)
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : ''
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`
  }

  private writeToFile(message: string) {
    if (!this.isInitialized) return
    
    try {
      fs.appendFileSync(this.logFile, message)
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  log(message: string, data?: any) {
    const formattedMessage = this.formatMessage('INFO', message, data)
    console.log(message, data || '')
    this.writeToFile(formattedMessage)
  }

  error(message: string, data?: any) {
    const formattedMessage = this.formatMessage('ERROR', message, data)
    console.error(message, data || '')
    this.writeToFile(formattedMessage)
  }

  warn(message: string, data?: any) {
    const formattedMessage = this.formatMessage('WARN', message, data)
    console.warn(message, data || '')
    this.writeToFile(formattedMessage)
  }

  debug(message: string, data?: any) {
    const formattedMessage = this.formatMessage('DEBUG', message, data)
    console.log(`[DEBUG] ${message}`, data || '')
    this.writeToFile(formattedMessage)
  }

  getLogFilePath(): string {
    return this.logFile
  }
}

export const logger = new Logger() 