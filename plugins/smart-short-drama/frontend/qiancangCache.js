/**
 * 千仓数据全局缓存管理
 * 使用 localStorage 持久化存储
 */

// 缓存键名
const CACHE_KEY = 'qiancang-cache';

/**
 * 从 localStorage 读取缓存
 * @returns {Object|null} 缓存对象或 null
 */
export function loadQiancangCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      return data;
    }
  } catch (e) {
    console.error('[QiancangCache] 读取缓存失败:', e);
  }
  return null;
}

/**
 * 保存缓存到 localStorage
 * @param {Object} cache - 缓存对象
 * @param {Array} cache.rawDramas - 原始剧名列表
 * @param {Object} cache.cachedResult - 缓存的组装结果
 * @param {number} cache.timestamp - 时间戳
 */
export function saveQiancangCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('[QiancangCache] 保存缓存成功:', {
      剧目数: cache.rawDramas?.length,
      时间戳: new Date(cache.timestamp).toLocaleString()
    });
  } catch (e) {
    console.error('[QiancangCache] 保存缓存失败:', e);
  }
}

/**
 * 清除缓存
 */
export function clearQiancangCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[QiancangCache] 缓存已清除');
  } catch (e) {
    console.error('[QiancangCache] 清除缓存失败:', e);
  }
}
