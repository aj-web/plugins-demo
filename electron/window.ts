import { BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    return this.mainWindow
  }

  loadContent(): void {
    if (!this.mainWindow) return

    // 开发环境
    if (process.env.NODE_ENV === 'development') {
      this.loadLocalFile()
      this.mainWindow.webContents.openDevTools()
    } else {
      // 生产环境
      this.loadLocalFile()
    }
  }

  private loadLocalFile(): void {
    if (!this.mainWindow) return

    // 尝试加载构建后的文件
    const indexPath = path.join(__dirname, '../dist/index.html')
    if (fs.existsSync(indexPath)) {
      console.log('加载构建后的文件:', indexPath)
      this.mainWindow.loadFile(indexPath)
    } else {
      // 如果dist目录不存在，尝试加载根目录的index.html
      const rootIndexPath = path.join(__dirname, '../index.html')
      if (fs.existsSync(rootIndexPath)) {
        console.log('加载根目录文件:', rootIndexPath)
        this.mainWindow.loadFile(rootIndexPath)
      } else {
        console.error('找不到index.html文件')
        this.mainWindow.loadURL('data:text/html,<h1>找不到index.html文件</h1><p>请先运行 npm run build 构建前端代码</p>')
      }
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  closeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
      this.mainWindow = null
    }
  }
}

export const windowManager = new WindowManager() 