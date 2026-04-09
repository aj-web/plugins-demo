// 统一日志初始化
require('./logger-init');

const axios = require('axios');
const path = require('path');
const fs = require('fs');

/**
 * 视频去重服务
 * 调用本地 HTTP 服务进行视频指纹库建立和查重分析
 */
class VideoDedupService {
  constructor() {
    this.apiUrl = 'http://localhost:8000/api';
    this.maxRetries = 150; // 最多等待 300 秒
    this.pollInterval = 1000; // 轮询间隔 1 秒
  }

  /**
   * 等待服务启动
   */
  async waitForServer() {
    console.log('[VideoDedupService] 等待去重服务启动...');
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        await axios.get(`${this.apiUrl}/config`, { timeout: 2000 });
        console.log('[VideoDedupService] 去重服务已就绪');
        return true;
      } catch (error) {
        if (i % 10 === 0) {
          console.log(`[VideoDedupService] 等待中... (${i * 2}s)`);
        }
        await this.sleep(2000);
      }
    }
    console.error('[VideoDedupService] 去重服务启动超时');
    return false;
  }

  /**
   * 清理数据库
   */
  async clearDatabase() {
    console.log('[VideoDedupService] 清理数据库...');
    try {
      // 获取所有剧集
      const res = await axios.get(`${this.apiUrl}/series`);
      const seriesList = res.data || [];
      console.log(`[VideoDedupService] 当前剧集: ${seriesList.length} 个`);

      // 逐个删除
      for (const seriesName of seriesList) {
        console.log(`[VideoDedupService] 删除剧集: ${seriesName}`);
        await axios.delete(`${this.apiUrl}/series`, {
          params: { name: seriesName }
        });
      }

      // 验证
      const verifyRes = await axios.get(`${this.apiUrl}/series`);
      if (!verifyRes.data || verifyRes.data.length === 0) {
        console.log('[VideoDedupService] 数据库已清空');
        return true;
      } else {
        console.warn(`[VideoDedupService] 数据库未完全清空: ${verifyRes.data}`);
        return false;
      }
    } catch (error) {
      console.error('[VideoDedupService] 清理数据库失败:', error.message);
      return false;
    }
  }

  /**
   * 导入视频库（建立指纹库）
   * @param {string} folderPath - 视频文件夹路径（UserGrowth 全量视频）
   * @param {string} seriesName - 剧集名称
   */
  async importVideos(folderPath, seriesName) {
    console.log(`[VideoDedupService] 开始导入视频库: ${seriesName}`);
    console.log(`[VideoDedupService] 文件夹路径: ${folderPath}`);

    try {
      // 检查文件夹是否存在
      if (!fs.existsSync(folderPath)) {
        throw new Error(`文件夹不存在: ${folderPath}`);
      }

      // 提交导入任务
      const res = await axios.post(`${this.apiUrl}/import`, {
        folder_path: folderPath,
        series_name: seriesName
      });

      const taskId = res.data.task_id;
      console.log(`[VideoDedupService] 导入任务已提交, Task ID: ${taskId}`);

      // 轮询任务状态
      const result = await this.pollTask(taskId, '导入视频库');

      if (result.status === 'completed') {
        console.log(`[VideoDedupService] 视频库导入完成: ${seriesName}`);

        // 验证导入结果
        const videosRes = await axios.get(`${this.apiUrl}/videos`, {
          params: { series: seriesName }
        });
        const videos = videosRes.data || [];
        console.log(`[VideoDedupService] 成功索引 ${videos.length} 个视频`);

        return { success: true, videoCount: videos.length };
      } else {
        throw new Error(result.error || '导入任务失败');
      }
    } catch (error) {
      console.error(`[VideoDedupService] 导入视频库失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 分析视频（查重去重）
   * @param {string} videoFolderPath - 待分析视频文件夹路径（ByteGrowth 片段）
   * @param {string} seriesName - 剧集名称（用于过滤）
   * @param {string} outputPath - 结果输出路径
   */
  async analyzeVideos(videoFolderPath, seriesName, outputPath) {
    console.log(`[VideoDedupService] 开始分析视频: ${seriesName}`);
    console.log(`[VideoDedupService] 视频文件夹: ${videoFolderPath}`);
    console.log(`[VideoDedupService] 输出路径: ${outputPath}`);

    try {
      // 检查文件夹是否存在
      if (!fs.existsSync(videoFolderPath)) {
        throw new Error(`文件夹不存在: ${videoFolderPath}`);
      }

      // 确保输出目录存在
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
        console.log(`[VideoDedupService] 创建输出目录: ${outputPath}`);
      }

      // 扫描所有 .mp4 文件
      const files = fs.readdirSync(videoFolderPath).filter((f) => f.endsWith('.mp4'));
      console.log(`[VideoDedupService] 找到 ${files.length} 个视频文件`);

      if (files.length === 0) {
        console.warn('[VideoDedupService] 没有找到视频文件');
        return { success: true, analyzedCount: 0, tasks: [] };
      }

      // 提交所有分析任务
      const tasks = [];
      for (const file of files) {
        const videoPath = path.join(videoFolderPath, file);
        console.log(`[VideoDedupService] 提交分析任务: ${file}`);

        try {
          const res = await axios.post(`${this.apiUrl}/analyze`, {
            video_path: videoPath,
            series_name: seriesName,
            output_path: outputPath
          });

          if (res.status === 200 && res.data.task_id) {
            const taskId = res.data.task_id;
            tasks.push({ id: taskId, file: file, videoPath: videoPath });
            console.log(`[VideoDedupService]   Task ID: ${taskId}`);
          } else {
            console.error(`[VideoDedupService]   提交失败: ${res.data}`);
          }
        } catch (error) {
          console.error(`[VideoDedupService]   提交异常: ${error.message}`);
        }
      }

      if (tasks.length === 0) {
        throw new Error('所有分析任务提交失败');
      }

      console.log(`[VideoDedupService] 成功提交 ${tasks.length} 个分析任务，开始轮询...`);

      // 轮询所有任务
      const results = await this.pollMultipleTasks(tasks);

      // 统计结果
      const successCount = results.filter((r) => r.status === 'completed').length;
      const failCount = results.filter((r) => r.status === 'failed').length;

      console.log(`[VideoDedupService] 分析完成: 成功 ${successCount}, 失败 ${failCount}`);

      return {
        success: true,
        analyzedCount: tasks.length,
        successCount: successCount,
        failCount: failCount,
        results: results
      };
    } catch (error) {
      console.error(`[VideoDedupService] 分析视频失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 轮询单个任务状态
   */
  async pollTask(taskId, taskName = '任务') {
    let lastLogIndex = 0;

    while (true) {
      try {
        const res = await axios.get(`${this.apiUrl}/tasks/${taskId}`);
        const task = res.data;
        const status = task.status;
        const progress = task.progress || 0;

        // 打印新日志
        const logs = task.logs || [];
        if (logs.length > lastLogIndex) {
          for (let i = lastLogIndex; i < logs.length; i++) {
            console.log(`[VideoDedupService] [${progress}%] ${logs[i]}`);
          }
          lastLogIndex = logs.length;
        }

        // 检查是否完成
        if (status === 'completed' || status === 'failed') {
          return {
            status: status,
            result: task.result,
            error: task.error
          };
        }

        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error(`[VideoDedupService] 轮询${taskName}失败: ${error.message}`);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * 轮询多个任务状态
   */
  async pollMultipleTasks(tasks) {
    const results = [];
    const pending = [...tasks];

    console.log(`[VideoDedupService] 开始轮询 ${pending.length} 个任务...`);

    while (pending.length > 0) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const task = pending[i];

        try {
          const res = await axios.get(`${this.apiUrl}/tasks/${task.id}`);
          const taskInfo = res.data;
          const status = taskInfo.status;

          if (status === 'completed' || status === 'failed') {
            console.log(`[VideoDedupService] 任务 ${task.id} (${task.file}): ${status}`);

            if (status === 'completed') {
              // 添加调试日志
              console.log('[VideoDedupService]   完整返回结果:', JSON.stringify(taskInfo.result, null, 2));
              
              const restoredVideo = taskInfo.result?.restored_video;
              if (restoredVideo && fs.existsSync(restoredVideo)) {
                console.log(`[VideoDedupService]   去重视频: ${restoredVideo}`);

                // 检查附件文件
                const base = path.parse(restoredVideo).name;
                const dir = path.dirname(restoredVideo);
                const plotPath = path.join(dir, `${base}.png`);
                const logPath = path.join(dir, `${base}.log`);

                if (fs.existsSync(plotPath)) {
                  console.log(`[VideoDedupService]   可视化图表: ${plotPath}`);
                }
                if (fs.existsSync(logPath)) {
                  console.log(`[VideoDedupService]   分析日志: ${logPath}`);
                }
              } else {
                console.warn(`[VideoDedupService]   去重视频未找到: ${restoredVideo}`);
              }
            } else {
              console.error(`[VideoDedupService]   错误: ${taskInfo.error}`);
            }

            results.push({
              taskId: task.id,
              file: task.file,
              videoPath: task.videoPath,
              status: status,
              result: taskInfo.result,
              error: taskInfo.error
            });

            pending.splice(i, 1);
          }
        } catch (error) {
          console.error(`[VideoDedupService] 轮询任务 ${task.id} 失败: ${error.message}`);
        }
      }

      if (pending.length > 0) {
        await this.sleep(2000);
        process.stdout.write('.');
      }
    }

    console.log('\n[VideoDedupService] 所有任务已完成');
    return results;
  }

  /**
   * 完整流程：导入 + 分析
   * @param {string} userGrowthPath - UserGrowth 全量视频路径（用于建立指纹库）
   * @param {string} byteGrowthPath - ByteGrowth 片段视频路径（用于查重分析）
   * @param {string} seriesName - 剧集名称
   * @param {string} outputPath - 结果输出路径
   */
  async processDeduplication(userGrowthPath, byteGrowthPath, seriesName, outputPath) {
    console.log('[VideoDedupService] ========== 开始视频去重流程 ==========');
    console.log(`[VideoDedupService] 剧集名称: ${seriesName}`);
    console.log(`[VideoDedupService] 全量视频路径: ${userGrowthPath}`);
    console.log(`[VideoDedupService] 片段视频路径: ${byteGrowthPath}`);
    console.log(`[VideoDedupService] 输出路径: ${outputPath}`);

    try {
      // 1. 检查服务是否启动
      const serverReady = await this.waitForServer();
      if (!serverReady) {
        console.error('[VideoDedupService] 去重服务未启动，跳过去重流程');
        return { success: false, error: '去重服务未启动' };
      }

      // 2. 清理数据库（可选，这里执行清理）
      await this.clearDatabase();

      // 3. 导入全量视频（建立指纹库）
      const importResult = await this.importVideos(userGrowthPath, seriesName);
      if (!importResult.success) {
        throw new Error(`导入视频库失败: ${importResult.error}`);
      }

      // 4. 分析片段视频（查重去重）
      const analyzeResult = await this.analyzeVideos(byteGrowthPath, seriesName, outputPath);
      if (!analyzeResult.success) {
        throw new Error(`分析视频失败: ${analyzeResult.error}`);
      }

      console.log('[VideoDedupService] ========== 视频去重流程完成 ==========');
      return {
        success: true,
        import: importResult,
        analyze: analyzeResult
      };
    } catch (error) {
      console.error(`[VideoDedupService] 去重流程失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 工具方法：延迟
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = VideoDedupService;
