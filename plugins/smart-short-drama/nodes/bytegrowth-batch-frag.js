/**
 * 墨攻平台批量片段处理（爆款复刻）
 * 负责从墨攻平台获取热门剧目的片段并进行复刻处理
 */

// 统一日志初始化
require('./logger-init');

const TaskDataManager = require('../utils/taskDataManager');
const { BrowserManager } = require('../utils/browser-manager');
const FileCookieStore = require('../utils/file-cookie-store');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');
const { UserGrowthShortFilmNode } = require('./usergrowth-short-film');

class UserGrowthBatchFragmentsNode {
  constructor() {
    // 使用独立的 JSON 文件管理复刻任务
    this.taskManager = new TaskDataManager('smart-short-drama-data.json');
    this.cookieFileName = 'usergrowth_cookie.json';
    this.browserManager = new BrowserManager();
    this.cookieManager = GlobalCookieManager.getInstance();
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.browser = null;
    this.context = null;
    this.page = null;

    // 墨攻平台 URL 配置
    this.baseUrl = 'https://usergrowth.com.cn';
    this.targetUrl = 'https://usergrowth.com.cn/aigc/manage/creative?selectorId=9171e1f89a164a9d9280268360fcd5f5&q=';

    console.log('[UserGrowthBatchFragments] 节点已初始化');
  }

  /**
   * 批量处理复刻片段（自动执行含去重）
   * @param {string} outputPath - 保存的文件路径
   * @param {number} processCount - 需要处理的数量（默认5）
   * @param {object} exportConfig - 导出配置（可选）
   * @param {number} dedupeExpireDays - 去重天数（默认30天）
   * @param {boolean} isScheduledTask - 是否为定时任务
   * @returns {Promise<Object>} 处理结果
   */
  async autoStartProcessing(outputPath, processCount = 5, exportConfig = {}, dedupeExpireDays = 30, isScheduledTask = false) {
    console.log('[UserGrowthBatchFragments] autoStartProcessing 开始执行');
    console.log('[UserGrowthBatchFragments] 接收到的参数:', {
      outputPath,
      processCount,
      exportConfig,
      dedupeExpireDays,
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

    // 计算去重输出路径作为任务的 outputPath
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dedupOutputPath = require('path').join(outputPath, '复刻片段', dateStr);

    const task = {
      id: taskId,
      name: timeStr,
      module: '爆款复刻',
      createdAt: timeStr,
      completedAt: '',
      status: '待执行',
      outputPath: dedupOutputPath,
      bytegrowth: {
        message: '',
        outputPaths: '',
        succDramas: [],
        failedDramas: [],
        fragmentCounts: {}
      },
      usergrowth: {
        message: '',
        outputPaths: '',
        succDramas: [],
        failedDramas: [],
        originalCounts: {}
      },
      params: {
        outputPath,
        processCount,
        exportConfig,
        dedupeExpireDays,
        isScheduledTask
      }
    };

    // 2. 定义执行函数（真正的业务逻辑）
    const executor = async (params) => {
      const path = require('path');
      console.log('[UserGrowthBatchFragments] 开始执行任务业务逻辑');

      // 计算路径：basePath/复刻片段/日期/ 和 basePath/爆款复刻/日期/
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const replicationBasePath_part = path.join(params.outputPath, '跑量片段', dateStr);
      const replicationBasePath_all = path.join(params.outputPath, '短剧原片', dateStr);
      const dedupOutputPath = path.join(params.outputPath, '复刻片段', dateStr);

      console.log('[UserGrowthBatchFragments] 跑量片段基础路径:', replicationBasePath_part);
      console.log('[UserGrowthBatchFragments] 短剧原片基础路径:', replicationBasePath_all);
      console.log('[UserGrowthBatchFragments] 去重结果输出路径:', dedupOutputPath);

      // 步骤1: 获取热门剧目并去重
      const selectedDramas = await this.getSelectedDramas(params.dedupeExpireDays, params.processCount);
      if (!selectedDramas || selectedDramas.length === 0) {
        // 判断任务类型：定时任务 vs 即时任务
        if (params.isScheduledTask) {
          console.log('[UserGrowthBatchFragments] 定时任务暂无可用剧目，将在 1 小时后自动重试');

          // 创建延后 1 小时的重试任务（一次性 cron）
          this.scheduleRetryTask(params);

          // 返回特殊结果，表示任务完成但无可用剧目
          return {
            bytegrowth: {
              message: '暂无可用剧目（所有热门剧最近都已下载），已安排 1 小时后重试',
              outputPaths: '',
              succDramas: [],
              failedDramas: [],
              fragmentCounts: {}
            },
            usergrowth: {
              message: '',
              outputPaths: '',
              succDramas: [],
              failedDramas: [],
              originalCounts: {}
            }
          };
        } else {
          // 即时任务直接抛出错误
          console.log('[UserGrowthBatchFragments] 即时任务无可用剧目，任务结束');
          throw new Error('没有可处理的新剧目（所有热门剧最近都已下载）');
        }
      }

      console.log('[UserGrowthBatchFragments] 选中剧目:', selectedDramas);

      // 步骤2: 批量处理 ByteGrowth 平台剧目（片段）
      let byteGrowthData = null;
      let byteGrowthMessage = '';

      try {
        byteGrowthData = await this.processUserGrowthFragmentDramas(selectedDramas, replicationBasePath_part);
        console.log('[UserGrowthBatchFragments] ByteGrowth 处理完成:', byteGrowthData);
      } catch (error) {
        console.error('[UserGrowthBatchFragments] ByteGrowth 处理异常:', error);
        byteGrowthMessage = `处理异常: ${error.message}`;
        byteGrowthData = {
          results: {},
          succDramas: [],
          failedDramas: selectedDramas
        };
      }

      // 步骤3: 批量处理墨攻平台剧目（全量原片）
      let userGrowthData = null;
      let userGrowthMessage = '';

      if (byteGrowthData.succDramas.length === 0) {
        console.log('[UserGrowthBatchFragments] ByteGrowth 没有成功的短剧，跳过墨攻平台处理');
        userGrowthData = {
          results: {},
          succDramas: [],
          failedDramas: []
        };
      } else {
        try {
          userGrowthData = await this.processUserGrowthDramas(byteGrowthData.succDramas, replicationBasePath_all);
          console.log('[UserGrowthBatchFragments] 墨攻平台处理完成:', userGrowthData);
        } catch (error) {
          console.error('[UserGrowthBatchFragments] 墨攻平台处理异常:', error);
          userGrowthMessage = `处理异常: ${error.message}`;
          userGrowthData = {
            results: {},
            succDramas: [],
            failedDramas: byteGrowthData.succDramas
          };
        }
      }

      // 步骤4: 视频去重流程（调用本地服务）
      const VideoDedupService = require('./video-dedup-service');
      const dedupService = new VideoDedupService();
      const dedupResults = {}; // 记录每个剧目的去重输出路径

      // 对每个成功的剧目执行去重
      for (const dramaName of byteGrowthData.succDramas) {
        if (userGrowthData.succDramas.includes(dramaName)) {
          const userGrowthPath = userGrowthData.results[dramaName]; // 全量原片路径
          const byteGrowthPath = byteGrowthData.results[dramaName]; // 片段路径

          console.log(`[UserGrowthBatchFragments] 开始去重: ${dramaName}`);
          console.log(`[UserGrowthBatchFragments]   全量原片: ${userGrowthPath}`);
          console.log(`[UserGrowthBatchFragments]   片段视频: ${byteGrowthPath}`);

          try {
            const dramaDedupOutputPath = path.join(dedupOutputPath, dramaName);
            const dedupResult = await dedupService.processDeduplication(userGrowthPath, byteGrowthPath, dramaName, dramaDedupOutputPath);

            if (dedupResult.success) {
              console.log(`[UserGrowthBatchFragments] 去重完成: ${dramaName} -> ${dramaDedupOutputPath}`);
              dedupResults[dramaName] = dramaDedupOutputPath;
            } else {
              console.error(`[UserGrowthBatchFragments] 去重失败: ${dramaName}, 错误: ${dedupResult.error}`);
            }
          } catch (error) {
            console.error(`[UserGrowthBatchFragments] 去重异常: ${dramaName}, 错误: ${error.message}`);
          }
        }
      }

      // 步骤5: 组装结果并返回
      // bytegrowth.outputPaths = 复刻片段的实际输出路径（去重后）
      // bytegrowth.succDramas = 跑量片段下载成功的剧目（保持原意）
      return {
        bytegrowth: {
          message: byteGrowthMessage,
          outputPaths: Object.values(dedupResults).join(';'), // 复刻片段的实际输出路径
          succDramas: byteGrowthData.succDramas, // 跑量片段下载成功的剧目
          failedDramas: byteGrowthData.failedDramas,
          fragmentCounts: byteGrowthData.fragmentCounts || {}
        },
        usergrowth: {
          message: userGrowthMessage,
          outputPaths: Object.values(userGrowthData.results).join(';'),
          succDramas: userGrowthData.succDramas,
          failedDramas: userGrowthData.failedDramas,
          originalCounts: userGrowthData.originalCounts || {}
        }
      };
    };

    // 3. 加入队列并返回 taskId
    try {
      await taskQueue.addTask(task, executor);

      console.log(`[UserGrowthBatchFragments] 任务已提交到队列: ${taskId}`);

      return {
        success: true,
        taskId: taskId,
        message: '任务已提交，排队中...',
        queueLength: taskQueue.getQueueLength()
      };
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 提交任务失败:', error);
      return {
        success: false,
        message: `提交任务失败: ${error.message}`
      };
    }
  }

  /**
   * 创建延后的重试任务（一次性 cron）
   * @param {Object} params - 原任务参数
   */
  scheduleRetryTask(params) {
    try {
      console.log('[UserGrowthBatchFragments] 创建延后 1 小时的重试任务...');

      // 计算 1 小时后的时间
      const retryTime = new Date(Date.now() + 60 * 60 * 1000); // 1小时后
      const hours = String(retryTime.getHours()).padStart(2, '0');
      const minutes = String(retryTime.getMinutes()).padStart(2, '0');

      // 构造 cron 表达式：在指定的小时和分钟执行一次
      const cronExpression = `${minutes} ${hours} * * *`;

      console.log('[UserGrowthBatchFragments] 重试时间:', retryTime.toLocaleString());
      console.log('[UserGrowthBatchFragments] Cron 表达式:', cronExpression);

      // 使用 setTimeout 实现延后执行（1小时 = 3600000 毫秒）
      setTimeout(() => {
        console.log('[UserGrowthBatchFragments] ========== 执行重试任务 ==========');
        console.log('[UserGrowthBatchFragments] 原定时间:', retryTime.toLocaleString());
        console.log('[UserGrowthBatchFragments] 实际时间:', new Date().toLocaleString());

        // 重新调用 autoStartProcessing，保持所有参数不变
        this.autoStartProcessing(params.outputPath, params.processCount, params.exportConfig, params.dedupeExpireDays, true // 仍然是定时任务
        ).catch((error) => {
          console.error('[UserGrowthBatchFragments] 重试任务执行失败:', error);
        });
      }, 60 * 60 * 1000); // 1小时 = 3600000 毫秒

      console.log('[UserGrowthBatchFragments] 重试任务已安排');
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 创建重试任务失败:', error);
    }
  }

  /**
   * 获取任务列表
   * @returns {Promise<Object>} 任务列表
   */
  async getTasks() {
    console.log('[UserGrowthBatchFragments] getTasks 被调用');

    try {
      const tasks = this.taskManager.getTasks();
      return { success: true, tasks };
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 获取任务列表失败:', error);
      return { success: true, tasks: [] };
    }
  }

  /**
   * 格式化日期时间
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的日期时间字符串
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
   * 检查 ByteGrowth 登录状态
   */
  async checkUserGrowthLogin() {
    try {
      // 检查内存中的 Cookie
      const memoryCookies = this.cookieManager.getCookies('usergrowth');
      if (memoryCookies && memoryCookies.length > 0) {
        console.log('[UserGrowthBatchFragments] ByteGrowth 已登录（内存）');
        return { success: true };
      }

      // 检查文件中的 Cookie
      const fileCookies = await FileCookieStore.loadCookies(this.cookieFileName);
      if (fileCookies && fileCookies.length > 0) {
        console.log('[UserGrowthBatchFragments] ByteGrowth 已登录（文件）');
        this.cookieManager.saveCookies('usergrowth', fileCookies);
        return { success: true };
      }

      console.log('[UserGrowthBatchFragments] ByteGrowth 未登录');
      return { success: false, message: '未登录 ByteGrowth' };
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 检查登录状态失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取选中的剧目（复用 ADX 的去重逻辑）
   */
  async getSelectedDramas(dedupeExpireDays, processCount = 5) {
    try {
      // 读取任务数据
      const data = this.taskManager.readTaskData();
      const tasks = data.tasks || [];
      console.log(`[UserGrowthBatchFragments] 读取到 ${tasks.length} 个历史任务`);

      // 获取热门剧目
      const hotDramas = await this.fetchHotDramas();
      console.log(`[UserGrowthBatchFragments] 千沧热榜: ${hotDramas.length} 部`);
      if (!hotDramas || hotDramas.length === 0) {
        return [];
      }

      // 去重：提取最近已处理的剧目
      const downloaded = this.extractRecentDownloads(tasks, dedupeExpireDays);
      console.log(`[UserGrowthBatchFragments] 最近${dedupeExpireDays}天已处理: ${downloaded.length} 部`, downloaded);

      // 过滤并选择
      const available = hotDramas.filter((name) => !downloaded.includes(name));
      console.log(`[UserGrowthBatchFragments] 可用剧目: ${available.length} 部`);

      // 根据 processCount 参数截取剧目数量
      const selected = available.slice(0, processCount);
      console.log(`[UserGrowthBatchFragments] 选中剧目: ${selected.length} 部（配置数量: ${processCount}）`, selected);

      return selected;
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 获取剧目失败:', error);
      return [];
    }
  }

  /**
   * 提取最近已下载的剧目
   */
  extractRecentDownloads(tasks, expireDays) {
    const now = Date.now();
    const downloaded = new Set();

    tasks
      .filter((task) => task.status === '已完成' && task.module === '爆款扒产')
      .forEach((task) => {
        const taskTimestamp = parseInt(task.id);
        const daysSince = (now - taskTimestamp) / (1000 * 60 * 60 * 24);
        if (daysSince <= expireDays) {
          const dramas = task.dramas || [];
          dramas.forEach((name) => downloaded.add(name));
        }
      });

    return Array.from(downloaded);
  }

  /**
   * 获取热门剧目
   */
  async fetchHotDramas() {
    const https = require('https');
    return new Promise((resolve, reject) => {
      https
        .get('https://scriptv2.qfei.cn/api/client/short_film/hot', (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json.data?.list || []);
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    try {
      console.log('[UserGrowthBatchFragments] 初始化浏览器...');
      this.browser = await this.browserManager.createBrowser();

      // 加载 Cookie
      const cookies = this.cookieManager.getCookies('usergrowth') || (await FileCookieStore.loadCookies(this.cookieFileName));

      if (cookies && cookies.length > 0) {
        this.context = await this.browserManager.createContextWithCookies(cookies, this.userAgent);
      } else {
        this.context = await this.browserManager.createContext(this.userAgent);
      }

      this.page = await this.context.newPage();
      console.log('[UserGrowthBatchFragments] 浏览器初始化完成');
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 浏览器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 批量处理 ByteGrowth 平台剧目
   * @param {string[]} dramaNames - 剧目名称数组
   * @param {string} outputPath - 输出路径
   * @returns {Promise<Object>} { "短剧A": "filepath", "短剧B": "filepath" }
   */
  async processUserGrowthFragmentDramas(dramaNames, outputPath) {
    const results = {};
    const succDramas = [];
    const failedDramas = [];
    const fragmentCounts = {}; // 新增：记录每部剧的片段数量

    try {
      console.log(`[UserGrowthBatchFragments] 开始批量处理 ByteGrowth 剧目，共 ${dramaNames.length} 部`);

      // 检查 ByteGrowth 登录状态
      const loginCheck = await this.checkUserGrowthLogin();
      if (!loginCheck.success) {
        console.error('[UserGrowthBatchFragments] ByteGrowth 未登录，跳过处理');
        // 返回空结果（不添加任何短剧）
        return {
          results: results,
          succDramas: succDramas,
          failedDramas: failedDramas,
          fragmentCounts: fragmentCounts
        };
      }

      // 初始化浏览器
      await this.initBrowser();

      for (let i = 0; i < dramaNames.length; i++) {
        const dramaName = dramaNames[i];
        console.log(`[UserGrowthBatchFragments] 处理 ByteGrowth 剧目 ${i + 1}/${dramaNames.length}: ${dramaName}`);

        try {
          // 传入 dedupeExpireDays 参数（从全局配置中获取）
          const dedupeExpireDays = 30; // 默认30天，可以从配置中读取
          const result = await this.processSingleUserGrowthFragmentDrama(dramaName, outputPath, dedupeExpireDays);
          // 只有下载成功才添加到结果中
          if (result && result.filepath) {
            results[dramaName] = result.filepath;
            fragmentCounts[dramaName] = result.fragmentCount; // 记录片段数量
            succDramas.push(dramaName);
            console.log(`[UserGrowthBatchFragments] 剧目 ${dramaName} 处理成功: ${result.filepath}, 片段数: ${result.fragmentCount}`);
          } else {
            failedDramas.push(dramaName);
            console.error(`[UserGrowthBatchFragments] 剧目 ${dramaName} 处理失败: 返回了空路径`);
          }
        } catch (error) {
          failedDramas.push(dramaName);
          console.error(`[UserGrowthBatchFragments] 剧目 ${dramaName} 处理异常:`, error);
          // 失败时不添加到结果中，直接跳过进入下一个循环
        }
      }

      // 关闭浏览器
      await this.safeCloseAll();

      return {
        results: results, // { "短剧A": "filepath", "短剧B": "filepath" }
        succDramas: succDramas, // ["短剧A", "短剧B"]
        failedDramas: failedDramas, // ["短剧C"]
        fragmentCounts: fragmentCounts // { "短剧A": 12, "短剧B": 8 }
      };
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 批量处理 ByteGrowth 剧目失败:', error);
      await this.safeCloseAll();
      // 即使出错也返回已处理的结果
      return {
        results: results,
        succDramas: succDramas,
        failedDramas: failedDramas,
        fragmentCounts: fragmentCounts
      };
    }
  }

  /**
   * 检查是否已下载该剧目（去重）
   * @param {string} dramaName - 剧目名称
   * @param {string} outputPath - 输出路径
   * @param {number} dedupeExpireDays - 去重天数（默认30天）
   * @returns {Object|null} 如果已存在，返回 { filepath, fragmentCount }，否则返回 null
   */
  checkExistingDownload(dramaName, outputPath, dedupeExpireDays = 30) {
    const fs = require('fs');
    const path = require('path');

    try {
      // 检查输出目录是否存在
      if (!fs.existsSync(outputPath)) {
        return null;
      }

      // 获取所有文件和文件夹
      const items = fs.readdirSync(outputPath);

      // 查找以"短剧名_"开头的文件夹
      const matchingFolders = items.filter((item) => {
        const itemPath = path.join(outputPath, item);
        const isDirectory = fs.statSync(itemPath).isDirectory();
        return isDirectory && item.startsWith(`${dramaName}_`);
      });

      if (matchingFolders.length === 0) {
        console.log(`[UserGrowthBatchFragments] 未找到 ${dramaName} 的已下载文件夹`);
        return null;
      }

      console.log(`[UserGrowthBatchFragments] 找到 ${matchingFolders.length} 个匹配的文件夹: ${matchingFolders.join(', ')}`);

      // 遍历所有匹配的文件夹，检查是否满足去重条件
      for (const folderName of matchingFolders) {
        // 提取时间戳（文件夹名格式：短剧名_时间戳）
        const timestampMatch = folderName.match(/_(\d+)$/);
        if (!timestampMatch) {
          console.log(`[UserGrowthBatchFragments] 文件夹 ${folderName} 格式不正确，跳过`);
          continue;
        }

        const timestamp = parseInt(timestampMatch[1]);
        const folderDate = new Date(timestamp);
        const now = new Date();
        const daysDiff = (now.getTime() - folderDate.getTime()) / (1000 * 60 * 60 * 24);

        console.log(`[UserGrowthBatchFragments] 文件夹 ${folderName}:`);
        console.log(`[UserGrowthBatchFragments]   下载时间: ${folderDate.toLocaleString()}`);
        console.log(`[UserGrowthBatchFragments]   距今天数: ${daysDiff.toFixed(1)} 天`);

        // 判断1: 如果超过去重天数，跳过该文件夹
        if (daysDiff > dedupeExpireDays) {
          console.log(`[UserGrowthBatchFragments]   超过 ${dedupeExpireDays} 天，视为过期，继续检查下一个文件夹`);
          continue;
        }

        // 判断2: 检查文件夹内的视频文件数量
        const folderPath = path.join(outputPath, folderName);
        const files = fs.readdirSync(folderPath);
        const videoFiles = files.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
        });

        const videoCount = videoFiles.length;
        console.log(`[UserGrowthBatchFragments]   视频文件数量: ${videoCount}`);

        // 判断3: 如果文件数量 >= 10，认为已下载完整
        if (videoCount >= 2) {
          console.log(`[UserGrowthBatchFragments]   文件数量满足条件（>= 10），跳过下载`);
          return {
            filepath: folderPath,
            fragmentCount: videoCount
          };
        } else {
          console.log(`[UserGrowthBatchFragments]   文件数量不足（< 10），需要重新下载`);
        }
      }

      // 所有文件夹都不满足条件，需要重新下载
      console.log(`[UserGrowthBatchFragments] 所有已存在文件夹均不满足去重条件，将重新下载`);
      return null;
    } catch (error) {
      console.error(`[UserGrowthBatchFragments] 检查已下载文件夹失败:`, error);
      return null;
    }
  }

  /**
   * 处理单个墨攻平台剧目（片段）
   * @param {string} dramaName - 剧目名称
   * @param {string} outputPath - 输出路径
   * @param {number} dedupeExpireDays - 去重天数（默认30天）
   * @returns {Promise<Object>} { filepath: string, fragmentCount: number }
   */
  async processSingleUserGrowthFragmentDrama(dramaName, outputPath, dedupeExpireDays = 30) {
    console.log(`[UserGrowthBatchFragments] 开始处理剧目: ${dramaName}`);

    // 步骤0: 去重检查
    console.log(`[UserGrowthBatchFragments] ========== 去重检查 ==========`);
    const existingDownload = this.checkExistingDownload(dramaName, outputPath, dedupeExpireDays);
    if (existingDownload) {
      console.log(`[UserGrowthBatchFragments]   剧目 ${dramaName} 已存在，跳过下载`);
      console.log(`[UserGrowthBatchFragments]   路径: ${existingDownload.filepath}`);
      console.log(`[UserGrowthBatchFragments]   片段数: ${existingDownload.fragmentCount}`);
      return existingDownload;
    }
    console.log(`[UserGrowthBatchFragments] 未找到有效的已下载文件，开始下载流程...`);
    console.log(`[UserGrowthBatchFragments] ========== 开始下载 ==========`);

    // 步骤1: 打开目标页面
    console.log('[UserGrowthBatchFragments] 访问目标页面...');

    await this.page.goto(this.targetUrl, { waitUntil: 'networkidle', timeout: 120000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 步骤2: 点击进入按钮和墨攻AI（根据 Python 参考代码 click_enter_and_mogong）
    console.log('[UserGrowthBatchFragments] 点击进入和墨攻AI...');
    const enterOk = await this.clickEnterAndMogong();
    if (!enterOk) {
      console.warn('[UserGrowthBatchFragments] 进入/墨攻AI步骤未成功，尝试继续执行...');
    }

    // 步骤3: 重置筛选器（根据 Python 参考代码 _reset_filter）
    console.log('[UserGrowthBatchFragments] 重置筛选器...');
    await this.resetFilter();

    // 步骤4: 操作筛选器
    await this.clickFilterButton(dramaName);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 步骤5: 操作排序器
    await this.clickSortButton();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 测试 休眠
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // 步骤6: 检查是否有结果卡片
    const hasResults = await this.checkResults();
    if (!hasResults) {
      throw new Error('没有搜索结果');
    }


    // 步骤7: 选择20个素材
    const selectCount = await this.selectMaterials(20);
    if (selectCount === 0) {
      throw new Error('没有可选择的素材');
    }

    // 步骤8: 下载素材
    const filepath = await this.downloadMaterials(dramaName, outputPath);
    console.log(`[UserGrowthBatchFragments] 剧目 ${dramaName} 下载完成: ${filepath}, 片段数: ${selectCount}`);

    // 返回文件路径和片段数量
    return { filepath, fragmentCount: selectCount };
  }

  /**
   * 解压 zip 文件
   * @param {string} zipFilePath - zip 文件路径
   * @returns {Promise<string>} 解压后的目录路径
   */
  async extractZipFile(zipFilePath) {
    const fs = require('fs');
    const path = require('path');
    const unzipper = require('unzipper');

    try {
      console.log(`[UserGrowthBatchFragments] 开始解压文件: ${zipFilePath}`);

      // 获取 zip 文件的目录和文件名（不含扩展名）
      const zipDir = path.dirname(zipFilePath);
      const zipBasename = path.basename(zipFilePath, '.zip');

      // 创建解压目标目录
      const extractPath = path.join(zipDir, zipBasename);

      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }

      // 解压文件
      await new Promise((resolve, reject) => {
        fs.createReadStream(zipFilePath)
          .pipe(unzipper.Extract({ path: extractPath }))
          .on('close', () => {
            console.log(`[UserGrowthBatchFragments] 解压完成: ${extractPath}`);
            resolve();
          })
          .on('error', (error) => {
            console.error(`[UserGrowthBatchFragments] 解压失败:`, error);
            reject(error);
          });
      });

      // 统计解压后的文件
      const files = fs.readdirSync(extractPath);
      console.log(`[UserGrowthBatchFragments] 解压后共 ${files.length} 个文件`);

      // 删除原始 zip 文件（可选）
      try {
        fs.unlinkSync(zipFilePath);
        console.log(`[UserGrowthBatchFragments] 已删除原始 zip 文件`);
      } catch (error) {
        console.warn(`[UserGrowthBatchFragments] 删除原始 zip 文件失败:`, error.message);
      }

      return extractPath;
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 解压文件失败:', error);
      // 如果解压失败，返回原始 zip 文件路径
      return zipFilePath;
    }
  }

  /**
   * 点击进入按钮和墨攻AI按钮
   * 根据 Python 参考代码: click_enter_and_mogong
   */
  async clickEnterAndMogong() {
    try {
      console.log('[UserGrowthBatchFragments] 开始点击进入和墨攻AI...');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 步骤1: 查找并点击"进入"按钮
      console.log('[UserGrowthBatchFragments] 查找进入按钮...');
      const enterButton = await this.page.waitForSelector(
        'button.ug-button-secondary:has-text("进 入")',
        { timeout: 15000, state: 'visible' }
      );

      if (!enterButton) {
        console.error('[UserGrowthBatchFragments] 未找到进入按钮');
        return false;
      }

      await enterButton.scrollIntoViewIfNeeded();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await enterButton.click();
      console.log('[UserGrowthBatchFragments] 已点击进入按钮');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // 步骤2: 检查并处理活动弹窗
      await this.handleActivityPopup();

      // 步骤3: 点击"墨攻AI"按钮
      console.log('[UserGrowthBatchFragments] 查找墨攻AI按钮...');
      const mogongAiButton = await this.page.waitForSelector(
        'div.arco-menu-item:has-text("墨攻AI")',
        { timeout: 10000, state: 'visible' }
      );

      if (!mogongAiButton) {
        console.error('[UserGrowthBatchFragments] 未找到墨攻AI按钮');
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await mogongAiButton.click();
      console.log('[UserGrowthBatchFragments] 已点击墨攻AI按钮');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log('[UserGrowthBatchFragments] 进入和墨攻AI点击完成');
      return true;
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 点击进入或墨攻AI失败:', error);
      return false;
    }
  }

  /**
   * 检查并处理活动弹窗
   * 根据 Python 参考代码: handle_activity_popup
   */
  async handleActivityPopup() {
    try {
      console.log('[UserGrowthBatchFragments] 检查活动弹窗...');

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 直接通过 JS 检查弹窗和按钮是否存在（避免 Playwright CSS 选择器遗漏 shadow DOM 等情况）
      const popupInfo = await this.page.evaluate(() => {
        const popup = document.querySelector('#task-popup');
        if (!popup) return { hasPopup: false };

        const style = window.getComputedStyle(popup);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

        // 查找"我已知悉"按钮（优先精确匹配，其次模糊匹配）
        let dismissBtn = document.querySelector('#dismissButton');
        if (!dismissBtn) {
          // 尝试其他常见选择器
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            if (btn.textContent.trim() === '我已知悉') {
              dismissBtn = btn;
              break;
            }
          }
        }
        if (!dismissBtn) {
          // 尝试包含"已知悉"的按钮
          const allButtons = document.querySelectorAll('button, [role="button"]');
          for (const btn of allButtons) {
            if (btn.textContent.includes('已知悉')) {
              dismissBtn = btn;
              break;
            }
          }
        }

        return {
          hasPopup: true,
          isVisible,
          hasDismissButton: !!dismissBtn,
          btnText: dismissBtn ? dismissBtn.textContent.trim() : null
        };
      });

      console.log('[UserGrowthBatchFragments] 弹窗信息:', JSON.stringify(popupInfo));

      if (popupInfo.hasPopup && popupInfo.isVisible && popupInfo.hasDismissButton) {
        console.log('[UserGrowthBatchFragments] 检测到活动弹窗，准备点击我已知悉...');

        // 直接用 JS 点击，不依赖 Playwright 的元素可见性检测
        const clicked = await this.page.evaluate(() => {
          let btn = document.querySelector('#dismissButton');
          if (!btn) {
            const allButtons = document.querySelectorAll('button');
            for (const b of allButtons) {
              if (b.textContent.trim() === '我已知悉') {
                btn = b;
                break;
              }
            }
          }
          if (!btn) {
            const allBtns = document.querySelectorAll('button, [role="button"]');
            for (const b of allBtns) {
              if (b.textContent.includes('已知悉')) {
                btn = b;
                break;
              }
            }
          }
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log('[UserGrowthBatchFragments] 已通过JavaScript点击我已知悉按钮');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          console.log('[UserGrowthBatchFragments] 未找到我已知悉按钮，跳过');
        }
      } else if (!popupInfo.hasPopup) {
        console.log('[UserGrowthBatchFragments] 未检测到活动弹窗（#task-popup不存在），跳过');
      } else if (!popupInfo.isVisible) {
        console.log('[UserGrowthBatchFragments] 弹窗不可见，跳过');
      }
    } catch (error) {
      console.log('[UserGrowthBatchFragments] 活动弹窗处理跳过:', error.message);
    }
  }

  /**
   * 重置筛选器
   * 根据 Python 参考代码: _reset_filter
   * 点击筛选器 -> 点击重置 -> 点击确定关闭筛选器
   */
  async resetFilter() {
    try {
      console.log('[UserGrowthBatchFragments] 重置筛选器...');

      // 点击筛选器按钮
      const filterButton = await this.page.waitForSelector('button:has-text("筛选器")', { timeout: 10000 });
      if (filterButton) {
        await filterButton.click();
        console.log('[UserGrowthBatchFragments] 筛选器已打开');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 点击重置按钮
        try {
          const resetButton = await this.page.waitForSelector('button:has-text("重置")', { timeout: 5000 });
          if (resetButton) {
            await resetButton.click();
            console.log('[UserGrowthBatchFragments] 筛选器已重置');
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.log('[UserGrowthBatchFragments] 未找到重置按钮:', e.message);
        }

        // 点击确定关闭筛选器
        try {
          const confirmButton = await this.page.waitForSelector('button:has-text("确定")', { timeout: 3000 });
          if (confirmButton) {
            await confirmButton.click();
            console.log('[UserGrowthBatchFragments] 筛选器已关闭');
            await new Promise((resolve) => setTimeout(resolve, 30000));
          }
        } catch (e) {
          console.log('[UserGrowthBatchFragments] 关闭筛选器跳过:', e.message);
        }
      }
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 重置筛选器失败:', error);
    }
  }

  /**
   * 点击筛选器并设置条件（墨攻平台）
   * 根据 Python 参考代码: _set_filter_with_date_and_keyword
   */
  async clickFilterButton(dramaName) {
    try {
      console.log('[UserGrowthBatchFragments] 点击筛选器...');

      // 1. 点击筛选器按钮
      const filterButton = await this.page.waitForSelector('button:has-text("筛选器")', { timeout: 30000 });
      if (!filterButton) {
        console.warn('[UserGrowthBatchFragments] 未找到筛选器按钮');
        return;
      }
      await filterButton.click();
      console.log('[UserGrowthBatchFragments] 筛选器按钮已点击');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // ========== 第一个条件：创建日期 ==========

      // 2. 点击"添加条件"
      console.log('[UserGrowthBatchFragments] 点击添加条件（创建日期）...');
      const addConditionBtn = await this.page.waitForSelector('button:has-text("添加条件")', { timeout: 10000 });
      if (!addConditionBtn) {
        console.warn('[UserGrowthBatchFragments] 未找到添加条件按钮');
        return;
      }
      await addConditionBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 2.1 点击下拉菜单中的"添加条件"
      console.log('[UserGrowthBatchFragments] 点击下拉菜单中的添加条件...');
      try {
        const dropdownItem = await this.page.waitForSelector('.arco-dropdown-menu-item:has-text("添加条件")', { timeout: 5000 });
        if (dropdownItem) {
          await dropdownItem.click();
          console.log('[UserGrowthBatchFragments] 已点击下拉菜单中的添加条件');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 未找到下拉菜单项:', e.message);
      }

      // 2.2 选择筛选项"创建日期"
      console.log('[UserGrowthBatchFragments] 选择创建日期...');
      const selectInput = await this.page.waitForSelector('.arco-select-view:has(input[placeholder="选择筛选项"])', { timeout: 10000 });
      if (!selectInput) {
        console.warn('[UserGrowthBatchFragments] 未找到筛选项下拉框');
        return;
      }
      await selectInput.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const createTimeOption = await this.page.waitForSelector('li.arco-select-option:has-text("创建日期")', { timeout: 10000 });
      if (!createTimeOption) {
        console.warn('[UserGrowthBatchFragments] 未找到创建日期选项');
        return;
      }
      await createTimeOption.click();
      console.log('[UserGrowthBatchFragments] 已选择创建日期');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 2.3 选择操作"介于"
      console.log('[UserGrowthBatchFragments] 选择日期操作...');
      const operationSelect = await this.page.waitForSelector('.arco-select-view:has(input[placeholder="选择操作"])', { timeout: 10000 });
      if (operationSelect) {
        await operationSelect.click();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const betweenOption = await this.page.waitForSelector('li.arco-select-option:has-text("介于")', { timeout: 5000 });
        if (betweenOption) {
          await betweenOption.click();
          console.log('[UserGrowthBatchFragments] 已选择介于');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // 2.4 填写日期范围
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() - 1); // 昨天
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 8); // 往前推8天

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      console.log(`[UserGrowthBatchFragments] 填写日期: ${startDateStr} 至 ${endDateStr}`);

      const startDateInput = await this.page.waitForSelector('input[placeholder="开始日期"]', { timeout: 10000 });
      if (startDateInput) {
        await startDateInput.click();
        await startDateInput.fill(startDateStr);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const endDateInput = await this.page.waitForSelector('input[placeholder="结束日期"]', { timeout: 10000 });
      if (endDateInput) {
        await endDateInput.click();
        await endDateInput.fill(endDateStr);
        await endDateInput.press('Enter');
        console.log('[UserGrowthBatchFragments] 已填入日期');
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // ========== 第二个条件：文件名 ==========

      // 3. 再次点击"添加条件"
      console.log('[UserGrowthBatchFragments] 点击添加条件（文件名）...');
      const addConditionBtn2 = await this.page.waitForSelector('button:has-text("添加条件")', { timeout: 10000 });
      if (addConditionBtn2) {
        await addConditionBtn2.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 3.0 点击下拉菜单中的"添加条件"
      console.log('[UserGrowthBatchFragments] 点击下拉菜单中的添加条件（第二个）...');
      try {
        const dropdownItem2 = await this.page.waitForSelector('.arco-dropdown-menu-item:has-text("添加条件")', { timeout: 5000 });
        if (dropdownItem2) {
          await dropdownItem2.click();
          console.log('[UserGrowthBatchFragments] 已点击下拉菜单中的添加条件（第二个）');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 未找到下拉菜单项:', e.message);
      }

      // 3.1 选择筛选项"文件名"
      console.log('[UserGrowthBatchFragments] 选择文件名...');
      const filenameSelect = await this.page.waitForSelector('.arco-select-view:has(input[placeholder="选择筛选项"])', { timeout: 10000 });
      if (filenameSelect) {
        await filenameSelect.click();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const filenameOption = await this.page.waitForSelector('li.arco-select-option:has-text("文件名")', { timeout: 10000 });
        if (filenameOption) {
          await filenameOption.click();
          console.log('[UserGrowthBatchFragments] 已选择文件名');
          await new Promise((resolve) => setTimeout(resolve, 500));

          // 3.2 选择"包含"操作
          console.log('[UserGrowthBatchFragments] 选择包含...');
          const operationSelect2 = await this.page.waitForSelector('.arco-select-view:has(input[placeholder="选择操作"])', { timeout: 10000 });
          if (operationSelect2) {
            await operationSelect2.click();
            await new Promise((resolve) => setTimeout(resolve, 500));

            const containsOption = await this.page.waitForSelector('li.arco-select-option:has-text("包含")', { timeout: 10000 });
            if (containsOption) {
              await containsOption.click();
              console.log('[UserGrowthBatchFragments] 已选择包含');
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }
      }

      // 3.3 输入关键词
      console.log(`[UserGrowthBatchFragments] 输入关键词: ${dramaName}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const textInput = await this.page.waitForSelector('input[placeholder="请输入"]', { timeout: 5000 });
        if (textInput) {
          await textInput.fill(dramaName);
          console.log(`[UserGrowthBatchFragments] 已输入关键词: ${dramaName}`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 输入关键词失败:', e.message);
      }

      // 4. 点击确定按钮
      console.log('[UserGrowthBatchFragments] 点击确定...');
      const confirmButton = await this.page.waitForSelector('button:has-text("确定")', { timeout: 10000 });
      if (confirmButton) {
        await confirmButton.click();
        console.log('[UserGrowthBatchFragments] 筛选器设置完成');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 筛选器操作失败:', error);
      throw error;
    }
  }

  /**
   * 点击排序器并设置条件（墨攻平台）
   * 根据 Python 参考代码: _click_sorter_button_with_consume_time
   * 三列布局：1.维度(消耗) 2.时间范围(近3天) 3.排序方向(降序)
   */
  async clickSortButton() {
    try {
      console.log('[UserGrowthBatchFragments] 点击排序器...');

      // 步骤1: 点击排序器下拉框
      console.log('[UserGrowthBatchFragments] 点击排序器下拉框...');
      const sorterButton = await this.page.waitForSelector('.horizontal-sort-select .arco-select', { timeout: 10000 });
      if (!sorterButton) {
        throw new Error('未找到排序器按钮');
      }
      await sorterButton.click();
      console.log('[UserGrowthBatchFragments] 排序器按钮已点击');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 步骤2: 等待下拉面板出现
      console.log('[UserGrowthBatchFragments] 等待下拉面板...');
      const popup = await this.page.waitForSelector('.arco-select-popup-inner.sort-select-dropdown', { timeout: 5000 });
      if (!popup) {
        throw new Error('未找到下拉面板');
      }
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 步骤3: 选择维度 - 点击"消耗"
      console.log('[UserGrowthBatchFragments] 选择维度: 消耗');
      try {
        const consumeOption = await this.page.waitForSelector(
          '.arco-select-popup-inner .value-content:first-child button:has-text("消耗")',
          { timeout: 5000 }
        );
        if (consumeOption) {
          await consumeOption.click();
          console.log('[UserGrowthBatchFragments] 已点击消耗');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 点击消耗失败，继续执行...');
      }

      // 步骤4: 选择时间范围 - 点击"近3天"
      console.log('[UserGrowthBatchFragments] 选择时间范围: 近3天');
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 定位排序下拉框
        const dropdown = await this.page.waitForSelector('.arco-select-popup-inner.sort-select-dropdown', { timeout: 5000 });

        if (dropdown) {
          // 获取所有 div.value-content，第二个是时间范围列
          const valueContents = await dropdown.$$('div.value-content');

          if (valueContents.length >= 2) {
            const timeGroup = valueContents[1]; // 第二列是时间范围
            const buttons = await timeGroup.$$('button.select-option');

            let targetBtn = null;
            for (const btn of buttons) {
              const btnText = await btn.innerText();
              if (btnText.trim() === '近3天') {
                targetBtn = btn;
                break;
              }
            }

            if (targetBtn) {
              // 使用 JavaScript 点击按钮元素
              await this.page.evaluate((btn) => {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
              }, targetBtn);
              await new Promise((resolve) => setTimeout(resolve, 500));
              await this.page.evaluate((btn) => {
                btn.click();
              }, targetBtn);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              console.log('[UserGrowthBatchFragments] 未找到时间选项近3天');
            }
          }
        }
      } catch (e) {
        console.log(`[UserGrowthBatchFragments] 点击近3天失败: ${e.message}`);
      }

      // 步骤5: 选择排序方向 - 点击"降序"
      console.log('[UserGrowthBatchFragments] 选择排序方向: 降序');
      try {
        const orderOption = await this.page.waitForSelector(
          '.arco-select-popup-inner .value-content:nth-child(5) button:has-text("降序")',
          { timeout: 5000 }
        );
        if (orderOption) {
          await orderOption.click();
          console.log('[UserGrowthBatchFragments] 已点击降序');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 点击降序失败，继续执行...');
      }

      // 步骤6: 按 ESC 退出排序器
      console.log('[UserGrowthBatchFragments] 按 ESC 退出排序器...');
      await this.page.keyboard.press('Escape');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log('[UserGrowthBatchFragments] 排序器设置完成');
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 排序器操作失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否有搜索结果（墨攻平台）
   */
  async checkResults() {
    try {
      console.log('[UserGrowthBatchFragments] 检查搜索结果...');

      // 等待结果加载
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 查找结果卡片：墨攻平台使用 .waterfall-item 类
      const cards = await this.page.$$('.waterfall-item');

      if (!cards || cards.length === 0) {
        console.log('[UserGrowthBatchFragments] 没有找到结果卡片');
        return false;
      }

      console.log(`[UserGrowthBatchFragments] 找到 ${cards.length} 个结果卡片`);
      return true;
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 检查结果失败:', error);
      return false;
    }
  }

  /**
   * 选择素材（墨攻平台 - 点击 check-icon 图标）
   */
  async selectMaterials(count = 20) {
    try {
      console.log(`[UserGrowthBatchFragments] 开始选择 ${count} 个素材...`);

      // 查找所有复选框图标：墨攻平台使用 .waterfall-item .check-icon
      const checkIcons = await this.page.$$('.waterfall-item .check-icon');
      console.log(`[UserGrowthBatchFragments] 找到 ${checkIcons.length} 个素材`);

      // 选择前 count 个素材
      const selectCount = Math.min(count, checkIcons.length);

      for (let i = 0; i < selectCount; i++) {
        try {
          // 点击复选框图标进行选择
          await checkIcons[i].click();
          console.log(`[UserGrowthBatchFragments] 已选择第 ${i + 1} 个素材`);
          await new Promise((resolve) => setTimeout(resolve, 200)); // 短暂延迟
        } catch (error) {
          console.error(`[UserGrowthBatchFragments] 选择第 ${i + 1} 个素材失败:`, error);
        }
      }

      console.log(`[UserGrowthBatchFragments] 成功选择 ${selectCount} 个素材`);

      // 滚动到页面顶部，确保下载按钮可见
      console.log('[UserGrowthBatchFragments] 滚动到页面顶部...');
      await this.page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return selectCount;
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 选择素材失败:', error);
      throw error;
    }
  }

  /**
   * 下载素材（墨攻平台 - 下载视频）
   * 对照 Python 参考代码: _select_current_and_download
   */
  async downloadMaterials(dramaName, outputPath) {
    const fs = require('fs');
    const path = require('path');

    try {
      console.log('[UserGrowthBatchFragments] 开始下载素材...');

      // 确保输出目录存在
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
        console.log(`[UserGrowthBatchFragments] 创建输出目录: ${outputPath}`);
      }

      // 步骤1: 点击"下载"按钮
      console.log('[UserGrowthBatchFragments] 点击下载按钮...');
      const downloadBtn = await this.page.waitForSelector('button:has(svg.ug_menu-icon-magoai_download)', { timeout: 10000 });
      if (!downloadBtn) {
        throw new Error('未找到下载按钮');
      }
      await downloadBtn.click();
      console.log('[UserGrowthBatchFragments] 下载按钮已点击');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 步骤2: 点击"原始下载"（限定在下拉菜单范围内，避免点到审核信息下载等）
      console.log('[UserGrowthBatchFragments] 点击原始下载...');
      const originalDownloadMenuItem = await this.page.waitForSelector(
        '.arco-dropdown-menu .arco-dropdown-menu-item:has-text("原始下载")',
        { timeout: 8000 }
      );
      if (!originalDownloadMenuItem) {
        throw new Error('未找到原始下载选项');
      }

      console.log('[UserGrowthBatchFragments] 找到原始下载菜单项，准备触发下载...');

      // 先启动下载监听，再点击
      const downloadPromise = this.page.waitForEvent('download', { timeout: 0 });
      await originalDownloadMenuItem.click();
      console.log('[UserGrowthBatchFragments] 已点击原始下载，等待下载事件...');

      const download = await downloadPromise;
      const downloadPath = await download.path();
      const suggestedFilename = await download.suggestedFilename();
      console.log(`[UserGrowthBatchFragments] 下载事件已触发，临时路径: ${downloadPath}`);

      // 生成目标文件路径
      const timestamp = Date.now();
      const filename = `${dramaName}_${timestamp}.zip`;
      const filepath = path.join(outputPath, filename);
      console.log(`[UserGrowthBatchFragments] 目标文件路径: ${filepath}`);

      // 步骤3: 轮询等待下载真正完成（文件大小稳定，不限制时间）
      console.log('[UserGrowthBatchFragments] 等待下载完成（不限制时间）...');
      let lastSize = -1;
      let stableCount = 0;
      const pollIntervalMs = 3000;

      while (true) {
        try {
          const stats = fs.statSync(downloadPath);
          const currentSize = stats.size;

          if (currentSize === lastSize && lastSize > 0) {
            stableCount++;
            if (stableCount >= 2) {
              console.log(`[UserGrowthBatchFragments] 下载完成！最终大小: ${(currentSize / 1024 / 1024).toFixed(2)} MB`);
              break;
            }
          } else {
            stableCount = 0;
            lastSize = currentSize;
            console.log(`[UserGrowthBatchFragments] 下载中... ${(currentSize / 1024 / 1024).toFixed(2)} MB`);
          }
        } catch (e) {
          // 文件还不存在或被锁住，继续等待
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      // 等待一小段时间确保文件完全写入
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 步骤4: 复制文件到目标路径
      if (fs.existsSync(downloadPath)) {
        fs.copyFileSync(downloadPath, filepath);
        console.log(`[UserGrowthBatchFragments] 文件已保存到: ${filepath}`);

        // 删除临时文件
        try {
          fs.unlinkSync(downloadPath);
        } catch {}

        // 验证文件大小
        const finalStats = fs.statSync(filepath);
        console.log(`[UserGrowthBatchFragments] 文件大小: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

        // 步骤5: 自动解压 zip 文件
        const extractedPath = await this.extractZipFile(filepath);
        return extractedPath;
      } else {
        throw new Error('下载文件不存在');
      }
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 下载素材失败:', error);
      throw error;
    }
  }

  /**
   * 批量处理墨攻平台剧目
   * @param {string[]} dramaNames - 剧目名称数组
   * @param {string} outputPath - 输出路径
   * @returns {Promise<Object>} { "短剧A": ["链接1", "链接2"], "短剧B": ["链接1", "链接2"] }
   */
  async processUserGrowthDramas(dramaNames, outputPath) {
    try {
      console.log(`[UserGrowthBatchFragments] 开始批量处理墨攻平台剧目，共 ${dramaNames.length} 部`);

      // 创建 UserGrowth 节点
      const userGrowthNode = new UserGrowthShortFilmNode(this.browserManager);

      // 调用批量处理方法
      const results = await userGrowthNode.processUserGrowthDramas(dramaNames, outputPath);

      return results;
    } catch (error) {
      console.error(`[UserGrowthBatchFragments] 墨攻平台批量处理失败:`, error);
      // 返回空结果
      const emptyResults = {};
      dramaNames.forEach((name) => {
        emptyResults[name] = [];
      });
      return emptyResults;
    }
  }

  /**
   * 安全关闭浏览器
   */
  async safeCloseAll() {
    try {
      if (this.page) await this.page.close();
    } catch {}
    this.page = null;

    try {
      if (this.context) await this.context.close();
    } catch {}
    this.context = null;

    try {
      await this.browserManager.disposeBrowser();
    } catch {}
    console.log('[UserGrowthBatchFragments] 浏览器已关闭');
  }
}

exports.UserGrowthBatchFragmentsNode = UserGrowthBatchFragmentsNode;
