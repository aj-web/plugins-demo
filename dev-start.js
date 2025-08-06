const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 启动开发环境...')

let viteProcess = null
let electronProcess = null

// 启动 Vite 开发服务器
function startVite() {
  console.log('📦 启动 Vite 开发服务器...')
  
  viteProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  })

  viteProcess.on('error', (error) => {
    console.error('❌ Vite 启动失败:', error)
  })

  viteProcess.on('close', (code) => {
    console.log(`Vite 进程退出，代码: ${code}`)
    if (electronProcess) {
      electronProcess.kill()
    }
  })
}

// 启动 Electron
function startElectron() {
  console.log('📱 启动 Electron...')
  
  electronProcess = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  })

  electronProcess.on('error', (error) => {
    console.error('❌ Electron 启动失败:', error)
  })

  electronProcess.on('close', (code) => {
    console.log(`Electron 进程退出，代码: ${code}`)
    if (viteProcess) {
      viteProcess.kill()
    }
  })
}

// 检查 Vite 服务器是否可用
async function checkViteServer() {
  return new Promise((resolve) => {
    const check = () => {
      const http = require('http')
      const req = http.request('http://localhost:3000', { method: 'GET' }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Vite 服务器已就绪')
          resolve(true)
        } else {
          setTimeout(check, 1000)
        }
      })
      
      req.on('error', () => {
        setTimeout(check, 1000)
      })
      
      req.setTimeout(1000, () => {
        req.destroy()
        setTimeout(check, 1000)
      })
      
      req.end()
    }
    
    check()
  })
}

// 主启动流程
async function startDev() {
  // 启动 Vite
  startVite()
  
  // 等待 Vite 服务器就绪
  console.log('⏳ 等待 Vite 服务器启动...')
  await checkViteServer()
  
  // 启动 Electron
  startElectron()
}

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭开发环境...')
  if (viteProcess) {
    viteProcess.kill()
  }
  if (electronProcess) {
    electronProcess.kill()
  }
  process.exit(0)
})

// 启动开发环境
startDev().catch(error => {
  console.error('启动失败:', error)
  process.exit(1)
}) 