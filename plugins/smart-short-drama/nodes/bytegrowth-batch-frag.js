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
const dramaListParser = require('../utils/drama-list-parser');
const { ADXSearchNode } = require('./adx-search');

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
  async autoStartProcessing(outputPath, processCount = 5, exportConfig = {}, dedupeExpireDays = 30, isScheduledTask = false, dramaListFilePath = '') {
    console.log('[UserGrowthBatchFragments] autoStartProcessing 开始执行');
    console.log('[UserGrowthBatchFragments] 接收到的参数:', {
      outputPath,
      processCount,
      exportConfig,
      dedupeExpireDays,
      isScheduledTask,
      dramaListFilePath
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
      materials: {
        runFragments: {
          mogong: this.createEmptyRunFragmentResult(),
          adx: this.createEmptyRunFragmentResult()
        },
        originals: {
          mogong: this.createEmptyOriginalResult()
        }
      },
      replication: {
        outputs: {
          mogong: this.createEmptyReplicationOutputResult(),
          adx: this.createEmptyReplicationOutputResult()
        },
        totalOutputCount: 0
      },
      params: {
        outputPath,
        processCount,
        exportConfig,
        dedupeExpireDays,
        isScheduledTask,
        dramaListFilePath
      }
    };

    // 2. 定义执行函数（真正的业务逻辑）
    const executor = async (params) => {
      const path = require('path');
      console.log('[UserGrowthBatchFragments] 开始执行任务业务逻辑');

      // 计算路径：basePath/复刻片段/日期/ 和 basePath/爆款复刻/日期/
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const replicationBasePath_part = path.join(params.outputPath, '跑量片段', dateStr, '墨攻');
      const replicationBasePath_all = path.join(params.outputPath, '短剧原片', dateStr, '墨攻');
      const dedupOutputPath = path.join(params.outputPath, '复刻片段', dateStr);

      console.log('[UserGrowthBatchFragments] 墨攻跑量片段基础路径:', replicationBasePath_part);
      console.log('[UserGrowthBatchFragments] 短剧原片基础路径:', replicationBasePath_all);
      console.log('[UserGrowthBatchFragments] 去重结果输出路径:', dedupOutputPath);

      // 步骤1: 从 Excel 获取剧目。爆款复刻不再依赖千仓热榜选剧。
      const selectedDramas = await this.getSelectedDramasFromExcel(params.dramaListFilePath);
      if (!selectedDramas || selectedDramas.length === 0) {
        // 判断任务类型：定时任务 vs 即时任务
        if (params.isScheduledTask) {
          console.log('[UserGrowthBatchFragments] 定时任务暂无可用剧目，将在 1 小时后自动重试');

          // 创建延后 1 小时的重试任务（一次性 cron）
          this.scheduleRetryTask(params);

          // 返回特殊结果，表示任务完成但无可用剧目
          return {
            materials: {
              runFragments: {
                mogong: {
                  ...this.createEmptyRunFragmentResult(),
                  message: '暂无可用剧目，已安排 1 小时后重试'
                },
                adx: this.createEmptyRunFragmentResult()
              },
              originals: {
                mogong: this.createEmptyOriginalResult()
              }
            },
            replication: {
              outputs: {
                mogong: this.createEmptyReplicationOutputResult(),
                adx: this.createEmptyReplicationOutputResult()
              },
              totalOutputCount: 0
            }
          };
        } else {
          // 即时任务直接抛出错误
          console.log('[UserGrowthBatchFragments] 即时任务无可用剧目，任务结束');
          throw new Error('没有可处理的剧目，请上传有效的剧目列表 Excel');
        }
      }

      console.log('[UserGrowthBatchFragments] 选中剧目:', selectedDramas);
      const reusableMaterials = this.collectReusableReplicationMaterials(selectedDramas);
      console.log('[UserGrowthBatchFragments] 可复用素材统计:', {
        mogongFragments: reusableMaterials.runFragments.mogong.succDramas.length,
        adxFragments: reusableMaterials.runFragments.adx.succDramas.length,
        originals: reusableMaterials.originals.mogong.succDramas.length
      });

      // 步骤2: 批量处理墨攻平台剧目（跑量片段）
      let mogongFragmentData = reusableMaterials.runFragments.mogong;
      let mogongFragmentMessage = mogongFragmentData.message || '';
      const missingMogongFragmentDramas = selectedDramas.filter((name) => !mogongFragmentData.results[name]);

      if (missingMogongFragmentDramas.length > 0) {
        try {
          const downloadedMogongFragments = await this.processUserGrowthFragmentDramas(missingMogongFragmentDramas, replicationBasePath_part);
          mogongFragmentData = this.mergeMaterialResults(mogongFragmentData, downloadedMogongFragments, 'fragmentCounts');
          mogongFragmentMessage = `${mogongFragmentMessage}${mogongFragmentMessage ? '；' : ''}墨攻跑量片段补下载完成，成功 ${downloadedMogongFragments.succDramas?.length || 0} 部，失败 ${downloadedMogongFragments.failedDramas?.length || 0} 部`;
          console.log('[UserGrowthBatchFragments] 墨攻跑量片段处理完成:', mogongFragmentData);
        } catch (error) {
          console.error('[UserGrowthBatchFragments] 墨攻跑量片段处理异常:', error);
          mogongFragmentMessage = `处理异常: ${error.message}`;
          mogongFragmentData = this.mergeMaterialResults(mogongFragmentData, {
            results: {},
            succDramas: [],
            failedDramas: missingMogongFragmentDramas,
            fragmentCounts: {},
            errors: Object.fromEntries(missingMogongFragmentDramas.map((name) => [name, error.message]))
          }, 'fragmentCounts');
        }
      } else {
        console.log('[UserGrowthBatchFragments] 墨攻跑量片段均已存在，跳过墨攻片段下载');
      }

      // 步骤2.5: ADX 跑量片段爬取。ADX 失败不阻断墨攻原链路。
      let adxGrowthData = reusableMaterials.runFragments.adx;
      let adxGrowthMessage = adxGrowthData.message || '';
      const missingAdxFragmentDramas = selectedDramas.filter((name) => !adxGrowthData.results[name]);

      if (missingAdxFragmentDramas.length > 0) {
        try {
          const adxNode = new ADXSearchNode();
          const downloadedAdxFragments = await adxNode.processReplicationFragments(params.outputPath, missingAdxFragmentDramas, dateStr, 20);
          adxGrowthData = this.mergeMaterialResults(adxGrowthData, downloadedAdxFragments, 'fragmentCounts');
          adxGrowthMessage = `${adxGrowthMessage}${adxGrowthMessage ? '；' : ''}${downloadedAdxFragments.message || ''}`;
          console.log('[UserGrowthBatchFragments] ADX 跑量片段处理完成:', adxGrowthData);
        } catch (error) {
          console.error('[UserGrowthBatchFragments] ADX 跑量片段处理异常:', error);
          adxGrowthMessage = `处理异常: ${error.message}`;
          adxGrowthData = this.mergeMaterialResults(adxGrowthData, {
            results: {},
            succDramas: [],
            failedDramas: missingAdxFragmentDramas,
            fragmentCounts: {},
            errors: Object.fromEntries(missingAdxFragmentDramas.map((name) => [name, error.message]))
          }, 'fragmentCounts');
        }
      } else {
        console.log('[UserGrowthBatchFragments] ADX跑量片段均已存在，跳过ADX爬取');
      }

      // 步骤3: 批量处理墨攻平台剧目（全量原片）
      const originalDramaNames = Array.from(new Set([...(mogongFragmentData.succDramas || []), ...(adxGrowthData.succDramas || [])]));
      let userGrowthData = this.filterMaterialResult(reusableMaterials.originals.mogong, originalDramaNames, 'originalCounts');
      let userGrowthMessage = userGrowthData.message || '';
      const missingOriginalDramaNames = originalDramaNames.filter((name) => !userGrowthData.results[name]);

      if (originalDramaNames.length === 0) {
        console.log('[UserGrowthBatchFragments] 没有成功的墨攻/ADX跑量片段，跳过短剧原片处理');
        userGrowthData = {
          results: {},
          succDramas: [],
          failedDramas: [],
          originalCounts: {},
          errors: {}
        };
      } else if (missingOriginalDramaNames.length > 0) {
        try {
          const downloadedOriginals = await this.processUserGrowthDramas(missingOriginalDramaNames, replicationBasePath_all);
          userGrowthData = this.mergeMaterialResults(userGrowthData, downloadedOriginals, 'originalCounts');
          userGrowthMessage = `${userGrowthMessage}${userGrowthMessage ? '；' : ''}短剧原片补下载完成，成功 ${downloadedOriginals.succDramas?.length || 0} 部，失败 ${downloadedOriginals.failedDramas?.length || 0} 部`;
          console.log('[UserGrowthBatchFragments] 墨攻平台处理完成:', userGrowthData);
        } catch (error) {
          console.error('[UserGrowthBatchFragments] 墨攻平台处理异常:', error);
          userGrowthMessage = `处理异常: ${error.message}`;
          userGrowthData = this.mergeMaterialResults(userGrowthData, {
            results: {},
            succDramas: [],
            failedDramas: missingOriginalDramaNames,
            originalCounts: {},
            errors: Object.fromEntries(missingOriginalDramaNames.map((name) => [name, error.message]))
          }, 'originalCounts');
        }
      } else {
        console.log('[UserGrowthBatchFragments] 短剧原片均已存在，跳过墨攻原片下载');
      }

      // 步骤4: 视频去重流程（调用本地服务）
      const VideoDedupService = require('./video-dedup-service');
      const dedupService = new VideoDedupService();
      const mogongDedup = await this.processDedupForFragmentSource({
        sourceName: '墨攻',
        fragmentData: mogongFragmentData,
        userGrowthData,
        dedupService,
        outputBasePath: path.join(dedupOutputPath, '墨攻')
      });

      const adxDedup = await this.processDedupForFragmentSource({
        sourceName: 'ADX',
        fragmentData: adxGrowthData,
        userGrowthData,
        dedupService,
        outputBasePath: path.join(dedupOutputPath, 'ADX')
      });

      const totalOutputCount = mogongDedup.totalOutputCount + adxDedup.totalOutputCount;

      return {
        materials: {
          runFragments: {
            mogong: {
              message: mogongFragmentMessage,
              outputPaths: Object.values(mogongFragmentData.results || {}),
              succDramas: mogongFragmentData.succDramas || [],
              failedDramas: mogongFragmentData.failedDramas || [],
              fragmentCounts: mogongFragmentData.fragmentCounts || {},
              errors: mogongFragmentData.errors || {}
            },
            adx: {
              message: adxGrowthMessage,
              outputPaths: Object.values(adxGrowthData.results || {}),
              succDramas: adxGrowthData.succDramas || [],
              failedDramas: adxGrowthData.failedDramas || [],
              fragmentCounts: adxGrowthData.fragmentCounts || {},
              errors: adxGrowthData.errors || {}
            }
          },
          originals: {
            mogong: {
              message: userGrowthMessage,
              outputPaths: Object.values(userGrowthData.results || {}),
              succDramas: userGrowthData.succDramas || [],
              failedDramas: userGrowthData.failedDramas || [],
              episodeCounts: userGrowthData.originalCounts || {},
              errors: userGrowthData.errors || {}
            }
          }
        },
        replication: {
          outputs: {
            mogong: mogongDedup,
            adx: adxDedup
          },
          totalOutputCount
        },
        totalOutputCount
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
   * 跑量片段素材结果空结构。
   */
  createEmptyRunFragmentResult(message = '') {
    return {
      message,
      outputPaths: [],
      succDramas: [],
      failedDramas: [],
      fragmentCounts: {},
      errors: {}
    };
  }

  /**
   * 短剧原片素材结果空结构。
   */
  createEmptyOriginalResult(message = '') {
    return {
      message,
      outputPaths: [],
      succDramas: [],
      failedDramas: [],
      episodeCounts: {},
      errors: {}
    };
  }

  /**
   * 复刻成品结果空结构。
   */
  createEmptyReplicationOutputResult(message = '') {
    return {
      message,
      outputPaths: [],
      outputCounts: {},
      failedDramas: [],
      errors: {}
    };
  }

  /**
   * 从复刻页面上传的 Excel 中读取剧目列表。
   */
  async getSelectedDramasFromExcel(dramaListFilePath) {
    if (!dramaListFilePath || String(dramaListFilePath).trim() === '') {
      throw new Error('请先上传剧目列表 Excel');
    }

    const parseResult = await dramaListParser.parseDramaList(dramaListFilePath);
    if (!parseResult.success || !Array.isArray(parseResult.dramaNames) || parseResult.dramaNames.length === 0) {
      throw new Error(parseResult.message || 'Excel 解析失败或剧目列表为空');
    }

    const seen = new Set();
    const dramaNames = [];
    for (const name of parseResult.dramaNames) {
      const cleanName = String(name || '').trim();
      if (!cleanName || seen.has(cleanName)) {
        continue;
      }
      seen.add(cleanName);
      dramaNames.push(cleanName);
    }

    console.log('[UserGrowthBatchFragments] Excel 剧目列表:', dramaNames);
    return dramaNames;
  }

  collectReusableReplicationMaterials(dramaNames) {
    const tasks = this.getCompletedReplicationTasks();
    return {
      runFragments: {
        mogong: this.collectReusableMaterial({
          tasks,
          dramaNames,
          sourceName: '墨攻跑量片段',
          countKey: 'fragmentCounts',
          minVideoCount: 1,
          getSource: (task) => task.materials?.runFragments?.mogong
        }),
        adx: this.collectReusableMaterial({
          tasks,
          dramaNames,
          sourceName: 'ADX跑量片段',
          countKey: 'fragmentCounts',
          minVideoCount: 1,
          getSource: (task) => task.materials?.runFragments?.adx
        })
      },
      originals: {
        mogong: this.collectReusableMaterial({
          tasks,
          dramaNames,
          sourceName: '墨攻短剧原片',
          countKey: 'originalCounts',
          sourceCountKey: 'episodeCounts',
          minVideoCount: 10,
          getSource: (task) => task.materials?.originals?.mogong
        })
      }
    };
  }

  getCompletedReplicationTasks() {
    try {
      const data = this.taskManager.readTaskData();
      return (data.tasks || [])
        .filter((task) => task.module === '爆款复刻' && task.status === '已完成')
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    } catch (error) {
      console.warn('[UserGrowthBatchFragments] 读取历史复刻任务失败:', error.message);
      return [];
    }
  }

  collectReusableMaterial({ tasks, dramaNames, sourceName, countKey, sourceCountKey = countKey, minVideoCount, getSource }) {
    const result = {
      results: {},
      succDramas: [],
      failedDramas: [],
      [countKey]: {},
      errors: {},
      message: ''
    };

    for (const dramaName of dramaNames) {
      const reusable = this.findReusableMaterialForDrama(tasks, dramaName, getSource, sourceCountKey, minVideoCount);
      if (!reusable) {
        continue;
      }

      result.results[dramaName] = reusable.path;
      result.succDramas.push(dramaName);
      result[countKey][dramaName] = reusable.count;
    }

    result.message = result.succDramas.length > 0 ? `${sourceName}复用历史素材 ${result.succDramas.length} 部` : '';
    return result;
  }

  findReusableMaterialForDrama(tasks, dramaName, getSource, sourceCountKey, minVideoCount) {
    for (const task of tasks) {
      const source = getSource(task);
      if (!source || !Array.isArray(source.succDramas) || !source.succDramas.includes(dramaName)) {
        continue;
      }

      const materialPath = this.findMaterialPathForDrama(source.outputPaths, dramaName);
      if (!materialPath) {
        continue;
      }

      const actualCount = this.countVideoFiles(materialPath);
      if (actualCount < minVideoCount) {
        console.warn(`[UserGrowthBatchFragments] 历史素材文件数不足，忽略: ${dramaName}, ${materialPath}, count=${actualCount}`);
        continue;
      }

      return {
        path: materialPath,
        count: Math.max(Number(source[sourceCountKey]?.[dramaName] || 0), actualCount)
      };
    }

    return null;
  }

  findMaterialPathForDrama(outputPaths, dramaName) {
    const path = require('path');
    const paths = this.normalizeOutputPaths(outputPaths);
    const cleanDramaName = this.sanitizePathName(dramaName);

    return paths.find((itemPath) => {
      const baseName = path.basename(itemPath);
      return baseName === dramaName || baseName === cleanDramaName;
    }) || (paths.length === 1 ? paths[0] : '');
  }

  normalizeOutputPaths(outputPaths) {
    if (Array.isArray(outputPaths)) {
      return outputPaths.map((p) => String(p || '').trim()).filter(Boolean);
    }
    if (typeof outputPaths === 'string') {
      return outputPaths.split(';').map((p) => p.trim()).filter(Boolean);
    }
    return [];
  }

  countVideoFiles(folderPath) {
    const fs = require('fs');
    const path = require('path');
    const videoExtensions = new Set(['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv']);

    try {
      if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return 0;
      }

      let count = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(entryPath);
          } else if (videoExtensions.has(path.extname(entry.name).toLowerCase())) {
            count++;
          }
        }
      };

      walk(folderPath);
      return count;
    } catch (error) {
      console.warn('[UserGrowthBatchFragments] 统计视频文件失败:', folderPath, error.message);
      return 0;
    }
  }

  mergeMaterialResults(baseResult, nextResult, countKey) {
    const merged = {
      results: { ...(baseResult?.results || {}) },
      succDramas: [...(baseResult?.succDramas || [])],
      failedDramas: [...(baseResult?.failedDramas || [])],
      [countKey]: { ...(baseResult?.[countKey] || {}) },
      errors: { ...(baseResult?.errors || {}) },
      message: baseResult?.message || ''
    };

    for (const dramaName of nextResult?.succDramas || []) {
      if (!merged.succDramas.includes(dramaName)) {
        merged.succDramas.push(dramaName);
      }
      delete merged.errors[dramaName];
    }

    for (const dramaName of nextResult?.failedDramas || []) {
      if (!merged.results[dramaName] && !merged.failedDramas.includes(dramaName)) {
        merged.failedDramas.push(dramaName);
      }
    }

    Object.assign(merged.results, nextResult?.results || {});
    Object.assign(merged[countKey], nextResult?.[countKey] || {});
    Object.assign(merged.errors, nextResult?.errors || {});
    merged.failedDramas = merged.failedDramas.filter((name) => !merged.results[name]);

    return merged;
  }

  filterMaterialResult(result, dramaNames, countKey) {
    const filtered = {
      results: {},
      succDramas: [],
      failedDramas: [],
      [countKey]: {},
      errors: {},
      message: result?.message || ''
    };
    const allowed = new Set(dramaNames);

    for (const dramaName of result?.succDramas || []) {
      if (!allowed.has(dramaName)) continue;
      filtered.results[dramaName] = result.results?.[dramaName];
      filtered.succDramas.push(dramaName);
      filtered[countKey][dramaName] = result[countKey]?.[dramaName] || 0;
    }

    return filtered;
  }

  /**
   * 对某一路跑量片段做复刻去重，输出到 复刻片段/YYYY-MM-DD/来源/剧名。
   */
  async processDedupForFragmentSource({ sourceName, fragmentData, userGrowthData, dedupService, outputBasePath }) {
    const path = require('path');
    const outputPaths = [];
    const outputCounts = {};
    const failedDramas = [];
    const errors = {};
    let totalOutputCount = 0;

    if (!fragmentData?.succDramas || fragmentData.succDramas.length === 0) {
      console.log(`[UserGrowthBatchFragments] ${sourceName}无成功跑量片段，跳过去重`);
      return {
        message: `${sourceName}复刻完成，成功 0 部，失败 0 部`,
        outputPaths,
        outputCounts,
        failedDramas,
        errors,
        totalOutputCount
      };
    }

    for (const dramaName of fragmentData.succDramas || []) {
      if (!userGrowthData.succDramas.includes(dramaName)) {
        console.log(`[UserGrowthBatchFragments] ${sourceName} 跳过去重，原片未成功: ${dramaName}`);
        failedDramas.push(dramaName);
        errors[dramaName] = '短剧原片未成功下载';
        continue;
      }

      const userGrowthPath = userGrowthData.results[dramaName];
      const fragmentPath = fragmentData.results[dramaName];
      if (!fragmentPath) {
        console.log(`[UserGrowthBatchFragments] ${sourceName} 跳过去重，跑量片段路径为空: ${dramaName}`);
        failedDramas.push(dramaName);
        errors[dramaName] = '跑量片段路径为空';
        continue;
      }

      console.log(`[UserGrowthBatchFragments] 开始${sourceName}去重: ${dramaName}`);
      console.log(`[UserGrowthBatchFragments]   全量原片: ${userGrowthPath}`);
      console.log(`[UserGrowthBatchFragments]   ${sourceName}片段: ${fragmentPath}`);

      try {
        const dramaDedupOutputPath = path.join(outputBasePath, dramaName);
        const dedupResult = await dedupService.processDeduplication(userGrowthPath, fragmentPath, dramaName, dramaDedupOutputPath);

        if (dedupResult.success) {
          const outputCount = this.countDedupOutputVideos(dedupResult, dramaDedupOutputPath);
          if (outputCount > 0) {
            outputPaths.push(dramaDedupOutputPath);
            outputCounts[dramaName] = outputCount;
            totalOutputCount += outputCount;
            console.log(`[UserGrowthBatchFragments] ${sourceName}去重完成: ${dramaName}, 产出 ${outputCount} 个`);
          } else {
            failedDramas.push(dramaName);
            errors[dramaName] = '去重成功但未产出视频';
            console.error(`[UserGrowthBatchFragments] ${sourceName}去重未产出: ${dramaName}`);
          }
        } else {
          failedDramas.push(dramaName);
          errors[dramaName] = dedupResult.error || '去重失败';
          console.error(`[UserGrowthBatchFragments] ${sourceName}去重失败: ${dramaName}, 错误: ${dedupResult.error}`);
        }
      } catch (error) {
        failedDramas.push(dramaName);
        errors[dramaName] = error.message;
        console.error(`[UserGrowthBatchFragments] ${sourceName}去重异常: ${dramaName}, 错误: ${error.message}`);
      }
    }

    return {
      message: `${sourceName}复刻完成，成功 ${Object.keys(outputCounts).length} 部，失败 ${failedDramas.length} 部`,
      outputPaths,
      outputCounts,
      failedDramas,
      errors,
      totalOutputCount
    };
  }

  /**
   * 统计复刻去重实际产出的视频数量。
   * 优先使用去重服务返回的 restored_video，并确认文件存在；如果服务结果缺失，则兜底扫描输出目录。
   */
  countDedupOutputVideos(dedupResult, outputPath) {
    const fs = require('fs');
    const path = require('path');

    try {
      const restoredVideos = Array.isArray(dedupResult?.analyze?.results)
        ? dedupResult.analyze.results
            .map((item) => item?.result?.restored_video)
            .filter((videoPath) => videoPath && fs.existsSync(videoPath))
        : [];

      if (restoredVideos.length > 0) {
        return restoredVideos.length;
      }

      if (!outputPath || !fs.existsSync(outputPath)) {
        return 0;
      }

      return fs
        .readdirSync(outputPath)
        .filter((file) => path.extname(file).toLowerCase() === '.mp4').length;
    } catch (error) {
      console.warn('[UserGrowthBatchFragments] 统计复刻产出视频数量失败:', error.message);
      return 0;
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
        this.autoStartProcessing(params.outputPath, params.processCount, params.exportConfig, params.dedupeExpireDays, true, params.dramaListFilePath || '' // 仍然是定时任务
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
   * 检查墨攻登录状态
   */
  async checkUserGrowthLogin() {
    try {
      // 检查内存中的 Cookie
      const memoryCookies = this.cookieManager.getCookies('usergrowth');
      if (memoryCookies && memoryCookies.length > 0) {
        console.log('[UserGrowthBatchFragments] 墨攻已登录（内存）');
        return { success: true };
      }

      // 检查文件中的 Cookie
      const fileCookies = await FileCookieStore.loadCookies(this.cookieFileName);
      if (fileCookies && fileCookies.length > 0) {
        console.log('[UserGrowthBatchFragments] 墨攻已登录（文件）');
        this.cookieManager.saveCookies('usergrowth', fileCookies);
        return { success: true };
      }

      console.log('[UserGrowthBatchFragments] 墨攻未登录');
      return { success: false, message: '未登录墨攻平台' };
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
   * 批量处理墨攻平台剧目
   * @param {string[]} dramaNames - 剧目名称数组
   * @param {string} outputPath - 输出路径
   * @returns {Promise<Object>} { "短剧A": "filepath", "短剧B": "filepath" }
   */
  async processUserGrowthFragmentDramas(dramaNames, outputPath) {
    const results = {};
    const succDramas = [];
    const failedDramas = [];
    const fragmentCounts = {}; // 新增：记录每部剧的片段数量
    const errors = {};

    try {
      console.log(`[UserGrowthBatchFragments] 开始批量处理墨攻剧目，共 ${dramaNames.length} 部`);

      // 检查墨攻登录状态
      const loginCheck = await this.checkUserGrowthLogin();
      if (!loginCheck.success) {
        console.error('[UserGrowthBatchFragments] 墨攻未登录，跳过处理');
        // 返回空结果（不添加任何短剧）
        return {
          results: results,
          succDramas: succDramas,
          failedDramas: dramaNames,
          fragmentCounts: fragmentCounts,
          errors: Object.fromEntries(dramaNames.map((name) => [name, loginCheck.message || '墨攻平台未登录']))
        };
      }

      // 初始化浏览器
      await this.initBrowser();

      for (let i = 0; i < dramaNames.length; i++) {
        const dramaName = dramaNames[i];
        console.log(`[UserGrowthBatchFragments] 处理墨攻剧目 ${i + 1}/${dramaNames.length}: ${dramaName}`);

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
            errors[dramaName] = '返回了空路径';
            console.error(`[UserGrowthBatchFragments] 剧目 ${dramaName} 处理失败: 返回了空路径`);
          }
        } catch (error) {
          failedDramas.push(dramaName);
          errors[dramaName] = error.message || String(error);
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
        fragmentCounts: fragmentCounts, // { "短剧A": 12, "短剧B": 8 }
        errors: errors
      };
    } catch (error) {
      console.error('[UserGrowthBatchFragments] 批量处理墨攻剧目失败:', error);
      await this.safeCloseAll();
      // 即使出错也返回已处理的结果
      return {
        results: results,
        succDramas: succDramas,
        failedDramas: failedDramas,
        fragmentCounts: fragmentCounts,
        errors: errors
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
      const dramaFolderPath = path.join(outputPath, this.sanitizePathName(dramaName));
      if (!fs.existsSync(dramaFolderPath)) {
        console.log(`[UserGrowthBatchFragments] 未找到 ${dramaName} 的已下载跑量片段文件夹`);
        return null;
      }

      const files = fs.readdirSync(dramaFolderPath);
      const videoFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'].includes(ext);
      });

      console.log(`[UserGrowthBatchFragments] 检查已下载跑量片段: ${dramaFolderPath}, 视频数: ${videoFiles.length}`);
      if (videoFiles.length >= 2) {
        return {
          filepath: dramaFolderPath,
          fragmentCount: videoFiles.length
        };
      }

      console.log(`[UserGrowthBatchFragments] 已存在跑量片段数量不足，需要重新下载: ${dramaName}`);
      return null;
    } catch (error) {
      console.error(`[UserGrowthBatchFragments] 检查已下载文件夹失败:`, error);
      return null;
    }
  }

  sanitizePathName(name) {
    return String(name || '').trim().replace(/[<>:"/\\|?*]/g, '_');
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
    await this.waitForBlockingOverlayToDisappear(30000, 'reset filter');
    console.log('[UserGrowthBatchFragments] 重置完成，等待60秒后再设置筛选条件...');
    await this.sleep(60000);

    // 步骤4: 操作筛选器
    await this.clickFilterButton(dramaName);
    await this.waitForBlockingOverlayToDisappear(30000, 'apply filter');
    await this.sleep(1000);

    // 步骤5: 操作排序器
    await this.clickSortButton();
    await this.waitForBlockingOverlayToDisappear(30000, 'apply sorter');
    await this.sleep(3000);

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
  async extractZipFile(zipFilePath, targetDir = '') {
    const fs = require('fs');
    const path = require('path');
    const unzipper = require('unzipper');

    try {
      console.log(`[UserGrowthBatchFragments] 开始解压文件: ${zipFilePath}`);

      let extractPath = targetDir;
      if (!extractPath) {
        const zipDir = path.dirname(zipFilePath);
        const zipBasename = path.basename(zipFilePath, '.zip');
        extractPath = path.join(zipDir, zipBasename);
      }

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

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitForBlockingOverlayToDisappear(timeout = 30000, reason = 'interaction') {
    if (!this.page) {
      return;
    }

    try {
      await this.page.waitForFunction(
        () => {
          const selectors = ['#overlay', '#task-overlay', '.overlay-M9HUOF', '.arco-spin-mask'];

          const isBlocking = (element) => {
            if (!element) {
              return false;
            }

            const style = window.getComputedStyle(element);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.pointerEvents === 'none' ||
              Number(style.opacity || '1') === 0
            ) {
              return false;
            }

            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };

          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (isBlocking(element)) {
                return false;
              }
            }
          }

          return true;
        },
        null,
        { timeout }
      );
    } catch (error) {
      console.warn(`[UserGrowthBatchFragments] overlay wait timed out before ${reason}: ${error.message}`);
    }
  }

  async safeElementClick(elementOrSelector, label, options = {}) {
    const {
      timeout = 10000,
      postDelay = 500,
      waitForSelectorOptions = { state: 'visible' },
      overlayTimeout = 30000,
      allowJsFallback = true
    } = options;

    let elementHandle = elementOrSelector;
    if (typeof elementOrSelector === 'string') {
      elementHandle = await this.page.waitForSelector(elementOrSelector, {
        timeout,
        ...waitForSelectorOptions
      });
    }

    if (!elementHandle) {
      throw new Error(`${label} not found`);
    }

    await this.waitForBlockingOverlayToDisappear(overlayTimeout, `${label} click`);

    try {
      await elementHandle.scrollIntoViewIfNeeded();
    } catch {}

    try {
      await elementHandle.click({ timeout });
    } catch (error) {
      const message = error?.message || String(error);
      const shouldFallback =
        allowJsFallback &&
        (message.includes('intercepts pointer events') || message.includes('not stable') || message.includes('Timeout'));

      if (!shouldFallback) {
        throw error;
      }

      console.warn(`[UserGrowthBatchFragments] falling back to JS click for ${label}: ${message}`);
      await this.page.evaluate((element) => {
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
      }, elementHandle);
    }

    if (postDelay > 0) {
      await this.sleep(postDelay);
    }

    await this.waitForBlockingOverlayToDisappear(overlayTimeout, `${label} post-click`);
    return elementHandle;
  }

  async waitForDownloadEvent(timeout = 15000) {
    try {
      return await this.page.waitForEvent('download', { timeout });
    } catch (error) {
      const message = error?.message || String(error);
      if ((error?.name || '') === 'TimeoutError' || message.includes('Timeout')) {
        return null;
      }
      throw error;
    }
  }

  async handleTaskCreationSuccessModal(timeout = 12000) {
    if (!this.page) {
      return { handled: false, action: 'none' };
    }

    try {
      const modal = await this.page.waitForSelector('.arco-modal-content:has-text("任务创建成功")', {
        timeout,
        state: 'visible'
      });
      if (!modal) {
        return { handled: false, action: 'none' };
      }

      const modalText = await modal.evaluate((element) => element.textContent || '');
      if (!modalText.includes('任务创建成功')) {
        return { handled: false, action: 'none' };
      }

      console.log('[UserGrowthBatchFragments] 检测到任务创建成功弹窗，准备处理任务详情入口...');

      const detailButton = await modal.$('button:has-text("查看任务详情")');
      if (detailButton) {
        await this.safeElementClick(detailButton, '查看任务详情按钮', {
          timeout: 10000,
          postDelay: 1000
        });
        await this.sleep(1000);
        await this.waitForBlockingOverlayToDisappear(30000, 'open task detail');
        return { handled: true, action: 'detail' };
      }

      const taskListTarget = await modal.$('.target');
      if (taskListTarget) {
        await this.safeElementClick(taskListTarget, '任务列表入口', {
          timeout: 8000,
          postDelay: 1000
        });
        await this.sleep(1000);
        await this.waitForBlockingOverlayToDisappear(30000, 'open task list');
        return { handled: true, action: 'task-list' };
      }

      const closeButton = await modal.$('.arco-modal-close-icon') || (await this.page.$('.arco-modal-close-icon'));
      if (closeButton) {
        await this.safeElementClick(closeButton, '任务成功弹窗关闭按钮', {
          timeout: 5000,
          postDelay: 500
        });
        return { handled: true, action: 'close' };
      }

      console.warn('[UserGrowthBatchFragments] 任务创建成功弹窗存在，但未找到可操作按钮');
      return { handled: false, action: 'none' };
    } catch (error) {
      const message = error?.message || String(error);
      if ((error?.name || '') === 'TimeoutError' || message.includes('Timeout')) {
        return { handled: false, action: 'none' };
      }
      console.warn(`[UserGrowthBatchFragments] 处理任务创建成功弹窗失败: ${message}`);
      return { handled: false, action: 'none' };
    }
  }

  async findVisibleTaskDownloadAction() {
    const selectors = [
      'button:has-text("下载结果")',
      'button:has-text("下载文件")',
      'button:has-text("下载")',
      'a:has-text("下载结果")',
      'a:has-text("下载文件")',
      'a:has-text("下载")',
      '[role="button"]:has-text("下载结果")',
      '[role="button"]:has-text("下载文件")',
      '[role="button"]:has-text("下载")',
      'a[download]'
    ];

    for (const selector of selectors) {
      const element = await this.page.$(selector);
      if (!element) {
        continue;
      }

      const isVisible = await element.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const isDisabled =
          node.hasAttribute('disabled') ||
          node.getAttribute('aria-disabled') === 'true' ||
          node.classList.contains('disabled');

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          !isDisabled
        );
      });

      if (isVisible) {
        return element;
      }
    }

    return null;
  }

  async persistPlaywrightDownload(download, dramaName, dramaDir) {
    const fs = require('fs');
    const path = require('path');

    const failure = await download.failure();
    if (failure) {
      throw new Error(`浏览器下载失败: ${failure}`);
    }

    const downloadPath = await download.path();
    let suggestedFilename = '';
    try {
      suggestedFilename = download.suggestedFilename();
    } catch {}
    if (!downloadPath) {
      throw new Error('浏览器未返回下载临时文件');
    }

    console.log(`[UserGrowthBatchFragments] 下载事件已触发，临时路径: ${downloadPath}`);

    const timestamp = Date.now();
    const ext = path.extname(suggestedFilename || '') || '.zip';
    const filename = `${this.sanitizePathName(dramaName)}_${timestamp}${ext}`;
    const filepath = path.join(dramaDir, filename);
    console.log(`[UserGrowthBatchFragments] 目标文件路径: ${filepath}`);

    let lastSize = -1;
    let stableCount = 0;
    const pollIntervalMs = 3000;

    console.log('[UserGrowthBatchFragments] 等待下载完成（不限制时间）...');
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
      } catch (error) {
        // 文件还不存在或被锁住，继续等待
      }

      await this.sleep(pollIntervalMs);
    }

    await this.sleep(2000);

    if (!fs.existsSync(downloadPath)) {
      throw new Error('下载文件不存在');
    }

    fs.copyFileSync(downloadPath, filepath);
    console.log(`[UserGrowthBatchFragments] 文件已保存到: ${filepath}`);

    try {
      fs.unlinkSync(downloadPath);
    } catch {}

    const finalStats = fs.statSync(filepath);
    console.log(`[UserGrowthBatchFragments] 文件大小: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

    if (filepath.toLowerCase().endsWith('.zip')) {
      return await this.extractZipFile(filepath, dramaDir);
    }

    return filepath;
  }

  async waitForTaskDetailDownload(dramaName, dramaDir, timeout = 600000) {
    const deadline = Date.now() + timeout;
    console.log('[UserGrowthBatchFragments] 开始等待任务详情页中的下载结果...');

    while (Date.now() < deadline) {
      await this.waitForBlockingOverlayToDisappear(30000, 'task detail polling');

      const immediateDownload = await this.waitForDownloadEvent(1500);
      if (immediateDownload) {
        return await this.persistPlaywrightDownload(immediateDownload, dramaName, dramaDir);
      }

      const downloadAction = await this.findVisibleTaskDownloadAction();
      if (downloadAction) {
        console.log('[UserGrowthBatchFragments] 找到任务详情页下载入口，准备触发下载...');
        const downloadPromise = this.waitForDownloadEvent(45000);
        await this.safeElementClick(downloadAction, '任务详情下载按钮', {
          timeout: 8000,
          postDelay: 1000
        });

        const download = await downloadPromise;
        if (download) {
          return await this.persistPlaywrightDownload(download, dramaName, dramaDir);
        }
      }

      const refreshButton = await this.page.$('button:has-text("刷新"), [role="button"]:has-text("刷新")');
      if (refreshButton) {
        try {
          await this.safeElementClick(refreshButton, '任务详情刷新按钮', {
            timeout: 5000,
            postDelay: 1000
          });
        } catch (error) {
          console.log(`[UserGrowthBatchFragments] 刷新任务详情失败，继续等待: ${error.message}`);
        }
      }

      await this.sleep(5000);
    }

    throw new Error('任务详情页等待下载结果超时');
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

      await this.safeElementClick('button:has-text("筛选器")', '筛选器按钮', { timeout: 10000, postDelay: 1000 });
      console.log('[UserGrowthBatchFragments] 筛选器已打开');

      try {
        await this.safeElementClick('button:has-text("重置")', '重置按钮', { timeout: 5000, postDelay: 500 });
        console.log('[UserGrowthBatchFragments] 筛选器已重置');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 未找到重置按钮:', e.message);
      }

      try {
        await this.safeElementClick('button:has-text("确定")', '筛选器确定按钮', { timeout: 3000, postDelay: 800 });
        console.log('[UserGrowthBatchFragments] 筛选器已关闭');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 关闭筛选器跳过:', e.message);
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

      await this.safeElementClick('button:has-text("筛选器")', '筛选器按钮', { timeout: 30000, postDelay: 1000 });
      console.log('[UserGrowthBatchFragments] 筛选器按钮已点击');

      // ========== 第一个条件：创建日期 ==========

      console.log('[UserGrowthBatchFragments] 点击添加条件（创建日期）...');
      await this.safeElementClick('button:has-text("添加条件")', '添加条件按钮-创建日期', { timeout: 10000, postDelay: 500 });

      console.log('[UserGrowthBatchFragments] 点击下拉菜单中的添加条件...');
      try {
        await this.safeElementClick('.arco-dropdown-menu-item:has-text("添加条件")', '下拉添加条件-创建日期', {
          timeout: 5000,
          postDelay: 500
        });
        console.log('[UserGrowthBatchFragments] 已点击下拉菜单中的添加条件');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 未找到下拉菜单项:', e.message);
      }

      console.log('[UserGrowthBatchFragments] 选择创建日期...');
      await this.safeElementClick('.arco-select-view:has(input[placeholder="选择筛选项"])', '筛选项下拉框-创建日期', {
        timeout: 10000,
        postDelay: 500
      });
      await this.safeElementClick('li.arco-select-option:has-text("创建日期")', '创建日期选项', {
        timeout: 10000,
        postDelay: 500
      });
      console.log('[UserGrowthBatchFragments] 已选择创建日期');

      console.log('[UserGrowthBatchFragments] 选择日期操作...');
      await this.safeElementClick('.arco-select-view:has(input[placeholder="选择操作"])', '操作下拉框-创建日期', {
        timeout: 10000,
        postDelay: 500
      });
      await this.safeElementClick('li.arco-select-option:has-text("介于")', '介于选项', {
        timeout: 5000,
        postDelay: 500
      });
      console.log('[UserGrowthBatchFragments] 已选择介于');

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
      if (!startDateInput) {
        throw new Error('未找到开始日期输入框');
      }
      await this.safeElementClick(startDateInput, '开始日期输入框', { timeout: 5000, postDelay: 100 });
      await startDateInput.fill(startDateStr);
      await this.sleep(300);

      const endDateInput = await this.page.waitForSelector('input[placeholder="结束日期"]', { timeout: 10000 });
      if (!endDateInput) {
        throw new Error('未找到结束日期输入框');
      }
      await this.safeElementClick(endDateInput, '结束日期输入框', { timeout: 5000, postDelay: 100 });
      await endDateInput.fill(endDateStr);
      await endDateInput.press('Enter');
      console.log('[UserGrowthBatchFragments] 已填入日期');
      await this.sleep(300);

      // ========== 第二个条件：文件名 ==========

      console.log('[UserGrowthBatchFragments] 点击添加条件（文件名）...');
      await this.safeElementClick('button:has-text("添加条件")', '添加条件按钮-文件名', { timeout: 10000, postDelay: 500 });

      console.log('[UserGrowthBatchFragments] 点击下拉菜单中的添加条件（第二个）...');
      try {
        await this.safeElementClick('.arco-dropdown-menu-item:has-text("添加条件")', '下拉添加条件-文件名', {
          timeout: 5000,
          postDelay: 500
        });
        console.log('[UserGrowthBatchFragments] 已点击下拉菜单中的添加条件（第二个）');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 未找到下拉菜单项:', e.message);
      }

      console.log('[UserGrowthBatchFragments] 选择文件名...');
      await this.safeElementClick('.arco-select-view:has(input[placeholder="选择筛选项"])', '筛选项下拉框-文件名', {
        timeout: 10000,
        postDelay: 500
      });
      await this.safeElementClick('li.arco-select-option:has-text("文件名")', '文件名选项', {
        timeout: 10000,
        postDelay: 500
      });
      console.log('[UserGrowthBatchFragments] 已选择文件名');

      console.log('[UserGrowthBatchFragments] 选择包含...');
      await this.safeElementClick('.arco-select-view:has(input[placeholder="选择操作"])', '操作下拉框-文件名', {
        timeout: 10000,
        postDelay: 500
      });
      await this.safeElementClick('li.arco-select-option:has-text("包含")', '包含选项', {
        timeout: 10000,
        postDelay: 500
      });
      console.log('[UserGrowthBatchFragments] 已选择包含');

      console.log(`[UserGrowthBatchFragments] 输入关键词: ${dramaName}`);
      await this.sleep(500);
      try {
        const textInput = await this.page.waitForSelector('input[placeholder="请输入"]', { timeout: 5000 });
        if (!textInput) {
          throw new Error('未找到关键词输入框');
        }
        await this.safeElementClick(textInput, '关键词输入框', { timeout: 5000, postDelay: 100 });
        await textInput.fill(dramaName);
        console.log(`[UserGrowthBatchFragments] 已输入关键词: ${dramaName}`);
        await this.sleep(500);
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 输入关键词失败:', e.message);
      }

      console.log('[UserGrowthBatchFragments] 点击确定...');
      await this.safeElementClick('button:has-text("确定")', '筛选器确定按钮', { timeout: 10000, postDelay: 1000 });
      console.log('[UserGrowthBatchFragments] 筛选器设置完成');
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

      console.log('[UserGrowthBatchFragments] 点击排序器下拉框...');
      await this.safeElementClick('.horizontal-sort-select .arco-select', '排序器按钮', {
        timeout: 10000,
        postDelay: 1000
      });
      console.log('[UserGrowthBatchFragments] 排序器按钮已点击');

      console.log('[UserGrowthBatchFragments] 等待下拉面板...');
      const popup = await this.page.waitForSelector('.arco-select-popup-inner.sort-select-dropdown', { timeout: 5000 });
      if (!popup) {
        throw new Error('未找到下拉面板');
      }
      await this.sleep(500);

      console.log('[UserGrowthBatchFragments] 选择维度: 消耗');
      try {
        await this.safeElementClick('.arco-select-popup-inner .value-content:first-child button:has-text("消耗")', '排序维度-消耗', {
          timeout: 5000,
          postDelay: 500
        });
        console.log('[UserGrowthBatchFragments] 已点击消耗');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 点击消耗失败，继续执行...');
      }

      console.log('[UserGrowthBatchFragments] 选择时间范围: 近3天');
      try {
        await this.sleep(500);
        const dropdown = await this.page.waitForSelector('.arco-select-popup-inner.sort-select-dropdown', { timeout: 5000 });
        if (dropdown) {
          const valueContents = await dropdown.$$('div.value-content');
          if (valueContents.length >= 2) {
            const timeGroup = valueContents[1];
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
              await this.safeElementClick(targetBtn, '排序时间范围-近3天', {
                timeout: 5000,
                postDelay: 1000
              });
            } else {
              console.log('[UserGrowthBatchFragments] 未找到时间选项近3天');
            }
          }
        }
      } catch (e) {
        console.log(`[UserGrowthBatchFragments] 点击近3天失败: ${e.message}`);
      }

      console.log('[UserGrowthBatchFragments] 选择排序方向: 降序');
      try {
        await this.safeElementClick('.arco-select-popup-inner .value-content:nth-child(5) button:has-text("降序")', '排序方向-降序', {
          timeout: 5000,
          postDelay: 1000
        });
        console.log('[UserGrowthBatchFragments] 已点击降序');
      } catch (e) {
        console.log('[UserGrowthBatchFragments] 点击降序失败，继续执行...');
      }

      console.log('[UserGrowthBatchFragments] 按 ESC 退出排序器...');
      await this.page.keyboard.press('Escape');
      await this.sleep(500);
      await this.waitForBlockingOverlayToDisappear(30000, 'close sorter');
      await this.sleep(1500);

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
      await this.waitForBlockingOverlayToDisappear(30000, 'select materials');

      const checkIcons = await this.page.$$('.waterfall-item .check-icon');
      console.log(`[UserGrowthBatchFragments] 找到 ${checkIcons.length} 个素材`);

      const selectCount = Math.min(count, checkIcons.length);

      for (let i = 0; i < selectCount; i++) {
        try {
          await this.safeElementClick(checkIcons[i], `素材勾选-${i + 1}`, { timeout: 5000, postDelay: 200 });
          console.log(`[UserGrowthBatchFragments] 已选择第 ${i + 1} 个素材`);
        } catch (error) {
          console.error(`[UserGrowthBatchFragments] 选择第 ${i + 1} 个素材失败:`, error);
        }
      }

      console.log(`[UserGrowthBatchFragments] 成功选择 ${selectCount} 个素材`);

      console.log('[UserGrowthBatchFragments] 滚动到页面顶部...');
      await this.page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await this.sleep(2000);
      await this.waitForBlockingOverlayToDisappear(30000, 'scroll to top after selection');

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
      const dramaDir = path.join(outputPath, this.sanitizePathName(dramaName));

      // 确保输出目录存在
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
        console.log(`[UserGrowthBatchFragments] 创建输出目录: ${outputPath}`);
      }
      if (!fs.existsSync(dramaDir)) {
        fs.mkdirSync(dramaDir, { recursive: true });
        console.log(`[UserGrowthBatchFragments] 创建剧目目录: ${dramaDir}`);
      }

      console.log('[UserGrowthBatchFragments] 点击下载按钮...');
      await this.safeElementClick('button:has(svg.ug_menu-icon-magoai_download)', '下载按钮', {
        timeout: 10000,
        postDelay: 1000
      });
      console.log('[UserGrowthBatchFragments] 下载按钮已点击');

      console.log('[UserGrowthBatchFragments] 点击原始下载...');
      const originalDownloadMenuItem = await this.page.waitForSelector(
        '.arco-dropdown-menu .arco-dropdown-menu-item:has-text("原始下载")',
        { timeout: 8000 }
      );
      if (!originalDownloadMenuItem) {
        throw new Error('未找到原始下载选项');
      }

      console.log('[UserGrowthBatchFragments] 找到原始下载菜单项，准备触发下载...');
      const directDownloadPromise = this.waitForDownloadEvent(8000);
      await this.safeElementClick(originalDownloadMenuItem, '原始下载菜单项', {
        timeout: 8000,
        postDelay: 500
      });
      console.log('[UserGrowthBatchFragments] 已点击原始下载，开始判断下载链路...');

      const directDownload = await directDownloadPromise;
      if (directDownload) {
        console.log('[UserGrowthBatchFragments] 检测到传统浏览器直接下载链路');
        return await this.persistPlaywrightDownload(directDownload, dramaName, dramaDir);
      }

      const taskModalResult = await this.handleTaskCreationSuccessModal(12000);
      if (taskModalResult.action === 'detail' || taskModalResult.action === 'task-list') {
        console.log(`[UserGrowthBatchFragments] 已处理任务创建成功弹窗，动作: ${taskModalResult.action}`);
        return await this.waitForTaskDetailDownload(dramaName, dramaDir);
      }
      if (taskModalResult.handled) {
        console.log(`[UserGrowthBatchFragments] 已处理任务创建成功弹窗，动作: ${taskModalResult.action}`);
      }

      const delayedDownload = await this.waitForDownloadEvent(15000);
      if (delayedDownload) {
        console.log('[UserGrowthBatchFragments] 检测到延迟触发的浏览器下载链路');
        return await this.persistPlaywrightDownload(delayedDownload, dramaName, dramaDir);
      }

      throw new Error('点击原始下载后，既未出现浏览器下载，也未出现任务详情弹窗');
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
      results.results = results.results || {};
      results.succDramas = results.succDramas || [];
      results.failedDramas = results.failedDramas || [];
      results.originalCounts = results.originalCounts || {};
      results.errors = results.errors || {};

      for (const dramaName of dramaNames) {
        if (!results.succDramas.includes(dramaName) && !results.failedDramas.includes(dramaName)) {
          results.failedDramas.push(dramaName);
          results.errors[dramaName] = '短剧原片未成功下载';
        }
      }

      return results;
    } catch (error) {
      console.error(`[UserGrowthBatchFragments] 墨攻平台批量处理失败:`, error);
      return {
        results: {},
        succDramas: [],
        failedDramas: dramaNames,
        originalCounts: {},
        errors: Object.fromEntries(dramaNames.map((name) => [name, error.message || String(error)]))
      };
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
