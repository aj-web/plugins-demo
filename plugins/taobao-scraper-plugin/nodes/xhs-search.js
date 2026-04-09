'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.XhsSearchNode = void 0;

const https = require('https');
const { URL } = require('url');
const playwright_1 = require('playwright');
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
const xhs_sign_1 = require('../utils/xhs-sign');

/**
 * 小红书关键词搜索节点
 *
 * 能力范围（第一阶段）
 * - 使用已登录的 cookies（由 XhsLoginNode 保存）
 * - 通过签名接口调用 `/api/sns/web/v1/search/notes`
 * - 对每条笔记调用 `/api/sns/web/v1/feed` 获取详情
 * - 根据 note_type 过滤结果（0=ALL, 1=VIDEO, 2=IMAGE）
 * - 返回包含图片/视频 URL 的简化结构，供前端展示
 */
class XhsSearchNode {
  constructor() {
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
    this.maxNotes = 20; // 单次最多处理的笔记数量，避免过多请求
  }

  /**
   * 入口方法（manifest: xhs-keyword-search -> startKeywordSearch）
   * @param {string} keyword 关键词
   * @param {number} noteType 0=ALL, 1=VIDEO, 2=IMAGE
   * @param {string} sort 排序方式: 'general' | 'popularity_descending' | 'time_descending'
   * @returns {Promise<string>} JSON 字符串
   */
  async startKeywordSearch(keyword, noteType = 0, sort = 'general') {
    if (!keyword || !keyword.trim()) {
      return { success: false, message: '关键词不能为空' };
    }

    // 简单登录校验：必须先有 xhs cookies
    if (!this.cookieManager.hasCookies('xhs')) {
      return {
        success: false,
        message: '小红书未登录，请先在插件中完成小红书登录'
      };
    }

    const trimmedKeyword = keyword.trim();
    const normalizedNoteType = Number.isInteger(noteType) ? noteType : 0;
    const sortOptions = ['general', 'popularity_descending', 'time_descending'];
    const normalizedSort = typeof sort === 'string' && sortOptions.includes(sort) ? sort : 'general';

    let browser = null;
    let context = null;
    let page = null;

    try {
      // 1. 启动浏览器，仅用于签名（window.mnsv2）
      const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      browser = await playwright_1.chromium.launch({
        headless: true,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      page = await context.newPage();

      // 注入登录 cookies
      const cookies = this.cookieManager.getCookies('xhs');
      if (cookies && cookies.length > 0) {
        await context.addCookies(cookies);
      }

      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 2. 构造基础 headers 与 cookie 字符串
      const { cookieStr, cookieDict } = await this.buildCookieInfo(context);

      const baseHeaders = {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json;charset=UTF-8',
        origin: 'https://www.xiaohongshu.com',
        pragma: 'no-cache',
        priority: 'u=1, i',
        referer: 'https://www.xiaohongshu.com/',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        Cookie: cookieStr
      };

      const host = 'https://edith.xiaohongshu.com';

      // 3. 搜索笔记列表
      const searchUri = '/api/sns/web/v1/search/notes';
      const searchData = {
        keyword: trimmedKeyword,
        page: 1,
        page_size: 20,
        search_id: (0, xhs_sign_1.getSearchId)(),
        sort: normalizedSort,
        note_type: normalizedNoteType // 0=ALL,1=VIDEO,2=IMAGE
      };

      const searchSignHeaders = await (0, xhs_sign_1.preHeadersWithPlaywright)(page, host + searchUri, cookieDict, null, searchData);

      const searchHeaders = Object.assign({}, baseHeaders, searchSignHeaders);

      const searchJson = await this.httpPostJson(host + searchUri, searchData, searchHeaders);

      if (!searchJson || !searchJson.success || !searchJson.data) {
        const msg = (searchJson && (searchJson.msg || searchJson.message)) || '搜索失败或返回数据为空';
        return { success: false, message: msg };
      }

      const items = Array.isArray(searchJson.data.items) ? searchJson.data.items : [];

      if (items.length === 0) {
        return {
          success: true,
          data: [],
          total: 0,
          timestamp: new Date().toISOString()
        };
      }

      // 过滤掉非笔记类型项，例如搜索建议
      const noteItems = items.filter((item) => item && item.id && item.model_type && item.model_type !== 'rec_query' && item.model_type !== 'hot_query');

      // 限制最大笔记数，避免请求过多详情
      const limitedItems = noteItems.slice(0, this.maxNotes);

      // 4. 拉取每条笔记详情
      const detailResults = [];
      for (const item of limitedItems) {
        const noteId = item.id;
        const xsecSource = item.xsec_source || 'pc_search';
        const xsecToken = item.xsec_token || '';

        try {
          const detail = await this.fetchNoteDetail(page, host, baseHeaders, cookieDict, noteId, xsecSource, xsecToken);
          if (detail) {
            detailResults.push(detail);
          }
          // 简单限频，避免过快
          await this.sleep(500 + Math.random() * 500);
        } catch (e) {
          console.error('[XhsSearchNode] 获取笔记详情失败:', noteId, e instanceof Error ? e.message : String(e));
        }
      }

      // 5. 从详情中提取媒体 URL，并按 note_type 过滤
      const transformed = this.transformNoteDetails(detailResults, normalizedNoteType);

      return {
        success: true,
        data: transformed,
        total: transformed.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[XhsSearchNode] 关键词搜索流程出错:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '关键词搜索失败',
        timestamp: new Date().toISOString()
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (context) {
        try {
          await context.close();
        } catch {}
      }
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  /**
   * 从浏览器上下文构造 Cookie 头与字典
   */
  async buildCookieInfo(context) {
    const cookies = await context.cookies();
    const parts = [];
    const dict = {};

    for (const c of cookies) {
      if (!c || !c.name) continue;
      dict[c.name] = c.value;
      parts.push(`${c.name}=${c.value}`);
    }

    return {
      cookieStr: parts.join('; '),
      cookieDict: dict
    };
  }

  /**
   * 使用 https 发送 POST 请求并解析 JSON
   */
  async httpPostJson(url, data, headers) {
    const body = JSON.stringify(data);
    const u = new URL(url);

    const options = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      headers: Object.assign({}, headers, {
        'Content-Length': Buffer.byteLength(body)
      })
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          try {
            const json = JSON.parse(text);
            resolve(json);
          } catch (e) {
            console.error('[XhsSearchNode] 解析 JSON 失败:', text);
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * 获取单条笔记详情（/api/sns/web/v1/feed）
   */
  async fetchNoteDetail(page, host, baseHeaders, cookieDict, noteId, xsecSource, xsecToken) {
    const uri = '/api/sns/web/v1/feed';
    const data = {
      source_note_id: noteId,
      image_formats: ['jpg', 'webp', 'avif'],
      extra: { need_body_topic: 1 },
      xsec_source: xsecSource || 'pc_search',
      xsec_token: xsecToken || ''
    };

    const signHeaders = await (0, xhs_sign_1.preHeadersWithPlaywright)(page, host + uri, cookieDict, null, data);

    const headers = Object.assign({}, baseHeaders, signHeaders);

    const json = await this.httpPostJson(host + uri, data, headers);

    if (!json || !json.success || !json.data || !Array.isArray(json.data.items)) {
      console.warn('[XhsSearchNode] 笔记详情返回结构异常:', json);
      return null;
    }

    const first = json.data.items[0];
    if (!first || !first.note_card) return null;

    const noteCard = first.note_card;
    noteCard.note_id = noteCard.note_id || noteId;
    noteCard.xsec_token = xsecToken || noteCard.xsec_token || '';
    noteCard.xsec_source = xsecSource || noteCard.xsec_source || 'pc_search';

    return noteCard;
  }

  /**
   * 根据 note_type 提取媒体 URL，并转换成插件前端可用的结构
   */
  transformNoteDetails(details, noteType) {
    const result = [];

    for (const note of details) {
      if (!note) continue;

      const title = note.title || note.desc || '';
      const noteId = note.note_id || note.id;
      const isVideo = note.type === 'video' || !!note.video;

      // 构造网页版链接
      const link = noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : '';

      const imageUrls = [];
      const videoInfo = this.extractVideoInfo(note);
      const videoUrls = videoInfo.videoUrls || [];

      // 图片列表
      if (Array.isArray(note.image_list)) {
        for (const img of note.image_list) {
          const url = img.url_default || img.url || img.original_url || img.trace_id || '';
          if (url) {
            imageUrls.push(url);
          }
        }
      }

      if (videoInfo.coverImageUrl) {
        const coverIdx = imageUrls.indexOf(videoInfo.coverImageUrl);
        if (coverIdx !== -1) {
          imageUrls.splice(coverIdx, 1);
        }
      }

      // 按 note_type 过滤
      if (noteType === 1 && videoUrls.length === 0) {
        // 只要视频，但没有视频URL
        continue;
      }
      if (noteType === 2 && imageUrls.length === 0) {
        // 只要图片，但没有图片URL
        continue;
      }

      // ALL 模式下若没有任何媒体，跳过
      if (noteType === 0 && imageUrls.length === 0 && videoUrls.length === 0) {
        continue;
      }

      const coverUrl = videoInfo.coverUrl || imageUrls[0] || '';

      result.push({
        rank: result.length + 1,
        title: title || `笔记${result.length + 1}`,
        link,
        source: '小红书',
        img_urls: imageUrls,
        video_urls: videoUrls,
        cover_url: coverUrl,
        note_type: note.type || (videoUrls.length > 0 ? 'video' : 'image')
      });
    }

    return result;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

XhsSearchNode.prototype.extractVideoInfo = function extractVideoInfo(note) {
  const info = {
    videoUrls: [],
    coverUrl: '',
    coverImageUrl: ''
  };

  if (!note || note.type !== 'video' || !note.video) {
    return info;
  }

  const video = note.video;
  const imageList = Array.isArray(note.image_list) ? note.image_list : [];
  if (imageList.length > 0) {
    const cover = imageList[0].url_default || imageList[0].url || imageList[0].image_url || imageList[0].trace_id || '';
    info.coverUrl = cover;
    info.coverImageUrl = cover;
  } else if (video.cover_url) {
    info.coverUrl = video.cover_url;
  }

  const consumer = video.consumer || {};
  let originKey = consumer.origin_video_key || consumer.originVideoKey || '';
  if (originKey) {
    originKey = originKey.replace(/^https?:\/\//, '');
    info.videoUrls = [`http://sns-video-bd.xhscdn.com/${originKey}`];
    return info;
  }

  const candidateUrls = [];
  const streamPaths = ['h264', 'h265', 'hevc', 'avc', 'av1'];
  if (video.media && video.media.stream) {
    for (const path of streamPaths) {
      const streams = video.media.stream[path];
      if (Array.isArray(streams)) {
        for (const stream of streams) {
          if (!stream) continue;
          const mainUrl = stream.master_url || stream.origin_url || stream.url || stream.backup_url_1 || '';
          if (mainUrl) {
            candidateUrls.push(mainUrl);
          }
          if (stream.backup_url_1) {
            candidateUrls.push(stream.backup_url_1);
          }
          if (stream.backup_url_2) {
            candidateUrls.push(stream.backup_url_2);
          }
        }
      }
    }
  }

  if (Array.isArray(video.url_list) && video.url_list.length > 0) {
    candidateUrls.push(...video.url_list);
  }

  if (video.url) {
    candidateUrls.push(video.url);
  }

  if (video.media && video.media.url) {
    candidateUrls.push(video.media.url);
  }

  const uniqueCandidates = Array.from(new Set(candidateUrls.filter(Boolean)));
  if (uniqueCandidates.length === 0) {
    console.warn('[XhsSearchNode] 未能为视频提取可用URL:', note.note_id);
    return info;
  }

  const scored = uniqueCandidates.map((url) => ({ url, score: extractQualityScore(url) })).sort((a, b) => b.score - a.score);

  info.videoUrls = [scored[0].url];
  return info;
};

function extractQualityScore(url) {
  const match = url.match(/_(\d+)\.(mp4|m3u8)/i);
  if (match) {
    return parseInt(match[1], 10) || 0;
  }
  if (/master/i.test(url)) {
    return 1000;
  }
  return 0;
}
exports.XhsSearchNode = XhsSearchNode;
