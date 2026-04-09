/**
 * 爆款混剪节点
 * 负责将复刻片段与录屏话术进行混剪处理
 */

// 统一日志初始化
require('./logger-init');

const TaskDataManager = require('../utils/taskDataManager');
const { initializeFfmpeg } = require('../utils/ffmpeg-locator');
const { VideoMixer } = require('../utils/video-mixer');
const path = require('path');
const fs = require('fs').promises;

class MixEditNode {
  constructor() {
    // 使用统一的 JSON 文件管理任务
    this.taskManager = new TaskDataManager('smart-short-drama-data.json');
    this.ffmpegPath = null;
    this.ffprobePath = null;
    this.videoMixer = null;
    console.log('[MixEdit] 节点已初始化');
  }

  /**
   * 格式化日期时间
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的时间字符串
   */
  formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 自动启动混剪处理
   * @param {string} replicationClipsPath - 复刻片段路径
   * @param {string} scriptsPath - 录屏话术路径
   * @param {string} outputPath - 成品存储路径
   * @param {number} processCount - 处理剧目数量
   * @param {object} overlayModes - 叠加模式配置 { hook: boolean, post: boolean }
   * @param {number} hookSeconds - 钩子保留时长（秒）
   * @param {boolean} isScheduledTask - 是否为定时任务
   * @returns {Promise<Object>} 处理结果
   */
  async autoStartProcessing(
    replicationClipsPath,
    scriptsPath,
    outputPath,
    processCount = 5,
    overlayModes = { hook: true, post: false },
    hookSeconds = 3,
    isScheduledTask = false
  ) {
    console.log('[MixEdit] autoStartProcessing 开始执行');
    console.log('[MixEdit] 接收到的参数:', {
      replicationClipsPath,
      scriptsPath,
      outputPath,
      processCount,
      overlayModes,
      hookSeconds,
      isScheduledTask
    });

    // 懒加载任务队列
    const taskQueue = require('../utils/task-queue');
    if (!taskQueue.taskManager) {
      taskQueue.init(this.taskManager);
    }

    // 1. 创建 Task 对象
    const taskId = Date.now().toString();
    const now = new Date();
    const timeStr = this.formatDateTime(now);

    // 计算输出路径
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const finalOutputPath = path.join(outputPath, '混剪成品', dateStr);

    const task = {
      id: taskId,
      name: timeStr,
      module: '爆款混剪',
      createdAt: timeStr,
      completedAt: '', // 完成时间（初始为空）
      status: '待执行', // 初始状态
      outputPath: finalOutputPath,
      result: {
        message: '',
        successCount: 0,
        failedCount: 0,
        successDramas: new Set(),
        failedDramas: new Set(),
        details: {} // { dramaDir: { hookVideo: 'path', postVideo: 'path' } }
      },
      params: {
        replicationClipsPath,
        scriptsPath,
        outputPath, // 保存原始用户选择的路径
        processCount,
        overlayModes,
        hookSeconds,
        isScheduledTask
      }
    };

    // 2. 定义执行函数（真正的业务逻辑）
    const executor = async (params) => {
      console.log('[MixEdit] 开始执行任务业务逻辑');
      console.log('[MixEdit] 执行参数:', params);

      try {
        // ========== 核心业务逻辑 ==========
        
        // 1. 验证输入路径
        console.log('[MixEdit] 步骤1: 验证输入路径');
        await this.validatePaths(params.replicationClipsPath, params.scriptsPath);

        // 2. 扫描复刻片段和话术文件
        console.log('[MixEdit] 步骤2: 扫描复刻片段和话术文件');
        const dramaVideos = await this.scanVideoFiles(params.replicationClipsPath, params.processCount);
        const scriptFiles = await this.scanScriptFiles(params.scriptsPath);

        console.log(`[MixEdit] 找到 ${dramaVideos.length} 个视频（已按剧目数截取）`);
        console.log(`[MixEdit] 找到 ${scriptFiles.length} 个话术文件`);

        // 3. 创建输出目录
        console.log('[MixEdit] 步骤3: 创建输出目录');
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const finalOutputPath = path.join(params.outputPath, '混剪成品', dateStr);
        await fs.mkdir(finalOutputPath, { recursive: true });

        // 4. 批量处理混剪任务
        console.log('[MixEdit] 步骤4: 批量处理混剪任务');
        const results = await this.processMixEdit(
          dramaVideos,
          scriptFiles,
          finalOutputPath,
          params.overlayModes,
          params.hookSeconds
        );

        console.log(`[MixEdit] 混剪处理完成，成功: ${results.successCount}, 失败: ${results.failedCount}`);

        // 5. 返回结果
        return {
          success: true,
          message: `混剪完成！成功处理 ${results.successCount} 部，失败 ${results.failedCount} 部`,
          outputPath: finalOutputPath,
          successCount: results.successCount,
          failedCount: results.failedCount,
          successDramas: [...successSet],
          failedDramas: [...failedSet],
          details: results.details
        };
      } catch (error) {
        console.error('[MixEdit] 任务执行失败:', error);
        return {
          success: false,
          message: `混剪失败: ${error.message}`,
          outputPath: finalOutputPath,
          successCount: 0,
          failedCount: 0,
          successDramas: [],
          failedDramas: [],
          details: {}
        };
      }
    };

    // 3. 将任务加入队列
    console.log('[MixEdit] 将任务加入队列:', task.id);
    await taskQueue.addTask(task, executor);

    // 4. 返回任务信息给前端
    return {
      success: true,
      taskId: task.id,
      message: '混剪任务已加入队列'
    };
  }

  /**
   * 验证输入路径是否存在
   */
  async validatePaths(replicationClipsPath, scriptsPath) {
    console.log('[MixEdit] 验证路径:', { replicationClipsPath, scriptsPath });

    try {
      await fs.access(replicationClipsPath);
      console.log('[MixEdit] 复刻片段路径有效');
    } catch (error) {
      throw new Error(`复刻片段路径无效: ${replicationClipsPath}`);
    }

    try {
      await fs.access(scriptsPath);
      console.log('[MixEdit] 录屏话术路径有效');
    } catch (error) {
      throw new Error(`录屏话术路径无效: ${scriptsPath}`);
    }
  }

  /**
   * 扫描复刻片段视频文件（按新目录结构：日期/剧名/视频.mp4）
   * 先按剧名排序取前 processCount 个剧名文件夹，再扫描这些剧下的所有视频
   * @param {string} folderPath - 复刻片段日期文件夹路径（如 D:\ShortDrama\复刻片段\2026-03-31）
   * @param {number} processCount - 限制处理的剧目数量
   * @returns {Promise<Array>} 视频列表 [{ name: 文件名（不含扩展名）, ext: 扩展名, path: 完整路径, dramaDir: 剧名 }]
   */
  async scanVideoFiles(folderPath, processCount) {
    console.log('[MixEdit] 扫描剧名子文件夹:', folderPath, '，限制剧目数:', processCount);

    const allDirs = await fs.readdir(folderPath);
    const dramaDirs = [];
    for (const item of allDirs) {
      const stat = await fs.stat(path.join(folderPath, item));
      if (stat.isDirectory()) {
        dramaDirs.push(item);
      }
    }
    // 按文件夹名称排序，取前 N 个剧
    dramaDirs.sort();
    const selectedDramas = dramaDirs.slice(0, processCount);
    console.log(`[MixEdit] 共 ${dramaDirs.length} 个剧目，选中前 ${selectedDramas.length} 个:`, selectedDramas);

    const allVideoFiles = [];
    for (const dramaDir of selectedDramas) {
      const dramaPath = path.join(folderPath, dramaDir);
      const files = await fs.readdir(dramaPath);
      for (const file of files) {
        if (/\.(mp4|avi|mov|mkv)$/i.test(file)) {
          allVideoFiles.push({
            name: path.parse(file).name,
            ext: path.extname(file),
            path: path.join(dramaPath, file),
            dramaDir: dramaDir
          });
        }
      }
    }

    console.log(`[MixEdit] 扫描到 ${allVideoFiles.length} 个视频文件`);
    return allVideoFiles;
  }

  /**
   * 扫描录屏话术文件
   * @param {string} scriptsPath - 话术文件夹路径
   * @returns {Promise<Array>} 话术文件列表
   */
  async scanScriptFiles(scriptsPath) {
    console.log('[MixEdit] 扫描话术文件:', scriptsPath);

    const items = await fs.readdir(scriptsPath);
    const videoFiles = items
      .filter(item => /\.(mp4|avi|mov|mkv)$/i.test(item))
      .map(item => ({
        name: item,
        path: path.join(scriptsPath, item)
      }));

    console.log('[MixEdit] 找到话术文件:', videoFiles.map(f => f.name));
    return videoFiles;
  }

  /**
   * 批量处理混剪任务
   * @param {Array} dramaVideos - 复刻视频文件列表
   * @param {Array} scriptFiles - 话术文件列表
   * @param {string} outputPath - 输出路径
   * @param {object} overlayModes - 叠加模式
   * @param {number} hookSeconds - 钩子时长
   * @returns {Promise<Object>} 处理结果
   */
  async processMixEdit(dramaVideos, scriptFiles, outputPath, overlayModes, hookSeconds) {
    console.log('[MixEdit] 开始批量混剪处理');

    // 初始化 FFmpeg（只在第一次调用时初始化）
    if (!this.ffmpegPath || !this.ffprobePath) {
      try {
        const ffmpegPaths = initializeFfmpeg();
        this.ffmpegPath = ffmpegPaths.ffmpegPath;
        this.ffprobePath = ffmpegPaths.ffprobePath;
        this.videoMixer = new VideoMixer(this.ffmpegPath, this.ffprobePath, true); // 启用 GPU 加速
        
        // 等待 GPU 检测完成
        console.log('[MixEdit] 等待 GPU 检测...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 显示 GPU 状态
        const gpuStatus = this.videoMixer.getGPUStatus();
        console.log('[MixEdit] GPU 状态:', gpuStatus.message);
        if (gpuStatus.detected) {
          console.log('[MixEdit] GPU 编码器:', gpuStatus.encoder);
        }
      } catch (error) {
        console.error('[MixEdit] FFmpeg 初始化失败:', error.message);
        throw error;
      }
    }

    // 创建临时目录和输出子目录（按剧名分子文件夹）
    const tempDir = path.join(outputPath, '.temp');
    const postDir = path.join(outputPath, '纯后置');
    const hookDir = path.join(outputPath, '钩子');
    
    await fs.mkdir(tempDir, { recursive: true });
    if (overlayModes.post) {
      await fs.mkdir(postDir, { recursive: true });
      console.log('[MixEdit] 纯后置输出目录:', postDir);
    }
    if (overlayModes.hook) {
      await fs.mkdir(hookDir, { recursive: true });
      console.log('[MixEdit] 钩子输出目录:', hookDir);
    }
    console.log('[MixEdit] 临时目录:', tempDir);

    // 用 Set 分别记录成功/失败的唯一剧名
    const successSet = new Set();
    const failedSet = new Set();

    const results = {
      successCount: 0,
      failedCount: 0,
      successDramas: successSet,
      failedDramas: failedSet,
      details: {}
    };

    // 检查话术文件数量
    if (scriptFiles.length === 0) {
      throw new Error('话术文件夹中没有视频文件');
    }

    // 轮询组合：每个复刻视频与话术视频轮询配对
    for (let i = 0; i < dramaVideos.length; i++) {
      const dramaVideo = dramaVideos[i];
      // 使用取模运算实现轮询
      const scriptFile = scriptFiles[i % scriptFiles.length];

      try {
        console.log(`\n[MixEdit] ========== 处理组合 ${i + 1}/${dramaVideos.length} ==========`);
        console.log(`[MixEdit] 剧目: ${dramaVideo.dramaDir}`);
        console.log(`[MixEdit] 复刻视频: ${dramaVideo.name}${dramaVideo.ext}`);
        console.log(`[MixEdit] 话术视频: ${scriptFile.name} (索引: ${i % scriptFiles.length})`);

        // 生成两种模式的视频（根据用户配置）
        const outputVideos = [];

            // 1. 纯后置叠加模式
            if (overlayModes.post) {
              // 按剧名创建子文件夹
              const postDramaDir = path.join(postDir, dramaVideo.dramaDir);
              await fs.mkdir(postDramaDir, { recursive: true });

              const postOutputPath = path.join(
                postDramaDir,
                `${dramaVideo.dramaDir}_${dramaVideo.name}_${scriptFile.name}_post.mp4`
              );
              console.log(`[MixEdit] 生成纯后置版本: 纯后置/${dramaVideo.dramaDir}/${path.basename(postOutputPath)}`);

              await this.videoMixer.mixPostMode(
                dramaVideo.path,
                scriptFile.path,
                postOutputPath,
                tempDir
              );

              outputVideos.push({
                mode: 'post',
                path: postOutputPath
              });
            }

            // 2. 留钩子叠加模式
            if (overlayModes.hook) {
              // 按剧名创建子文件夹
              const hookDramaDir = path.join(hookDir, dramaVideo.dramaDir);
              await fs.mkdir(hookDramaDir, { recursive: true });

              const hookOutputPath = path.join(
                hookDramaDir,
                `${dramaVideo.dramaDir}_${dramaVideo.name}_${scriptFile.name}_hook.mp4`
              );
              console.log(`[MixEdit] 生成留钩子版本: 钩子/${dramaVideo.dramaDir}/${path.basename(hookOutputPath)}`);

              await this.videoMixer.mixHookMode(
                dramaVideo.path,
                scriptFile.path,
                hookOutputPath,
                hookSeconds,
                tempDir
              );

              outputVideos.push({
                mode: 'hook',
                path: hookOutputPath
              });
            }

        // 记录成功（按输入文件名维度，避免同剧名下多个视频互相覆盖）
        const inputKey = `${dramaVideo.dramaDir}/${dramaVideo.name}_${scriptFile.name}`;
        if (!results.details[inputKey]) {
          results.details[inputKey] = {};
        }
        outputVideos.forEach(video => {
          results.details[inputKey][`${video.mode}Video`] = video.path;
        });

        results.successCount++;
        successSet.add(dramaVideo.dramaDir);
        console.log(`[MixEdit] 混剪成功: ${dramaVideo.dramaDir} + ${scriptFile.name}`);

      } catch (error) {
        console.error(`[MixEdit] 混剪失败: ${dramaVideo.dramaDir}/${dramaVideo.name} + ${scriptFile.name}`, error.message);
        results.failedCount++;
        failedSet.add(`${dramaVideo.dramaDir}_${scriptFile.name}`);
      }
    }

    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('[MixEdit] 临时目录已清理');
    } catch (error) {
      console.warn('[MixEdit] 清理临时目录失败:', error.message);
    }

    console.log('\n[MixEdit] ========== 批量混剪处理完成 ==========');
    console.log(`[MixEdit] 成功: ${results.successCount} 个视频`);
    console.log(`[MixEdit] 失败: ${results.failedCount} 个视频`);
    
    return results;
  }
}

module.exports = { MixEditNode };


