// 平台后端调用与结果规范化：只负责调用 triggerEvent 并返回标准结构

import { triggerEvent } from './ipc.js';

const parseJsonSafely = (val) => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    console.warn('[platformExecutors:parse-error]', e);
    return val;
  }
};

// 淘宝关键词统一搜索执行方法
export const executeKeyWordTaoBaoSearch = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: 'taobao', type: 'keyword', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  console.log('[platformExecutors:taobao:data]', data);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 规范化淘宝结果为通用 mediaData 结构（仅图片）
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0;
  list.forEach((item, idx) => {
    const rank = item.rank ?? idx + 1;
    const baseId = item.link || item.title || `taobao-${idx + 1}`;
    const urls = Array.isArray(item?.img_urls) && item.img_urls.length > 0 ? item.img_urls : item?.cover_url ? [item.cover_url] : [];
    total += urls.length;
    urls.forEach((url, urlIdx) => {
      mediaData.push({
        id: `${baseId}-image-${urlIdx}`,
        type: 'image',
        url,
        coverUrl: '', // 仅视频需要封面，淘宝只产图片
        title: item.title || `商品-${idx + 1}`,
        name: item.title ? `${item.title}-${urlIdx + 1}` : `商品-${idx + 1}-${urlIdx + 1}`,
        link: item.link || '',
        source: item.source || '淘宝',
        rank
      });
    });
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};

// 淘宝图片 / SKU 统一搜索执行方法（共用 image-search 接口）
export const executeImageTaoBaoSearch = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: 'taobao', type: 'image', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 规范化淘宝结果为通用 mediaData 结构（仅图片）
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0;
  list.forEach((item, idx) => {
    const rank = item.rank ?? idx + 1;
    const baseId = item.link || item.title || `taobao-${idx + 1}`;
    const urls = Array.isArray(item?.img_urls) && item.img_urls.length > 0 ? item.img_urls : item?.cover_url ? [item.cover_url] : [];
    total += urls.length;
    urls.forEach((url, urlIdx) => {
      mediaData.push({
        id: `${baseId}-image-${urlIdx}`,
        type: 'image',
        url,
        coverUrl: '', // 仅视频需要封面，淘宝只产图片
        title: item.title || `商品-${idx + 1}`,
        name: item.title ? `${item.title}-${urlIdx + 1}` : `商品-${idx + 1}-${urlIdx + 1}`,
        link: item.link || '',
        source: item.source || '淘宝',
        rank
      });
    });
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};

// 小红书平台统一搜索执行方法
export const executeKeyWordXhsSearch = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: 'xiaohongshu', type: 'keyword', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 规范化小红书结果为通用 mediaData 结构
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0;
  list.forEach((note, idx) => {
    const noteType = note.note_type || note.noteType || 'unknown';
    const isVideo = noteType === 'video' || (Array.isArray(note?.video_urls) && note.video_urls.length > 0);
    const rank = note.rank ?? idx + 1;
    const baseId = note.link || note.title || `xhs-${idx + 1}`;

    if (isVideo) {
      const videos = Array.isArray(note?.video_urls) ? note.video_urls : [];
      total += videos.length;
      const cover = note?.cover_url || (Array.isArray(note?.img_urls) && note.img_urls[0]) || '';
      videos.forEach((videoUrl, urlIdx) => {
        mediaData.push({
          id: `${baseId}-video-${urlIdx}`,
          type: 'video',
          url: videoUrl,
          coverUrl: cover,
          title: note.title || `笔记-${idx + 1}`,
          name: note.title ? `${note.title}-视频${urlIdx + 1}` : `笔记-${idx + 1}-视频${urlIdx + 1}`,
          link: note.link || '',
          source: note.source || '小红书',
          rank
        });
      });
    } else {
      const urls = Array.isArray(note?.img_urls) && note.img_urls.length > 0 ? note.img_urls : note?.cover_url ? [note.cover_url] : [];
      total += urls.length;
      urls.forEach((url, urlIdx) => {
        mediaData.push({
          id: `${baseId}-image-${urlIdx}`,
          type: 'image',
          url,
          coverUrl: url,
          title: note.title || `笔记-${idx + 1}`,
          name: note.title ? `${note.title}-${urlIdx + 1}` : `笔记-${idx + 1}-${urlIdx + 1}`,
          link: note.link || '',
          source: note.source || '小红书',
          rank
        });
      });
    }
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};

// 1688 图片 / SKU 统一搜索执行方法（共用 1688-image-search 接口）
export const executeImage1688Search = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: '1688', type: 'image/sku', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  console.log('[platformExecutors:1688:data]', data);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 1688 结果规范化为通用 mediaData 结构（仅图片）
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0;
  list.forEach((item, idx) => {
    const rank = item.rank ?? idx + 1;
    const baseId = item.offerId || item.url || item.title || `1688-${idx + 1}`;
    const urls = Array.isArray(item?.img_urls) && item.img_urls.length > 0 ? item.img_urls : [];
    total += urls.length;
    urls.forEach((url, urlIdx) => {
      mediaData.push({
        id: `${baseId}-image-${urlIdx}`,
        type: 'image',
        url,
        coverUrl: '', // 仅视频需要封面，1688只产图片
        title: item.title || `商品-${idx + 1}`,
        name: item.title ? `${item.title}-${urlIdx + 1}` : `商品-${idx + 1}-${urlIdx + 1}`,
        link: item.url || '',
        source: item.source || '1688',
        rank
      });
    });
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};

// 京东关键词统一搜索执行方法
export const executeKeyWordJDSearch = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: 'jd', type: 'keyword', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  console.log('[platformExecutors:jd:data]', data);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 京东结果规范化为通用 mediaData 结构（仅图片，丢弃视频）
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0; // 京东需要自己计算总数，统计所有img_urls

  list.forEach((item, idx) => {
    const rank = item.rank ?? idx + 1;
    const baseId = item.skuId || item.link || item.title || `jd-${idx + 1}`;
    const urls = Array.isArray(item?.img_urls) && item.img_urls.length > 0 ? item.img_urls : [];

    total += urls.length; // 每个商品的图片数量累加

    urls.forEach((url, urlIdx) => {
      mediaData.push({
        id: `${baseId}-image-${urlIdx}`,
        type: 'image',
        url,
        coverUrl: '', // 当前只消费图片，不需要封面
        title: item.title || `商品-${idx + 1}`,
        name: item.title ? `${item.title}-${urlIdx + 1}` : `商品-${idx + 1}-${urlIdx + 1}`,
        link: item.link || item.productLink || '',
        source: item.source || '京东',
        rank
      });
    });
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};

// 京东 SKU 统一搜索执行方法
export const executeSKUJDSearch = async (eventId, args, defaultErrorMsg) => {
  console.log('[platformExecutors:call]', { platform: 'jd', type: 'sku', eventId, args });
  const res = await triggerEvent(eventId, { args });
  console.log('[platformExecutors:res]', res);

  if (!res?.success) {
    const errorMsg = res?.error || res?.result?.message || '后端返回失败';
    return { success: false, error: errorMsg };
  }

  let data = parseJsonSafely(res.result);
  console.log('[platformExecutors:jd:data]', data);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      const errorMsg = data.message || data.error || defaultErrorMsg;
      return { success: false, error: errorMsg };
    }
    data = data.data || data;
  }

  // 京东结果规范化为通用 mediaData 结构（仅图片，丢弃视频）
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const mediaData = [];
  let total = 0; // 京东需要自己计算总数，统计所有img_urls

  list.forEach((item, idx) => {
    const rank = item.rank ?? idx + 1;
    const baseId = item.skuId || item.link || item.title || `jd-${idx + 1}`;
    const urls = Array.isArray(item?.img_urls) && item.img_urls.length > 0 ? item.img_urls : [];

    total += urls.length; // 每个商品的图片数量累加
    urls.forEach((url, urlIdx) => {
      mediaData.push({
        id: `${baseId}-image-${urlIdx}`,
        type: 'image',
        url,
        coverUrl: '', // 当前只消费图片，不需要封面
        title: item.title || `商品-${idx + 1}`,
        name: item.title ? `${item.title}-${urlIdx + 1}` : `商品-${idx + 1}-${urlIdx + 1}`,
        link: item.link || item.productLink || '',
        source: item.source || '京东',
        rank
      });
    });
  });

  return {
    success: true,
    data: {
      mediaData,
      total,
      raw: list
    }
  };
};
