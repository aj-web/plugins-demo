/**
 * FFmpeg 定位工具
 * 简化版：只检查项目根目录和 Electron 资源路径
 */

const fs = require('fs');
const path = require('path');

/**
 * 查找 FFmpeg 可执行文件
 * @returns {string} FFmpeg 路径
 * @throws {Error} 如果未找到 FFmpeg
 */
function findLocalFfmpeg() {
  // 1. 检查项目根目录
  const projectRootPath = path.join(process.cwd(), 'ffmpeg.exe');
  if (fs.existsSync(projectRootPath)) {
    console.log('[FFmpegLocator] 找到 ffmpeg:', projectRootPath);
    return projectRootPath;
  }

  // 2. 检查 Electron 资源路径
  const resourcePath = path.join(process.resourcesPath || '', 'ffmpeg.exe');
  if (fs.existsSync(resourcePath)) {
    console.log('[FFmpegLocator] 找到 ffmpeg:', resourcePath);
    return resourcePath;
  }

  // 未找到，抛出错误
  throw new Error('未找到 FFmpeg！请将 ffmpeg.exe 放置在项目根目录或 Electron 资源目录');
}

/**
 * 查找 FFprobe 可执行文件
 * @returns {string} FFprobe 路径
 * @throws {Error} 如果未找到 FFprobe
 */
function findLocalFfprobe() {
  // 1. 检查项目根目录
  const projectRootPath = path.join(process.cwd(), 'ffprobe.exe');
  if (fs.existsSync(projectRootPath)) {
    console.log('[FFmpegLocator] 找到 ffprobe:', projectRootPath);
    return projectRootPath;
  }

  // 2. 检查 Electron 资源路径
  const resourcePath = path.join(process.resourcesPath || '', 'ffprobe.exe');
  if (fs.existsSync(resourcePath)) {
    console.log('[FFmpegLocator] 找到 ffprobe:', resourcePath);
    return resourcePath;
  }

  // 未找到，抛出错误
  throw new Error('未找到 FFprobe！请将 ffprobe.exe 放置在项目根目录或 Electron 资源目录');
}

/**
 * 初始化 FFmpeg（同时查找 ffmpeg 和 ffprobe）
 * @returns {Object} { ffmpegPath, ffprobePath }
 */
function initializeFfmpeg() {
  console.log('[FFmpegLocator] 开始初始化 FFmpeg...');
  
  const ffmpegPath = findLocalFfmpeg();
  const ffprobePath = findLocalFfprobe();

  console.log('[FFmpegLocator] FFmpeg 初始化完成');
  console.log('[FFmpegLocator] FFmpeg 路径:', ffmpegPath);
  console.log('[FFmpegLocator] FFprobe 路径:', ffprobePath);

  return { ffmpegPath, ffprobePath };
}

module.exports = {
  findLocalFfmpeg,
  findLocalFfprobe,
  initializeFfmpeg
};
