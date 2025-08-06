const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 启动 Electron 应用...')

// 设置环境变量
process.env.NODE_ENV = 'development'

// 启动 Electron
const electron = spawn('electron', ['.'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
})

electron.on('error', (error) => {
  console.error('❌ Electron 启动失败:', error)
})

electron.on('close', (code) => {
  console.log(`Electron 进程退出，代码: ${code}`)
})

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭 Electron...')
  electron.kill()
  process.exit(0)
}) 