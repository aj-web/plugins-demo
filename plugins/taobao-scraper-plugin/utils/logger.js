// 简单的文件日志工具，供淘宝插件各个 Node 脚本复用
const fs = require('fs');
const path = require('path');
const os = require('os');

// 日志文件名
const LOG_FILE_NAME = 'taobao-scraper-plugin-log.txt';

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
    // 静默失败，避免影响主流程
  }
}

function info(message, data) {
  writeLog('INFO', message, data);
}

function warn(message, data) {
  writeLog('WARN', message, data);
}

function error(message, data) {
  writeLog('ERROR', message, data);
}

function debug(message, data) {
  writeLog('DEBUG', message, data);
}

module.exports = {
  info,
  warn,
  error,
  debug,
  writeLog
};
