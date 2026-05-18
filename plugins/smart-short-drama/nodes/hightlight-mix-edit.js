/**
 * 高光混剪节点
 * 负责批量导入剧目数据，自动生成AI文案并混剪
 */

// 统一日志初始化
require('./logger-init');

const TaskDataManager = require('../utils/taskDataManager');
const { BrowserManager } = require('../utils/browser-manager');
const dramaListParser = require('../utils/drama-list-parser');
const { UserGrowthShortFilmNode } = require('./usergrowth-short-film');
const path = require('path');
const fs = require('fs').promises;

class HighlightMixEditNode {
  constructor() {
    // 使用统一的 JSON 文件管理任务
    this.taskManager = new TaskDataManager('smart-short-drama-data.json');
    this.browserManager = new BrowserManager();
    console.log('[HighlightMixEdit] 节点已初始化');
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
   * 仅解析并下载短剧原片（不进行混剪）
   * @param {string} dramaListFilePath - 剧目列表 Excel 文件路径
   * @param {string} outputPath - 成品存储路径
   * @returns {Promise<Object>} 处理结果
   */
  async parseAndDownloadOnly(dramaListFilePath, outputPath) {
    console.log('[HighlightMixEdit] ========== 开始解析并爬取剧目（仅下载模式）==========');
    console.log('[HighlightMixEdit] 参数:');
    console.log('[HighlightMixEdit]  - 剧目列表文件:', dramaListFilePath);
    console.log('[HighlightMixEdit]  - 输出路径:', outputPath);

    const taskId = Date.now().toString();
    const createdAt = this.formatDateTime(new Date());

    try {
      // 1. 创建任务记录（仅包含必要参数）
      const task = {
        id: taskId,
        name: createdAt,
        module: '高光混剪',
        createdAt: createdAt,
        completedAt: '',
        status: '待执行',
        outputPath: outputPath,
        usergrowth: {},
        params: {
          dramaListFilePath: dramaListFilePath,
          imageOverlayFolderPath: '',
          endFrameFolderPath: '',
          outputPath: outputPath,
          endRetentionSeconds: 10,
          isScheduledTask: false,
          downloadOnly: true // 标记为仅下载模式
        },
        result: {
          success: false,
          message: ''
        }
      };

      // 2. 定义执行函数（仅下载逻辑）
      const executor = async (params) => {
        console.log('[HighlightMixEdit] ========== 开始执行仅下载任务 ==========');

        // 步骤2: 获取剧目列表（互斥二选一）
        //   有 Excel → 只用 Excel 剧名（不合并历史任务）
        //   无 Excel → 用最近已完成的高光混剪/爆款复刻任务剧名
        console.log('[HighlightMixEdit] 步骤2: 获取剧目列表...');
        let dramaNames = [];

        if (params.dramaListFilePath && params.dramaListFilePath.trim() !== '') {
          // 2A: 有 Excel，只解析 Excel
          console.log('[HighlightMixEdit] 检测到 Excel 文件，解析剧目列表...');
          const dramaListResult = await this.parseDramaListExcel(params.dramaListFilePath);
          if (dramaListResult.success && dramaListResult.dramaNames.length > 0) {
            dramaNames = dramaListResult.dramaNames;
            console.log('[HighlightMixEdit] Excel 解析出剧目:', dramaNames.length, '个');
          } else {
            throw new Error('Excel 解析失败或剧目列表为空');
          }
        } else {
          // 2B: 无 Excel，读取最近已完成任务的剧名
          console.log('[HighlightMixEdit] 未提供 Excel，从最近任务获取剧目列表...');
          const latestTask = await this.getLatestCompletedTask();
          if (latestTask && latestTask.usergrowth && latestTask.usergrowth.outputPaths) {
            const paths = Array.isArray(latestTask.usergrowth.outputPaths)
              ? latestTask.usergrowth.outputPaths
              : latestTask.usergrowth.outputPaths.split(';').map(p => p.trim()).filter(Boolean);
            dramaNames = paths.map(p => path.basename(p)).filter(name => name);
            console.log('[HighlightMixEdit] 从最近任务提取到剧目:', dramaNames.length, '个');
          }
          if (dramaNames.length === 0) {
            throw new Error('未提供 Excel，且最近任务中没有可用的短剧原片，请上传剧目列表 Excel');
          }
        }

        if (dramaNames.length === 0) {
          throw new Error('无法获取剧目列表，请上传 Excel 或确保已有成功任务');
        }
        console.log('[HighlightMixEdit] 最终剧目列表:', dramaNames);

        // 步骤2: 下载短剧原片
        console.log('[HighlightMixEdit] 步骤2: 下载短剧原片...');
        const downloadResult = await this.downloadDramasFromUserGrowth(dramaNames, params.outputPath);

        console.log('[HighlightMixEdit] 短剧原片下载完成');
        console.log('[HighlightMixEdit] 成功获取剧目数量:', Object.keys(downloadResult.originalCounts).length);
        console.log('[HighlightMixEdit] 输出路径数量:', downloadResult.outputPaths.length);

        if (downloadResult.outputPaths.length === 0) {
          throw new Error('没有成功下载任何短剧原片');
        }

        console.log('[HighlightMixEdit] ========== 仅下载任务执行完成 ==========');

        // 返回结果（只包含 usergrowth 字段，不包含 mixResult）
        return {
          success: true,
          message: `短剧原片下载完成，共下载 ${Object.keys(downloadResult.originalCounts).length} 部短剧`,
          usergrowth: {
            message: '短剧原片处理完成',
            outputPaths: downloadResult.outputPaths,
            originalCounts: downloadResult.originalCounts
          }
        };
      };

      // 3. 加入队列并返回 taskId
      // 懒加载任务队列
      const taskQueue = require('../utils/task-queue');
      if (!taskQueue.taskManager) {
        taskQueue.init(this.taskManager);
      }

      await taskQueue.addTask(task, executor);

      console.log(`[HighlightMixEdit] 任务已提交到队列: ${taskId}`);

      return {
        success: true,
        taskId: taskId,
        message: '任务已提交，排队中...',
        queueLength: taskQueue.getQueueLength()
      };
    } catch (error) {
      console.error('[HighlightMixEdit] 创建任务失败:', error);
      return {
        success: false,
        message: `创建任务失败: ${error.message}`
      };
    }
  }

  /**
   * 自动启动高光混剪处理
   * @param {string} dramaListFilePath - 剧目列表 Excel 文件路径
   * @param {string} imageOverlayFolderPath - 图片叠加文件夹路径
   * @param {string} endFrameFolderPath - 尾帧选择的文件夹路径
   * @param {string} outputPath - 成品存储路径
   * @param {number} endRetentionSeconds - 混剪末尾保留秒数
   * @param {boolean} isScheduledTask - 是否为定时任务
   * @returns {Promise<Object>} 处理结果
   */
  async autoStartProcessing(
    dramaListFilePath,
    imageOverlayFolderPath,
    endFrameFolderPath,
    outputPath,
    endRetentionSeconds = 10,
    isScheduledTask = false
  ) {
    console.log('[HighlightMixEdit] ========== autoStartProcessing 开始执行 ==========');
    console.log('[HighlightMixEdit] 接收到的参数:');
    console.log('[HighlightMixEdit]   (1) 剧目列表 Excel 文件:', dramaListFilePath);
    console.log('[HighlightMixEdit]   (2) 图片叠加文件夹路径:', imageOverlayFolderPath);
    console.log('[HighlightMixEdit]   (3) 尾帧选择的路径:', endFrameFolderPath);
    console.log('[HighlightMixEdit]   (4) 成品存储的路径:', outputPath);
    console.log('[HighlightMixEdit]   (5) 混剪末尾保留秒数:', endRetentionSeconds);
    console.log('[HighlightMixEdit]   是否为定时任务:', isScheduledTask);
    console.log('[HighlightMixEdit] ================================================');

    // 懒加载任务队列
    const taskQueue = require('../utils/task-queue');
    if (!taskQueue.taskManager) {
      taskQueue.init(this.taskManager);
    }

    // 1. 创建 Task 对象
    const taskId = Date.now().toString();
    const now = new Date();
    const timeStr = this.formatDateTime(now);

    const task = {
      id: taskId,
      name: timeStr,
      module: '高光混剪',
      createdAt: timeStr,
      completedAt: '', // 完成时间（初始为空）
      status: '待执行', // 初始状态
      outputPath: outputPath,
      usergrowth: {
        message: '',
        outputPaths: [],
        originalCounts: {}
      },
      params: {
        dramaListFilePath,
        imageOverlayFolderPath,
        endFrameFolderPath,
        outputPath,
        endRetentionSeconds,
        isScheduledTask
      }
    };

    // 2. 定义执行函数（真正的业务逻辑）
    const executor = async (params) => {
      console.log('[HighlightMixEdit] ========== 开始执行任务业务逻辑 ==========');
      
      // 步骤1: 验证参数
      console.log('[HighlightMixEdit] 步骤1: 验证参数...');
      await this.validateParams(params);

      // 步骤2: 获取剧目列表（互斥二选一）
      //   有 Excel → 只用 Excel 剧名（不合并历史任务）
      //   无 Excel → 用最近已完成的高光混剪/爆款复刻任务剧名
      console.log('[HighlightMixEdit] 步骤2: 获取剧目列表...');
      let dramaNames = [];

      if (params.dramaListFilePath && params.dramaListFilePath.trim() !== '') {
        // 2A: 有 Excel，只解析 Excel
        console.log('[HighlightMixEdit] 检测到 Excel 文件，解析剧目列表...');
        const dramaListResult = await this.parseDramaListExcel(params.dramaListFilePath);
        if (dramaListResult.success && dramaListResult.dramaNames.length > 0) {
          dramaNames = dramaListResult.dramaNames;
          console.log('[HighlightMixEdit] Excel 解析出剧目:', dramaNames.length, '个');
        } else {
          throw new Error('Excel 解析失败或剧目列表为空');
        }
      } else {
        // 2B: 无 Excel，读取最近已完成任务的剧名
        console.log('[HighlightMixEdit] 未提供 Excel，从最近任务获取剧目列表...');
        const latestTask = await this.getLatestCompletedTask();
        if (latestTask && latestTask.usergrowth && latestTask.usergrowth.outputPaths) {
          const paths = Array.isArray(latestTask.usergrowth.outputPaths)
            ? latestTask.usergrowth.outputPaths
            : latestTask.usergrowth.outputPaths.split(';').map(p => p.trim()).filter(Boolean);
          dramaNames = paths.map(p => path.basename(p)).filter(name => name);
          console.log('[HighlightMixEdit] 从最近任务提取到剧目:', dramaNames.length, '个');
        }
        if (dramaNames.length === 0) {
          throw new Error('未提供 Excel，且最近任务中没有可用的短剧原片，请上传剧目列表 Excel');
        }
      }

      if (dramaNames.length === 0) {
        throw new Error('无法获取剧目列表，请上传 Excel 或确保已有成功任务');
      }
      console.log('[HighlightMixEdit] 最终剧目列表:', dramaNames);

      // 步骤3: 处理短剧原片（复用已下载 + 下载新剧目）
      console.log('[HighlightMixEdit] 步骤3: 处理短剧原片...');
      const downloadResult = await this.downloadDramasFromUserGrowth(dramaNames, params.outputPath);

      console.log('[HighlightMixEdit] 短剧原片处理完成');
      console.log('[HighlightMixEdit] 成功获取剧目数量:', Object.keys(downloadResult.originalCounts).length);
      console.log('[HighlightMixEdit] 输出路径数量:', downloadResult.outputPaths.length);

      if (downloadResult.outputPaths.length === 0) {
        throw new Error('没有可用的短剧原片，无法继续执行');
      }

      // 步骤4: 按尺寸扫描图片叠加文件夹（竖版/横版子目录）
      console.log('[HighlightMixEdit] 步骤4: 按尺寸扫描图片叠加文件夹...');
      const overlayImagesByType = await this.scanFolderBySizeType(params.imageOverlayFolderPath, 'image');
      const hasVerticalOverlay = overlayImagesByType['竖版'].length > 0;
      const hasHorizontalOverlay = overlayImagesByType['横版'].length > 0;
      console.log('[HighlightMixEdit] 竖版图片:', overlayImagesByType['竖版'].length, '横版图片:', overlayImagesByType['横版'].length);

      // 步骤5: 按尺寸扫描尾帧文件夹（竖版/横版子目录）
      console.log('[HighlightMixEdit] 步骤5: 按尺寸扫描尾帧文件夹...');
      const endFrameVideosByType = await this.scanFolderBySizeType(params.endFrameFolderPath, 'video');
      const hasVerticalEndFrame = endFrameVideosByType['竖版'].length > 0;
      const hasHorizontalEndFrame = endFrameVideosByType['横版'].length > 0;
      console.log('[HighlightMixEdit] 竖版尾帧:', endFrameVideosByType['竖版'].length, '横版尾帧:', endFrameVideosByType['横版'].length);

      // 步骤6: 执行混剪处理
      console.log('[HighlightMixEdit] 步骤6: 执行混剪处理...');
      const mixResult = await this.processMixing(
        downloadResult.outputPaths,
        overlayImagesByType,
        endFrameVideosByType,
        params.outputPath,
        params.endRetentionSeconds
      );
      
      console.log('[HighlightMixEdit] ========== 任务执行完成 ==========');
      console.log('[HighlightMixEdit] 总计产出物数量:', mixResult.totalOutputCount);
      
      // 返回结果（包含 usergrowth 字段和 mixResult）
      return {
        success: true,
        message: `高光混剪任务执行完成，共生成 ${mixResult.totalOutputCount} 个混剪视频`,
        usergrowth: {
          message: '短剧原片处理完成',
          outputPaths: downloadResult.outputPaths,
          originalCounts: downloadResult.originalCounts
        },
        mixResult: {
          outputPath: mixResult.outputPath,
          totalOutputCount: mixResult.totalOutputCount
        }
      };
    };

    // 3. 加入队列并返回 taskId
    try {
      await taskQueue.addTask(task, executor);

      console.log(`[HighlightMixEdit] 任务已提交到队列: ${taskId}`);

      return {
        success: true,
        taskId: taskId,
        message: '任务已提交，排队中...',
        queueLength: taskQueue.getQueueLength()
      };
    } catch (error) {
      console.error('[HighlightMixEdit] 提交任务失败:', error);
      return {
        success: false,
        message: `提交任务失败: ${error.message}`
      };
    }
  }

  /**
   * 验证参数（仅验证非空参数）
   * @param {Object} params - 参数对象
   */
  async validateParams(params) {
    console.log('[HighlightMixEdit] 开始验证参数...');

    const { endFrameFolderPath, outputPath } = params;

    if (!endFrameFolderPath) {
      throw new Error('尾帧文件夹路径不能为空');
    }

    if (!outputPath) {
      throw new Error('成品存储路径不能为空');
    }

    console.log('[HighlightMixEdit] 参数验证通过');
  }

  /**
   * 获取最近已完成的高光混剪/爆款复刻任务（状态为"已完成"且有 outputPaths）
   * @returns {Promise<Object|null>}
   */
  async getLatestCompletedTask() {
    const TaskDataManager = require('../utils/taskDataManager');
    const taskDataManager = new TaskDataManager('smart-short-drama-data.json');
    const allTasks = await taskDataManager.getTasks();

    // 筛选已完成任务
    const completedTasks = allTasks
      .filter(task =>
        (task.module === '高光混剪' || task.module === '爆款复刻') &&
        task.status === '已完成' &&
        task.usergrowth &&
        task.usergrowth.outputPaths
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return completedTasks[0] || null;
  }

  /**
   * 解析剧目列表 Excel 文件
   * @param {string} dramaListFilePath - Excel 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseDramaListExcel(dramaListFilePath) {
    console.log('[HighlightMixEdit] 开始解析剧目列表 Excel...');
    console.log('[HighlightMixEdit] 文件路径:', dramaListFilePath);
    
    try {
      // 调用剧目列表解析器
      const result = await dramaListParser.parseDramaList(dramaListFilePath);
      
      if (result.success) {
        console.log('[HighlightMixEdit] 剧目列表解析成功');
        console.log('[HighlightMixEdit] 剧目数量:', result.dramaNames.length);
      } else {
        console.error('[HighlightMixEdit] 剧目列表解析失败:', result.message);
      }
      
      return result;
    } catch (error) {
      console.error('[HighlightMixEdit] 解析剧目列表时发生异常:', error);
      return {
        success: false,
        message: error.message,
        dramaNames: []
      };
    }
  }

  /**
   * 检查剧目是否已在高光混剪任务中下载过
   * @param {Array<string>} dramaNames - 剧名数组
   * @returns {Promise<Object>} 检查结果 { existingDramas: Map, newDramas: Array }
   */
  async checkExistingDramas(dramaNames) {
    console.log('[HighlightMixEdit] 开始检查已下载的剧目...');
    
    const TaskDataManager = require('../utils/taskDataManager');
    const taskDataManager = new TaskDataManager('smart-short-drama-data.json');
    
    // 读取所有任务
    const allTasks = await taskDataManager.getTasks();
    
    // 筛选出所有高光混剪或爆款复刻任务
    const highlightTasks = allTasks.filter(task => task.module === '高光混剪' || task.module === '爆款复刻');
    console.log('[HighlightMixEdit] 找到高光混剪/爆款复刻任务数量:', highlightTasks.length);
    
    // 创建已下载剧目的映射: { 剧名: { path: 路径, count: 集数 } }
    const existingDramas = new Map();
    
    for (const task of highlightTasks) {
      if (task.usergrowth && task.usergrowth.outputPaths) {
        const outputPaths = this.normalizeOutputPaths(task.usergrowth.outputPaths);
        
        const originalCounts = task.usergrowth.originalCounts || {};
        
        for (const dramaPath of outputPaths) {
          if (!dramaPath) continue;
          
          // 从路径中提取剧名（路径最后一部分）
          const dramaName = path.basename(dramaPath);
          
          // 检查是否在待下载列表中
          if (dramaNames.includes(dramaName)) {
            const availableInfo = await this.checkDramaPathAvailable(dramaPath);
            if (!availableInfo.available) {
              console.warn('[HighlightMixEdit] 历史剧目路径不可用，将重新下载:', dramaName, dramaPath, availableInfo.reason);
              continue;
            }

            existingDramas.set(dramaName, {
              path: dramaPath,
              count: originalCounts[dramaName] || availableInfo.videoCount
            });
            console.log('[HighlightMixEdit] 发现已下载剧目:', dramaName, '路径:', dramaPath, '视频数:', availableInfo.videoCount);
          }
        }
      }
    }
    
    // 区分新旧剧目
    const newDramas = dramaNames.filter(name => !existingDramas.has(name));
    
    console.log('[HighlightMixEdit] 已下载剧目数量:', existingDramas.size);
    console.log('[HighlightMixEdit] 需要新下载剧目数量:', newDramas.length);
    console.log('[HighlightMixEdit] 需要新下载的剧目:', newDramas);
    
    return { existingDramas, newDramas };
  }

  /**
   * 兼容数组和分号分隔字符串两种 outputPaths 格式
   * @param {Array<string>|string} outputPaths - 历史任务输出路径
   * @returns {Array<string>} 标准化后的路径数组
   */
  normalizeOutputPaths(outputPaths) {
    if (Array.isArray(outputPaths)) {
      return outputPaths.map(p => String(p || '').trim()).filter(Boolean);
    }

    if (typeof outputPaths === 'string') {
      return outputPaths
        .split(';')
        .map(p => p.trim())
        .filter(Boolean);
    }

    return [];
  }

  /**
   * 检查历史任务里的剧目路径是否仍然可复用
   * @param {string} dramaPath - 剧目目录路径
   * @returns {Promise<{available: boolean, videoCount: number, reason: string}>}
   */
  async checkDramaPathAvailable(dramaPath) {
    try {
      const stat = await fs.stat(dramaPath);
      if (!stat.isDirectory()) {
        return { available: false, videoCount: 0, reason: '路径不是目录' };
      }

      const files = await fs.readdir(dramaPath);
      const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
      const videoCount = files.filter(file => videoExtensions.includes(path.extname(file).toLowerCase())).length;

      if (videoCount === 0) {
        return { available: false, videoCount: 0, reason: '目录中没有视频文件' };
      }

      return { available: true, videoCount, reason: '' };
    } catch (error) {
      return { available: false, videoCount: 0, reason: error.message };
    }
  }

  /**
   * 下载短剧原片（复用已下载 + 下载新剧目）
   * @param {Array<string>} dramaNames - 剧名数组
   * @param {string} baseOutputPath - 基础输出路径
   * @returns {Promise<Object>} 下载结果
   */
  async downloadDramasFromUserGrowth(dramaNames, baseOutputPath) {
    console.log('[HighlightMixEdit] 开始处理短剧原片...');
    console.log('[HighlightMixEdit] 剧目数量:', dramaNames.length);
    console.log('[HighlightMixEdit] 基础输出路径:', baseOutputPath);
    
    try {
      // 步骤1: 检查已下载的剧目
      const { existingDramas, newDramas } = await this.checkExistingDramas(dramaNames);
      
      // 初始化结果
      const outputPaths = [];
      const originalCounts = {};
      
      // 步骤2: 复用已下载的剧目
      for (const [dramaName, info] of existingDramas.entries()) {
        outputPaths.push(info.path);
        originalCounts[dramaName] = info.count;
        console.log('[HighlightMixEdit] 复用已下载剧目:', dramaName, '路径:', info.path);
      }
      
      // 步骤3: 下载新剧目（如果有）
      if (newDramas.length > 0) {
        console.log('[HighlightMixEdit] 开始下载新剧目...');
        
        // 生成带日期的输出路径: baseOutputPath\短剧原片\2026-02-03
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const newDownloadPath = path.join(baseOutputPath, '短剧原片', dateStr);
        
        console.log('[HighlightMixEdit] 新剧目下载路径:', newDownloadPath);
        
        // 创建输出目录
        await fs.mkdir(newDownloadPath, { recursive: true });
        console.log('[HighlightMixEdit] 输出目录创建成功');
        
        // 初始化 UserGrowth 节点（复用 browserManager）
        const userGrowthNode = new UserGrowthShortFilmNode(this.browserManager);
        
        // 调用墨攻平台批量下载方法
        const result = await userGrowthNode.processUserGrowthDramas(newDramas, newDownloadPath);
        
        console.log('[HighlightMixEdit] 新剧目下载完成');
        console.log('[HighlightMixEdit] 成功:', result.succDramas.length, '个');
        console.log('[HighlightMixEdit] 失败:', result.failedDramas.length, '个');
        
        // 合并新下载的结果
        for (const dramaName of result.succDramas) {
          const dramaPath = path.join(newDownloadPath, dramaName);
          outputPaths.push(dramaPath);
          originalCounts[dramaName] = result.originalCounts[dramaName] || 0;
        }
      }
      
      console.log('[HighlightMixEdit] 所有剧目处理完成');
      console.log('[HighlightMixEdit] 总计剧目数量:', Object.keys(originalCounts).length);
      console.log('[HighlightMixEdit] 所有输出路径:', outputPaths);
      
      return {
        outputPaths: outputPaths,
        originalCounts: originalCounts
      };
    } catch (error) {
      console.error('[HighlightMixEdit] 处理短剧原片时发生异常:', error);
      throw new Error(`处理短剧原片失败: ${error.message}`);
    }
  }

  /**
   * 扫描文件夹的子目录，按尺寸类型分组返回素材
   * @param {string} baseFolderPath - 基础文件夹路径
   * @param {'image'|'video'} type - 素材类型
   * @returns {Promise<Object>} { 竖版: string[], 横版: string[] }
   */
  async scanFolderBySizeType(baseFolderPath, type) {
    const result = { 竖版: [], 横版: [] };
    const sizeTypeNames = ['竖版', '横版'];

    if (!baseFolderPath || baseFolderPath.trim() === '') {
      console.log('[HighlightMixEdit] 未提供基础文件夹，跳过扫描');
      return result;
    }

    for (const sizeType of sizeTypeNames) {
      const subFolderPath = path.join(baseFolderPath, sizeType);
      try {
        const files = await fs.readdir(subFolderPath);
        if (files.length === 0) {
          console.log(`[HighlightMixEdit] ${sizeType} 文件夹为空`);
          continue;
        }

        if (type === 'image') {
          const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp'];
          const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
          });
          result[sizeType] = imageFiles.map(f => path.join(subFolderPath, f));
          console.log(`[HighlightMixEdit] ${sizeType} 图片: ${imageFiles.length} 个`);
        } else {
          const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
          const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return videoExtensions.includes(ext);
          });
          result[sizeType] = videoFiles.map(f => path.join(subFolderPath, f));
          console.log(`[HighlightMixEdit] ${sizeType} 尾帧视频: ${videoFiles.length} 个`);
        }
      } catch (error) {
        console.log(`[HighlightMixEdit] ${sizeType} 文件夹不存在，跳过`);
      }
    }

    return result;
  }

  /**
   * 执行混剪处理
   * @param {Array<string>} dramaOutputPaths - 短剧目录路径数组
   * @param {Object} overlayImagesByType - 按尺寸分组的图片 { 竖版: [], 横版: [] }
   * @param {Object} endFrameVideosByType - 按尺寸分组的尾帧 { 竖版: [], 横版: [] }
   * @param {string} baseOutputPath - 基础输出路径
   * @param {number} endRetentionSeconds - 混剪末尾保留秒数
   * @returns {Promise<Object>} 混剪结果
   */
  async processMixing(dramaOutputPaths, overlayImagesByType, endFrameVideosByType, baseOutputPath, endRetentionSeconds) {
    console.log('[HighlightMixEdit] 开始混剪处理...');
    console.log('[HighlightMixEdit] 短剧数量:', dramaOutputPaths.length);
    console.log('[HighlightMixEdit] 竖版图片:', overlayImagesByType['竖版'].length, '横版图片:', overlayImagesByType['横版'].length);
    console.log('[HighlightMixEdit] 竖版尾帧:', endFrameVideosByType['竖版'].length, '横版尾帧:', endFrameVideosByType['横版'].length);
    console.log('[HighlightMixEdit] 保留秒数:', endRetentionSeconds);

    const { initializeFfmpeg } = require('../utils/ffmpeg-locator');
    const { VideoMixer } = require('../utils/video-mixer');

    const { ffmpegPath, ffprobePath } = await initializeFfmpeg();
    const videoMixer = new VideoMixer(ffmpegPath, ffprobePath, true, {
      // 高光混剪按成品总码率不超过 3000k 控制，给音频、封装和短片 GOP 波动留出余量。
      videoBitrateK: 2400,
      videoMaxrateK: 2400,
      videoBufsizeK: 2400,
      audioBitrateK: 96
    });

    console.log('[HighlightMixEdit] FFmpeg 路径:', ffmpegPath);
    console.log('[HighlightMixEdit] FFprobe 路径:', ffprobePath);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const gpuStatus = videoMixer.getGPUStatus();
    console.log('[HighlightMixEdit] GPU 状态:', gpuStatus.message);
    if (gpuStatus.detected) {
      console.log('[HighlightMixEdit] GPU 编码器:', gpuStatus.encoder);
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const mixedOutputBasePath = path.join(baseOutputPath, '高光混剪', dateStr);

    console.log('[HighlightMixEdit] 混剪输出基础路径:', mixedOutputBasePath);

    await fs.mkdir(mixedOutputBasePath, { recursive: true });

    const tempDir = path.join(mixedOutputBasePath, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    let totalOutputCount = 0;

    for (const dramaPath of dramaOutputPaths) {
      const dramaName = path.basename(dramaPath);
      console.log('[HighlightMixEdit] ========================================');
      console.log('[HighlightMixEdit] 处理短剧:', dramaName);
      console.log('[HighlightMixEdit] 短剧路径:', dramaPath);

      try {
        const episodeVideos = await this.scanDramaVideos(dramaPath);

        if (episodeVideos.length < 3) {
          console.warn(`[HighlightMixEdit] 短剧 ${dramaName} 集数不足 3 集，跳过`);
          continue;
        }

        console.log('[HighlightMixEdit] 短剧总集数:', episodeVideos.length);

        // 检测整部剧的尺寸类型（以第1集为准）
        const aspectType = await this.detectVideoAspectType(videoMixer, episodeVideos[0].filePath);
        const { targetWidth, targetHeight } = aspectType === '竖版'
          ? { targetWidth: 720, targetHeight: 1280 }
          : { targetWidth: 1280, targetHeight: 720 };
        console.log(`[HighlightMixEdit] 尺寸类型: ${aspectType}, 输出分辨率: ${targetWidth}x${targetHeight}`);

        const dramaOutputPath = path.join(mixedOutputBasePath, dramaName);
        await fs.mkdir(dramaOutputPath, { recursive: true });

        const outputCount = episodeVideos.length - 2;
        console.log('[HighlightMixEdit] 预计产出物数量:', outputCount);

        // 按尺寸取对应素材（找不到则为空数组）
        const overlayImages = overlayImagesByType[aspectType];
        const endFrameVideos = endFrameVideosByType[aspectType];
        const hasOverlayImage = overlayImages.length > 0;
        const hasEndFrame = endFrameVideos.length > 0;

        if (hasOverlayImage) {
          console.log(`[HighlightMixEdit] 使用 ${aspectType} 图片叠加，当前可用: ${overlayImages.length} 张`);
        } else {
          console.log(`[HighlightMixEdit] ${aspectType} 图片文件夹为空或不存在，跳过图片叠加`);
        }
        if (hasEndFrame) {
          console.log(`[HighlightMixEdit] 使用 ${aspectType} 尾帧，当前可用: ${endFrameVideos.length} 个`);
        } else {
          console.log(`[HighlightMixEdit] ${aspectType} 尾帧文件夹为空或不存在，跳过尾帧拼接`);
        }

        for (let i = 0; i < outputCount; i++) {
          const episode1 = episodeVideos[i];
          const episode2 = episodeVideos[i + 1];
          const episode3 = episodeVideos[i + 2];

          const episodeNum1 = this.extractEpisodeNumber(episode1.fileName);
          const episodeNum2 = this.extractEpisodeNumber(episode2.fileName);
          const episodeNum3 = this.extractEpisodeNumber(episode3.fileName);

          const outputFileName = `第${episodeNum1}-${episodeNum3}集${endRetentionSeconds}s混剪.mp4`;
          const outputFilePath = path.join(dramaOutputPath, outputFileName);

          console.log(`[HighlightMixEdit] -------------------- 混剪 ${i + 1}/${outputCount} --------------------`);
          console.log(`[HighlightMixEdit] 第1集: ${episode1.fileName} (截取末尾 ${endRetentionSeconds}s)`);
          console.log(`[HighlightMixEdit] 第2集: ${episode2.fileName} (完整)`);
          console.log(`[HighlightMixEdit] 第3集: ${episode3.fileName} (完整)`);
          console.log(`[HighlightMixEdit] 输出: ${outputFileName}`);
          console.log(`[HighlightMixEdit] 尺寸类型: ${aspectType} (${targetWidth}x${targetHeight})`);

          try {
            await this.mixThreeEpisodes(
              videoMixer,
              episode1.filePath,
              episode2.filePath,
              episode3.filePath,
              overlayImages,
              endFrameVideos,
              outputFilePath,
              endRetentionSeconds,
              tempDir,
              targetWidth,
              targetHeight
            );

            totalOutputCount++;
            console.log(`[HighlightMixEdit] ✓ 混剪成功: ${outputFileName}`);
          } catch (error) {
            console.error(`[HighlightMixEdit] ✗ 混剪失败: ${outputFileName}`, error.message);
          }
        }

        console.log('[HighlightMixEdit] 短剧处理完成:', dramaName);
      } catch (error) {
        console.error(`[HighlightMixEdit] 处理短剧失败: ${dramaName}`, error.message);
      }
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('[HighlightMixEdit] 临时目录清理完成');
    } catch (error) {
      console.warn('[HighlightMixEdit] 清理临时目录失败:', error.message);
    }

    console.log('[HighlightMixEdit] 混剪处理全部完成');
    console.log('[HighlightMixEdit] 总计产出物数量:', totalOutputCount);

    return {
      totalOutputCount: totalOutputCount,
      outputPath: mixedOutputBasePath
    };
  }

  /**
   * 扫描短剧目录中的所有视频文件，并按集数排序
   * @param {string} dramaPath - 短剧目录路径
   * @returns {Promise<Array<Object>>} 视频文件数组 [{ filePath, fileName, episodeNum }]
   */
  async scanDramaVideos(dramaPath) {
    const files = await fs.readdir(dramaPath);
    
    // 筛选视频文件
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });
    
    // 构建视频对象数组
    const videos = videoFiles.map(fileName => {
      const episodeNum = this.extractEpisodeNumber(fileName);
      return {
        filePath: path.join(dramaPath, fileName),
        fileName: fileName,
        episodeNum: episodeNum
      };
    });
    
    // 按集数排序
    videos.sort((a, b) => a.episodeNum - b.episodeNum);
    
    console.log(`[HighlightMixEdit] 扫描到 ${videos.length} 个视频文件，已按集数排序`);
    
    return videos;
  }

  /**
   * 从文件名中提取集数
   * @param {string} fileName - 文件名
   * @returns {number} 集数
   */
  extractEpisodeNumber(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));

    // 优先匹配下载命名：短剧名_集数.mp4，避免剧名中的数字被误认为集数。
    const suffixMatch = baseName.match(/[_-](\d+)$/);
    if (suffixMatch) {
      return parseInt(suffixMatch[1], 10);
    }

    // 兼容常见集数命名：第1集、第01集。
    const chineseEpisodeMatch = baseName.match(/第\s*(\d+)\s*集/);
    if (chineseEpisodeMatch) {
      return parseInt(chineseEpisodeMatch[1], 10);
    }

    // 兼容英文命名：Episode_05、EP05。
    const englishEpisodeMatch = baseName.match(/\b(?:episode|ep)[\s_-]*(\d+)\b/i);
    if (englishEpisodeMatch) {
      return parseInt(englishEpisodeMatch[1], 10);
    }

    // 兜底：取最后一个数字，比取第一个数字更不容易被剧名年份干扰。
    const allNumbers = baseName.match(/\d+/g);
    return allNumbers ? parseInt(allNumbers[allNumbers.length - 1], 10) : 0;
  }

  /**
   * 检测视频的尺寸类型（竖版/横版）
   * @param {VideoMixer} videoMixer - 视频混剪工具
   * @param {string} videoPath - 视频路径
   * @returns {Promise<string>} '竖版' 或 '横版'
   */
  async detectVideoAspectType(videoMixer, videoPath) {
    const info = await videoMixer.getVideoInfo(videoPath);
    const { width, height } = info;
    console.log(`[HighlightMixEdit] 视频尺寸: ${width}x${height}`);
    return width > height ? '横版' : '竖版';
  }

  /**
   * 混剪三集视频（含图片叠加 + 尾帧拼接，按尺寸统一输出分辨率）
   * @param {VideoMixer} videoMixer - 视频混剪工具
   * @param {string} episode1Path - 第1集路径
   * @param {string} episode2Path - 第2集路径
   * @param {string} episode3Path - 第3集路径
   * @param {Array<string>} overlayImages - 叠加图片数组（按尺寸类型，可能为空）
   * @param {Array<string>} endFrameVideos - 尾帧视频数组（按尺寸类型，可能为空）
   * @param {string} outputPath - 输出路径
   * @param {number} endRetentionSeconds - 第1集保留秒数
   * @param {string} tempDir - 临时目录
   * @param {number} targetWidth - 目标宽度（720 或 1280）
   * @param {number} targetHeight - 目标高度（1280 或 720）
   * @returns {Promise<void>}
   */
  async mixThreeEpisodes(
    videoMixer,
    episode1Path,
    episode2Path,
    episode3Path,
    overlayImages,
    endFrameVideos,
    outputPath,
    endRetentionSeconds,
    tempDir,
    targetWidth,
    targetHeight
  ) {
    const duration1 = await videoMixer.getVideoDuration(episode1Path);
    console.log(`[HighlightMixEdit] 第1集时长: ${duration1}s`);

    const referenceInfo = await videoMixer.getVideoInfo(episode2Path);
    const targetFps = referenceInfo.frameRate || 30;
    console.log(`[HighlightMixEdit] 目标帧率: ${targetFps}fps`);

    const startTime1 = Math.max(0, duration1 - endRetentionSeconds);
    const actualDuration1 = duration1 - startTime1;

    console.log(`[HighlightMixEdit] 第1集截取: 起始 ${startTime1}s, 时长 ${actualDuration1}s`);

    // 1. 裁剪第1集的末尾部分
    const tempEpisode1Path = path.join(tempDir, `episode1_trimmed_${Date.now()}.mp4`);
    await videoMixer.trimVideo(episode1Path, tempEpisode1Path, startTime1, actualDuration1);

    // 2. 拼接三集视频：第1集末尾 + 第2集完整 + 第3集完整（统一目标分辨率）
    const tempConcatPath = path.join(tempDir, `concat_${Date.now()}.mp4`);
    console.log('[HighlightMixEdit] 开始拼接 3 集视频...');
    await videoMixer.concatVideos(
      [tempEpisode1Path, episode2Path, episode3Path],
      tempConcatPath,
      tempDir,
      targetWidth,
      targetHeight,
      targetFps
    );

    let currentVideoPath = tempConcatPath;

    // 3. 图片叠加（仅当有对应尺寸图片时执行）
    if (overlayImages.length > 0) {
      const randomImage = overlayImages[Math.floor(Math.random() * overlayImages.length)];
      console.log(`[HighlightMixEdit] 选择图片: ${path.basename(randomImage)}`);

      const tempOverlayPath = path.join(tempDir, `overlay_${Date.now()}.mp4`);
      console.log('[HighlightMixEdit] 开始图片叠加...');
      await videoMixer.overlayImageToVideo(
        currentVideoPath,
        randomImage,
        tempOverlayPath,
        0.7,
        targetWidth,
        targetHeight
      );
      currentVideoPath = tempOverlayPath;
    } else {
      console.log('[HighlightMixEdit] 跳过图片叠加（无素材）');
    }

    // 4. 尾帧拼接（仅当有对应尺寸尾帧时执行）
    if (endFrameVideos.length > 0) {
      const randomEndFrame = endFrameVideos[Math.floor(Math.random() * endFrameVideos.length)];
      console.log(`[HighlightMixEdit] 选择尾帧: ${path.basename(randomEndFrame)}`);

      console.log('[HighlightMixEdit] 开始拼接尾帧...');
      await videoMixer.concatVideos(
        [currentVideoPath, randomEndFrame],
        outputPath,
        tempDir,
        targetWidth,
        targetHeight,
        targetFps
      );
    } else {
      console.log('[HighlightMixEdit] 跳过尾帧拼接（无素材）');
      // 如果跳过了尾帧拼接，需要将当前视频复制到输出路径
      if (currentVideoPath !== outputPath) {
        await fs.copyFile(currentVideoPath, outputPath);
      }
    }

    // 5. 清理临时文件
    const tempFiles = [tempEpisode1Path, tempConcatPath];
    if (currentVideoPath !== tempConcatPath && currentVideoPath !== outputPath) {
      tempFiles.push(currentVideoPath);
    }
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`[HighlightMixEdit] 清理临时文件失败: ${file}`, error.message);
      }
    }
  }

  /**
   * 获取任务列表
   * @returns {Promise<Object>} 任务列表
   */
  async getTasks() {
    console.log('[HighlightMixEdit] getTasks 被调用');

    try {
      const tasks = this.taskManager.getTasks();
      return { success: true, tasks };
    } catch (error) {
      console.error('[HighlightMixEdit] 获取任务列表失败:', error);
      return { success: true, tasks: [] };
    }
  }
}

exports.HighlightMixEditNode = HighlightMixEditNode;
