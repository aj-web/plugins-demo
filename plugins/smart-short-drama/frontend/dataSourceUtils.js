/**
 * 千仓数据源工具
 * 提供千仓数据获取、缓存管理等功能
 */

import { loadQiancangCache, saveQiancangCache } from './qiancangCache.js';
import { triggerEvent, unwrapIpcResponse } from './ipc.js';

const QIANCANG_DISPLAY_LIMIT = 15;

/**
 * 获取所有已下载的剧名
 * @returns {Promise<Array<string>>} 已下载的剧名数组
 */
async function getAllDownloadedDramas() {
  try {
    const res = await triggerEvent('get-tasks', {});
    const biz = unwrapIpcResponse(res);
    const tasks = biz.tasks || [];

    // 提取所有已完成任务的剧名（不限制时间范围）
    const downloadedSet = new Set();
    tasks
      .filter((task) => task.status === '已完成' && task.module === '爆款扒产')
      .forEach((task) => {
        const dramas = task.dramas || [];
        dramas.forEach((name) => downloadedSet.add(name));
      });

    console.log('[getAllDownloadedDramas] 已下载剧目总数:', downloadedSet.size);
    return Array.from(downloadedSet);
  } catch (e) {
    console.error('[getAllDownloadedDramas] 获取失败:', e);
    return [];
  }
}

/**
 * 对比两个数组是否相同
 * @param {Array} arr1 - 数组1
 * @param {Array} arr2 - 数组2
 * @returns {boolean} 是否相同
 */
function arraysEqual(arr1, arr2) {
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  return JSON.stringify(arr1) === JSON.stringify(arr2);
}

/**
 * 获取千仓数据（带缓存）
 * 核心逻辑：
 * 1. 调用千仓API获取最新剧目列表
 * 2. 对比剧目列表是否与缓存一致
 * 3. 如果一致，直接返回缓存结果
 * 4. 如果不一致，重新组装数据并更新缓存
 *
 * @returns {Promise<Object>} 返回结果
 * @returns {boolean} result.success - 是否成功
 * @returns {boolean} result.useCache - 是否使用了缓存
 * @returns {Object} result.result - 组装好的 readinessItem 对象
 * @returns {string} result.error - 错误信息（如果失败）
 */
export async function fetchQiancangDataWithCache() {
  try {
    // 步骤1：调用千仓API
    const resp = await fetch('https://scriptv2.qfei.cn/api/client/short_film/hot', {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    const json = await resp.json();

    // 检查API返回状态
    if (json.code !== 0) {
      console.error('[Qiancang] API返回错误，code:', json.code);
      return { success: false, error: `API返回错误: ${json.message || 'Unknown'}` };
    }

    if (!Array.isArray(json.data?.list)) {
      console.error('[Qiancang] API返回数据格式错误:', json);
      return { success: false, error: 'API返回数据格式错误' };
    }

    const newDramas = json.data.list;
    console.log('[Qiancang] API返回剧目数:', newDramas.length);

    // 如果返回的剧目列表为空，返回未就绪状态
    if (newDramas.length === 0) {
      console.warn('[Qiancang] API返回的剧目列表为空');
      return {
        success: true,
        useCache: false,
        result: {
          id: 'qiancang',
          name: '千沧数据平台',
          status: 'not_ready',
          readyTime: '--:--',
          details: {
            groups: [
              {
                title: '平台接口与数据状态',
                items: [
                  { content: '数据API链接正常', status: 'ready' },
                  { content: '热门剧目列表为空', status: 'not_ready' }
                ]
              },
              {
                title: '待扒产剧目清单 (千仓提取)',
                items: []
              }
            ]
          }
        }
      };
    }

    // 步骤2：读取缓存
    const cache = loadQiancangCache();

    // 步骤3：对比剧名列表
    if (cache && cache.displayLimit === QIANCANG_DISPLAY_LIMIT && arraysEqual(newDramas, cache.rawDramas)) {
      console.log('[Qiancang] 剧目列表一致，使用缓存数据');
      return {
        success: true,
        useCache: true,
        result: cache.cachedResult
      };
    }

    // 步骤4：重新组装数据
    console.log('[Qiancang] 剧目列表变化，重新组装数据...');

    // 4.1 获取已下载剧目
    const downloadedDramas = await getAllDownloadedDramas();
    console.log('[Qiancang] 已下载剧目数:', downloadedDramas.length);

    // 4.2 去重
    const availableDramas = newDramas.filter((name) => !downloadedDramas.includes(name));
    console.log('[Qiancang] 去重后剧目数:', availableDramas.length);

    // 4.3 取前 15 个
    const topDramas = availableDramas.slice(0, QIANCANG_DISPLAY_LIMIT);
    console.log(`[Qiancang] 展示前${QIANCANG_DISPLAY_LIMIT}个:`, topDramas);

    // 4.4 组装完整结果
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const result = {
      id: 'qiancang',
      name: '千沧数据平台',
      status: 'ready',
      readyTime: timeStr,
      details: {
        groups: [
          {
            title: '平台接口与数据状态',
            items: [
              { content: '数据API链接正常', status: 'ready' },
              { content: '昨日跑量数据已同步', status: 'ready' }
            ]
          },
          {
            title: '待扒产剧目清单 (千仓提取)',
            items: topDramas.map((title) => ({ content: title, status: 'ready' }))
          }
        ]
      }
    };

    // 步骤5：保存缓存
    const newCache = {
      rawDramas: newDramas,
      cachedResult: result,
      displayLimit: QIANCANG_DISPLAY_LIMIT,
      timestamp: Date.now()
    };
    saveQiancangCache(newCache);

    return {
      success: true,
      useCache: false,
      result
    };
  } catch (error) {
    console.error('[Qiancang] 获取数据失败:', error);
    return { success: false, error: error.message };
  }
}
