/**
 * 日志初始化模块
 * 使用 Node.js 模块缓存机制确保只执行一次
 * 
 * 使用方法：在每个需要日志的节点文件开头添加：
 * require('./logger-init');
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 日志文件名
const LOG_FILE_NAME = 'smart-short-drama.txt';

function getLogFilePath() {
  const userDataPath = process.env.APPDATA || os.homedir();
  const logDir = path.join(userDataPath, 'plugins-demo');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, LOG_FILE_NAME);
}

function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = typeof data !== 'undefined' ? ' | Data: ' + JSON.stringify(data) : '';
  return `[${timestamp}] [${String(level).toUpperCase()}] [TAOBAO_PLUGIN] ${String(message)}${dataStr}\n`;
}

function writeLog(level, message, data) {
  try {
    const logFile = getLogFilePath();
    const logMessage = formatMessage(level, message, data);
    fs.appendFileSync(logFile, logMessage);
  } catch (e) {
    // 静默失败
  }
}

// 检查是否已经初始化过（利用模块缓存机制）
// 如果 __loggerInitialized 已经是 true，说明之前已经执行过
if (!global.__loggerInitialized) {
  // 保存原始 console 方法
  const _origLog = console.log;
  const _origInfo = console.info || _origLog;
  const _origWarn = console.warn;
  const _origError = console.error;

  // 重写 console 方法，同时输出到控制台和文件
  console.log = (...args) => {
    try {
      writeLog('INFO', args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origLog.apply(console, args);
  };

  console.info = (...args) => {
    try {
      writeLog('INFO', args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origInfo.apply(console, args);
  };

  console.warn = (...args) => {
    try {
      writeLog('WARN', args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origWarn.apply(console, args);
  };

  console.error = (...args) => {
    try {
      writeLog('ERROR', args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origError.apply(console, args);
  };

  global.__loggerInitialized = true;
  console.log('[Logger] 日志系统已初始化');
}
