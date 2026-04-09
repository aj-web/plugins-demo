'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.JdSearchNode = void 0;
const playwright_1 = require('playwright');
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
const logger = require('../utils/logger');
class JdSearchNode {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
  }
  async extractSearchResults(targetNum = 10) {
    if (!this.page) {
      throw new Error('浏览器尚未初始化');
    }
    try {
      logger.info('[JD][Keyword] 开始滚动页面以加载商品卡片...', { targetNum });
      // 先滚动到页面顶部
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.page.waitForTimeout(1000);
      // 固定滚动逻辑：逐步滚动到页面最下方
      let previousScrollY = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 10; // 防止无限滚动
      while (scrollAttempts < maxScrollAttempts) {
        const currentScrollY = await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
          return window.scrollY;
        });
        const randomDelay = Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms
        await this.page.waitForTimeout(randomDelay);
        // 检查是否已经滚动到底部
        const isAtBottom = await this.page.evaluate(() => {
          return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
        });
        if (isAtBottom || currentScrollY === previousScrollY) {
          logger.info('[JD][Keyword] 已滚动到页面底部', {
            scrollAttempts,
            currentScrollY,
            isAtBottom
          });
          break;
        }
        previousScrollY = currentScrollY;
        scrollAttempts++;
      }
      // 滚动到底部后，再滚动回页面顶部
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      const randomDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3秒随机延时
      await this.page.waitForTimeout(randomDelay);
      // 统计最终发现的商品数量
      const finalCount = await this.page.evaluate(() => {
        return document.querySelectorAll('div.plugin_goodsCardWrapper[data-sku]').length;
      });
      logger.info('[JD][Keyword] 滚动完成，已发现商品卡片数量', { finalCount });
      const products = await this.page.evaluate((maxNum) => {
        const cards = Array.from(document.querySelectorAll('div.plugin_goodsCardWrapper[data-sku]'));
        const results = [];
        for (let i = 0; i < cards.length && results.length < maxNum; i++) {
          const card = cards[i];
          const sku = card.getAttribute('data-sku') || '';
          if (!sku) continue;
          let titleEl =
            card.querySelector('._goods_title_container_1g56m_1 ._text_1g56m_31') || card.querySelector('[class*="_goods_title_container"] [class*="_text_"]') || card.querySelector('span[title]');
          let title = '';
          if (titleEl) {
            title = (titleEl.textContent || titleEl.innerText || '').trim();
          }
          title = title
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const productUrl = `https://item.jd.com/${sku}.html`;
          results.push({
            index: results.length + 1,
            skuId: sku,
            title: title || `京东商品${results.length + 1}`,
            url: productUrl
          });
        }
        return results;
      }, targetNum);
      logger.info('[JD][Keyword] 解析完成，获得搜索结果', {
        targetNum,
        productsCount: products.length
      });
      return products;
    } catch (error) {
      logger.error('[JD][Keyword] 解析搜索结果页面失败', {
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }
  async startKeywordSearch(keyword) {
    if (!keyword || !keyword.trim()) {
      return JSON.stringify({ success: false, message: '关键词不能为空' });
    }
    const trimmedKeyword = keyword.trim();
    logger.info('=== [JD][Keyword] 开始关键词搜索流程 ===', { keyword: trimmedKeyword });
    try {
      await this.ensureBrowser();
      if (!this.page) {
        throw new Error('浏览器页面初始化失败');
      }
      logger.info('[JD][Keyword] 跳转京东首页');
      await this.page.goto('https://www.jd.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
      logger.info('[JD][Keyword] 页面加载完成，等待额外时间确保资源就绪', { waitMs: 10 * 1000 });
      await this.page.waitForTimeout(10 * 1000);
      logger.info('[JD][Keyword] 输入关键词并点击搜索按钮');
      const searchInput = await this.page.waitForSelector('#key', { timeout: 10000 });
      if (!searchInput) {
        throw new Error('未找到搜索输入框 #key');
      }
      await searchInput.fill('');
      await searchInput.type(trimmedKeyword, { delay: 80 });
      const searchButton = await this.page.waitForSelector('button.button[aria-label="搜索"], button.button', { timeout: 5000 });
      if (!searchButton) {
        throw new Error('未找到搜索按钮');
      }
      const waitForNewPage = this.context?.waitForEvent('page').catch(() => null);
      await Promise.all([waitForNewPage, searchButton.click()]);
      let resultPage = await waitForNewPage;
      if (resultPage) {
        await resultPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => null);
        logger.info('[JD][Keyword] 检测到新搜索结果页面', { url: resultPage.url() });
        this.page = resultPage;
      } else {
        await this.page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => null);
        logger.info('[JD][Keyword] 搜索结果在当前页面展示', { url: this.page.url() });
      }
      logger.info('[JD][Keyword] 搜索完成，开始解析结果页');
      const targetNum = 3;
      //超过10个触发风控，滑动验证码验证
      const searchResults = await this.extractSearchResults(targetNum);
      if (!searchResults.length) {
        logger.warn('[JD][Keyword] 未在结果页找到任何商品卡片');
        return JSON.stringify({
          success: false,
          message: '关键词搜索完成，但未找到任何商品结果'
        });
      }
      const urlMap = {};
      searchResults.forEach((item, index) => {
        const key = `${index + 1}-${item.title || `京东商品${index + 1}`}`;
        urlMap[key] = item.url;
      });
      logger.info('[JD][Keyword] 解析到商品列表，开始逐个进入详情页复用 SKU 逻辑', {
        productsCount: searchResults.length
      });
      const results = [];
      for (let i = 0; i < searchResults.length; i++) {
        const item = searchResults[i];
        const skuId = item.skuId || item.sku || '';
        if (!skuId) {
          logger.warn('[JD][Keyword] 搜索结果缺少 SKU，跳过', { index: i + 1, title: item.title });
          continue;
        }
        try {
          const productResult = await this.processSku(skuId, i);
          if (productResult) {
            results.push({
              ...productResult,
              title: item.title || productResult.title,
              productTitle: item.title || productResult.productTitle
            });
          }
        } catch (error) {
          logger.error('[JD][Keyword] 处理搜索结果 SKU 失败', {
            skuId,
            index: i + 1,
            error: error.message,
            stack: error.stack
          });
          results.push({
            rank: i + 1,
            title: item.title || `SKU ${skuId}`,
            productTitle: item.title || `SKU ${skuId}`,
            skuId,
            link: item.url,
            productLink: item.url,
            img_urls: [],
            video_urls: [],
            source: 'jd',
            error: error?.message || '处理失败'
          });
        }
        if (i < searchResults.length - 1) {
          const delay = this.getRandomDelay(30000, 40000);
          logger.info('[JD][Keyword] 等待后继续处理下一个搜索结果', {
            currentIndex: i + 1,
            total: searchResults.length,
            delay
          });
          await this.page.waitForTimeout(delay);
        }
      }
      logger.info('[JD][Keyword] 结果页解析完成，所有 URL 处理结束，准备返回结果', {
        totalResults: results.length
      });
      return JSON.stringify({
        success: true,
        message: '关键词搜索及结果页解析完成',
        data: results,
        total: results.length,
        urlMap,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[JD][Keyword] 搜索流程失败', {
        keyword: trimmedKeyword,
        error: error.message,
        stack: error.stack
      });
      return JSON.stringify({
        success: false,
        message: error?.message || '京东关键词搜索失败'
      });
    } finally {
      await this.closeBrowser();
    }
  }
  async startSkuSearch(rawSkuIds) {
    if (!rawSkuIds || typeof rawSkuIds !== 'string' || !rawSkuIds.trim()) {
      return JSON.stringify({ success: false, message: '请输入有效的SKU ID' });
    }
    const skuList = this.parseSkuIds(rawSkuIds);
    if (skuList.length === 0) {
      return JSON.stringify({ success: false, message: 'SKU ID必须是纯数字，请检查输入' });
    }
    logger.info('=== [JD][SKU] 开始 SKU 搜索流程 ===', { rawSkuIds, skuCount: skuList.length });
    try {
      await this.ensureBrowser();
      const results = [];
      for (let i = 0; i < skuList.length; i++) {
        const skuId = skuList[i];
        try {
          const productResult = await this.processSku(skuId, i);
          if (productResult) {
            results.push(productResult);
          }
        } catch (error) {
          logger.error('[JD][SKU] 处理单个 SKU 失败', {
            skuId,
            index: i + 1,
            error: error.message,
            stack: error.stack
          });
          results.push({
            rank: i + 1,
            title: `SKU ${skuId}`,
            productTitle: `SKU ${skuId}`,
            skuId,
            link: `https://item.jd.com/${skuId}.html`,
            productLink: `https://item.jd.com/${skuId}.html`,
            img_urls: [],
            video_urls: [],
            source: 'jd',
            error: error?.message || '处理失败'
          });
        }
      }
      if (results.length === 0) {
        logger.warn('[JD][SKU] 搜索完成，但未获取到任何商品信息');
        return JSON.stringify({ success: false, message: '未获取到任何商品信息' });
      }
      logger.info('[JD][SKU] 搜索完成，准备返回结果', { total: results.length });
      return JSON.stringify({
        success: true,
        data: results,
        total: results.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[JD][SKU] 搜索失败', {
        error: error.message,
        stack: error.stack
      });
      return JSON.stringify({ success: false, message: error?.message || '京东SKU搜索失败' });
    } finally {
      await this.closeBrowser();
    }
  }
  async ensureBrowser() {
    if (this.browser) {
      return;
    }
    const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    this.browser = await playwright_1.chromium.launch({
      headless: false,
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled']
    });
    this.context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: true,
      locale: 'zh-CN'
    });
    this.page = await this.context.newPage();
    const cookies = this.cookieManager.getCookies('jd');
    if (!cookies || cookies.length === 0) {
      throw new Error('未找到京东登录信息，请先登录京东');
    }
    await this.context.addCookies(cookies);
  }
  async processSku(skuId, index) {
    if (!this.page) {
      throw new Error('浏览器尚未初始化');
    }
    const imageSet = new Set();
    const videoSet = new Set();
    const requestHandler = (request) => {
      const url = request.url();
      if (this.isProductImage(url)) {
        imageSet.add(url);
        return;
      }
      if (url.endsWith('.mp4')) {
        videoSet.add(url);
      }
    };
    this.page.on('request', requestHandler);
    try {
      const productUrl = `https://item.jd.com/${skuId}.html`;
      logger.info('[JD][SKU] 打开商品详情页', { skuId, productUrl, index: index + 1 });
      await this.page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
      await this.page.waitForTimeout(2000);
      if (!(await this.checkLoginStatus())) {
        throw new Error('京东登录状态已过期，请重新登录');
      }
      await this.extractImagesFromDom(imageSet);
      const productInfo = await this.extractProductInfo(skuId);
      const images = Array.from(imageSet);
      const videos = Array.from(videoSet);
      logger.info('[JD][SKU] 收集到商品媒体信息', {
        skuId,
        imagesCount: images.length,
        videosCount: videos.length
      });
      return {
        rank: index + 1,
        title: productInfo.title || `京东商品${index + 1}`,
        productTitle: productInfo.title || `京东商品${index + 1}`,
        productShortName: productInfo.productShortName || '',
        skuId,
        link: productUrl,
        productLink: productUrl,
        source: 'jd',
        img_urls: images,
        video_urls: videos
      };
    } finally {
      this.page.off('request', requestHandler);
    }
  }
  async extractImagesFromDom(imageSet) {
    if (!this.page) return;
    try {
      const baseUrl = this.resolveBaseImageHost(imageSet) || 'https://img10.360buyimg.com';
      const dataUrls = await this.page.evaluate(() => {
        // 优先从缩略图 li 里读取 data-url
        let urls = Array.from(document.querySelectorAll('div.spec-items li'))
          .map((el) => {
          const img = el.querySelector('img');
            return img ? img.getAttribute('data-url') : null;
          })
          .filter((u) => !!u);

        // 兜底从 img[data-url] 中获取
        if (!urls.length) {
          urls = Array.from(document.querySelectorAll('img[data-url]'))
            .map((img) => img.getAttribute('data-url'))
            .filter((u) => !!u);
            }
        return urls;
      });

      dataUrls.forEach((raw) => {
          const normalized = this.normalizeImagePath(raw, baseUrl);
          if (normalized && this.isProductImage(normalized)) {
            imageSet.add(normalized);
          }
      });
      logger.debug('[JD][SKU] 从 DOM 中解析缩略图完成', {
        imageSetSize: imageSet.size,
        baseUrl
      });
    } catch (error) {
      logger.warn('[JD][SKU] 解析缩略图失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  async extractProductInfo(skuId) {
    const info = {
      skuId,
      title: '',
      productShortName: ''
    };
    if (!this.page) {
      return info;
    }
    try {
      const titleLocator = this.page.locator('div.sku-name').first();
      if (await titleLocator.count()) {
        info.title = (await titleLocator.innerText())?.trim() || '';
      }
    } catch (error) {
      logger.warn('[JD][SKU] 获取标题失败', {
        skuId,
        error: error.message
      });
    }
    try {
      const shortLocator = this.page.locator('div.item.ellipsis').first();
      if (await shortLocator.count()) {
        info.productShortName = (await shortLocator.getAttribute('title'))?.trim() || (await shortLocator.innerText())?.trim() || '';
      }
    } catch (error) {
      logger.warn('[JD][SKU] 获取简称失败', {
        skuId,
        error: error.message
      });
    }
    return info;
  }
  async checkLoginStatus() {
    if (!this.page) {
      return false;
    }
    try {
      const currentUrl = this.page.url();
      if (currentUrl.toLowerCase().includes('login')) {
        logger.warn('[JD][Login] 当前页面为登录页，判定为未登录', { currentUrl });
        return false;
      }
      const username = await this.page
        .evaluate(() => {
          const selectors = [
            '.userv4_container .welcome a',
            '.userv4_container .welcome',
            '.login_info .userv4_show .welcome a',
            '#ttbar-login .nickname',
            '.nickname',
            '.jd-toolbar .user-name',
            '#ttbarMyJD .ttbar-myjd'
          ];
          const normalize = (text) => text?.replace(/\s+/g, ' ').trim();
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (!el) {
              continue;
            }
            const textContent = normalize(el.textContent || el.innerText || '');
            // 排除登录相关文本和默认问候语（如：Hi~上午好、Hi~中午好、Hi~下午好、Hi~晚上好等）
            if (
              textContent &&
              !/登录|请登录|sign\s*in/i.test(textContent) &&
              !/^Hi~?(上午|中午|下午|晚上|早上|凌晨)好?$/i.test(textContent) &&
              !/^Hi~?.*好$/i.test(textContent) &&
              textContent.length > 3
            ) {
              return textContent;
            }
          }
          return null;
        })
        .catch(() => null);
      if (username) {
        logger.info('[JD][Login] 检测到已登录用户名', { username });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[JD][Login] 检查登录状态出错', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  resolveBaseImageHost(imageSet) {
    for (const url of imageSet) {
      if (url.includes('/n1/jfs/')) {
        return url.split('/n1/jfs/')[0];
      }
    }
    return null;
  }
  normalizeImagePath(raw, baseUrl) {
    if (!raw) {
      return null;
    }
    let dataUrl = raw.trim();
    if (dataUrl.startsWith('//')) {
      return `https:${dataUrl}`;
    }
    if (dataUrl.startsWith('http')) {
      return dataUrl;
    }
    if (dataUrl.startsWith('/')) {
      dataUrl = dataUrl.slice(1);
    }
    if (dataUrl.startsWith('jfs/')) {
      return `${baseUrl}/n1/${dataUrl}`;
    }
    return `${baseUrl}/n1/jfs/${dataUrl}`;
  }
  isProductImage(url) {
    // 严格匹配：必须包含 pcpubliccms 且路径中包含 /t1/
    return url.includes('pcpubliccms') && url.includes('/t1/');
  }
  parseSkuIds(raw) {
    return raw
      .split(/[\s,;，；、\n\r]+/)
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id));
  }
  getRandomDelay(min = 3000, max = 5000) {
    const safeMin = Math.max(0, min);
    const safeMax = Math.max(safeMin + 1, max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }
  getRandomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
  async closeBrowser() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      logger.warn('[JD][SKU] 关闭浏览器失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}
exports.JdSearchNode = JdSearchNode;
