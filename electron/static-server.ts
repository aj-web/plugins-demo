import http from 'http'
import fs from 'fs'
import path from 'path'
import url from 'url'
import pathManager from '../utils/path-manager'

class StaticServer {
  private server: http.Server | null = null
  private port: number = 0

  start(): void {
    if (this.server) return

    const pluginsRoot = pathManager.getPluginsDir()

    this.server = http.createServer((req, res) => {
      try {
        // CORS 允许来自任何来源（iframe sandbox 的 opaque origin 也能访问）
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        // 允许跨源加载资源（字体等）
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        const parsed = url.parse(req.url || '/')
        let pathname = decodeURIComponent(parsed.pathname || '/')

        // 仅允许访问 /<pluginName>/... 路径
        if (!pathname || pathname === '/') {
          res.statusCode = 404
          res.end('Not Found')
          return
        }

        // 规范化路径，禁止 .. 跳转
        const safePath = path.normalize(path.join(pluginsRoot, pathname))
        if (!safePath.startsWith(pluginsRoot)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        let filePath = safePath
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html')
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const mime = this.getMime(ext)
        res.setHeader('Content-Type', mime)
        res.setHeader('Cache-Control', 'no-cache')

        fs.createReadStream(filePath).pipe(res)
      } catch (e) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })

    this.server.listen(0, '127.0.0.1', () => {
      const addr = this.server?.address()
      if (typeof addr === 'object' && addr) {
        this.port = addr.port
        console.log('[StaticServer] started on', this.getBaseUrl())
      }
    })
  }

  private getMime(ext: string): string {
    switch (ext) {
      case '.html': return 'text/html; charset=utf-8'
      case '.js': return 'application/javascript; charset=utf-8'
      case '.css': return 'text/css; charset=utf-8'
      case '.json': return 'application/json; charset=utf-8'
      case '.png': return 'image/png'
      case '.jpg':
      case '.jpeg': return 'image/jpeg'
      case '.svg': return 'image/svg+xml'
      case '.ico': return 'image/x-icon'
      case '.woff': return 'font/woff'
      case '.woff2': return 'font/woff2'
      case '.ttf': return 'font/ttf'
      default: return 'application/octet-stream'
    }
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }
}

export const staticServer = new StaticServer() 