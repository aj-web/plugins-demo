import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // 只在开发环境打开 DevTools
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // 窗口准备就绪后显示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  loadContent(): void {
    if (!this.mainWindow) return;

    const indexPath = path.join(__dirname, '../dist/index.html');

    if (fs.existsSync(indexPath)) {
      this.mainWindow.loadFile(indexPath);
    } else {
      // 开发环境回退到根目录
      const rootIndexPath = path.join(__dirname, '../index.html');
      if (fs.existsSync(rootIndexPath)) {
        this.mainWindow.loadFile(rootIndexPath);
      } else {
        this.mainWindow.loadURL('data:text/html,<h1>找不到index.html文件</h1>');
      }
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  closeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }
  }
}

export const windowManager = new WindowManager();
