'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            }
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.ADXSearchNode = void 0;
const browser_manager_1 = require('../utils/browser-manager');
const global_cookie_manager_1 = __importStar(require('../utils/global-cookie-manager'));
const perceptual_hash_1 = require('../utils/perceptual-hash');
const login_state_utils_1 = require('../utils/login-state-utils');
const excel_reader_1 = require('../utils/excel-reader');
const video_exec_tool_1 = require('../utils/video-exec-tool');
const path = __importStar(require('path'));
const fs = __importStar(require('fs'));
function writeLog(level, message, data) {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const userDataPath = process.env.APPDATA || os.homedir();
    const logFile = path.join(userDataPath, 'plugins-demo', 'app-debug.log');
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const dataStr = data ? ' | Data: ' + JSON.stringify(data) : '';
    const logMessage = '[' + timestamp + '] [' + String(level).toUpperCase() + '] [PLUGIN] ' + String(message) + dataStr + '\n';
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {}
}
const mirrorWrite = (level, args) => {
  if (!args || args.length === 0) return;
  const message = args[0];
  const data = args.length > 1 ? args[1] : undefined;
  writeLog(level, message, data);
};
(() => {
  try {
    const bind = Function.prototype.bind;
    const originalLog = bind.call(console.log, console);
    const originalInfo = bind.call(console.info || console.log, console);
    const originalWarn = bind.call(console.warn || console.log, console);
    const originalError = bind.call(console.error || console.log, console);
    console.log = function (...args) {
      originalLog.apply(console, args);
      try {
        mirrorWrite('INFO', Array.prototype.slice.call(args));
      } catch {}
    };
    console.info = function (...args) {
      originalInfo.apply(console, args);
      try {
        mirrorWrite('INFO', Array.prototype.slice.call(args));
      } catch {}
    };
    console.warn = function (...args) {
      originalWarn.apply(console, args);
      try {
        mirrorWrite('WARN', Array.prototype.slice.call(args));
      } catch {}
    };
    console.error = function (...args) {
      originalError.apply(console, args);
      try {
        mirrorWrite('ERROR', Array.prototype.slice.call(args));
      } catch {}
    };
  } catch (e) {}
})();
class ADXSearchNode {
  constructor() {
    this.SELECTORS = {
      CARD: '.ae21c3f5-card',
      CARD_COVER: '.ae21c3f5-card-cover',
      CARD_COVER_LINK: '.ae21c3f5-card-cover a',
      COVER_IMAGE_INNER: '.ae21c3f5-cover-image-inner img',
      COVER_VIDEO_PLAY_BTN: '.ae21c3f5-cover-video-play-btn',
      SEARCH_BUTTON: 'button[class*="btn-primary"] span[role="img"][type="SearchLinedIcon"]',
      PAGINATION: 'ul.ae21c3f5-pagination',
      NEXT_PAGE_BUTTON: 'li.ae21c3f5-pagination-item.ae21c3f5-pagination-prev:not(.ae21c3f5-pagination-prev-disabled)',
      EXPOSURE_FILTER: 'text=最多曝光',
      TODAY_FILTER: 'text=今天',
      TODAY_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=今天',
      YESTERDAY_FILTER: 'text=昨天',
      YESTERDAY_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=昨天',
      THREE_DAYS_FILTER: 'text=3天',
      THREE_DAYS_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=3天',
      SEVEN_DAYS_FILTER: 'text=7天',
      SEVEN_DAYS_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=7天',
      THIRTY_DAYS_FILTER: 'text=30天',
      THIRTY_DAYS_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=30天',
      ALL_PERIOD_FILTER: 'text=全周期',
      ALL_PERIOD_FILTER_LI: 'li.ae21c3f5-picker-presets-li >> text=全周期'
    };
    this.cookieFileName = 'adx_cookie.json';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
    this.browserManager = new browser_manager_1.BrowserManager();
    this.excelReader = new excel_reader_1.ExcelReader();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
  async startSearch(keyword = '', targetCount = 15) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      console.log('接收到的关键词:', keyword);
      console.log('目标数量:', targetCount);
      const parsedDrama = this.parseDramaName(keyword);
      console.log('解析剧名结果:', parsedDrama);
      this.browser = await this.browserManager.createBrowser();
      const cookies = this.cookieManager.getCookies('adx') || [];
      if (cookies && cookies.length > 0) {
        this.context = await this.browserManager.createContextWithCookies(cookies, this.userAgent);
      } else {
        this.context = await this.browserManager.createContext(this.userAgent);
      }
      this.page = await this.context.newPage();
      await this.page.goto('https://adxray-app.dataeye.com', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      const loginResult = await login_state_utils_1.LoginStateUtils.waitForLogin(this.page);
      if (!loginResult || !loginResult.success) {
        await this.safeCloseAll();
        const msg = loginResult?.message === 'login_limit' ? '超过登录限制' : loginResult?.message || '未登录或登录态失效';
        return { success: false, message: msg };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1000)));
      try {
        const css1 = "li[data-menu-id='aff78d47-menu-creative/material']";
        let el = await this.page.waitForSelector(css1, { timeout: 4000 }).catch(() => null);
        if (!el) el = await this.page.waitForSelector('text=素材筛选', { timeout: 4000 }).catch(() => null);
        if (el) await el.click();
      } catch (e) {
        console.log('点击"素材筛选"失败(忽略)：', e?.message || e);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
      let finalResults = [];
      const searchedKeywords = [];
      if (parsedDrama.newName) {
        console.log(`\n=== 开始搜索新剧名: "${parsedDrama.newName}" ===`);
        const newResults = await this.searchSingleKeyword(parsedDrama.newName, targetCount);
        finalResults = newResults;
        searchedKeywords.push(parsedDrama.newName);
        console.log(`新剧名搜索完成，收集到 ${finalResults.length} 个结果`);
      }
      if (finalResults.length < targetCount && parsedDrama.originalName) {
        console.log(`\n=== 新剧名结果不足(${finalResults.length}/${targetCount})，开始搜索旧剧名: "${parsedDrama.originalName}" ===`);
        const remainingCount = targetCount - finalResults.length;
        const searchCount = Math.max(remainingCount * 2, 15);
        const oldResults = await this.searchSingleKeyword(parsedDrama.originalName, searchCount);
        const allResults = finalResults.concat(oldResults);
        const allCoverUrls = allResults.map((item) => item.coverImageUrl).filter((url) => url);
        const dedupeResult = await perceptual_hash_1.ImageDeduplicator.prototype.selectDistinctImages.call(new perceptual_hash_1.ImageDeduplicator(), allCoverUrls, targetCount, 0.85);
        const selectedUrls = new Set(dedupeResult.selected);
        finalResults = allResults.filter((item) => item.coverImageUrl && selectedUrls.has(item.coverImageUrl));
        searchedKeywords.push(parsedDrama.originalName);
        console.log(`旧剧名搜索完成，去重后最终结果数量: ${finalResults.length}`);
      }
      const finalResult = finalResults.slice(0, targetCount);
      console.log('最终结果数量:', finalResult.length);
      if (finalResult.length > 0) {
        console.log('最终结果示例:', {
          coverImageUrl: finalResult[0].coverImageUrl,
          duration: finalResult[0].duration,
          durationSeconds: finalResult[0].durationSeconds,
          videoUrl: finalResult[0].videoUrl
        });
      }
      return {
        success: true,
        message: `筛选完成，共收集 ${finalResult.length} 个结果`,
        data: finalResult,
        searchedKeywords: searchedKeywords
      };
    } catch (e) {
      await this.safeCloseAll();
      return { success: false, message: e?.message || '搜索启动失败' };
    } finally {
      await this.safeCloseAll();
    }
  }
  async searchSingleKeyword(keyword, targetCount) {
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
    try {
      console.log('开始寻找下拉菜单...');
      const selectContainer = await this.page.waitForSelector('[class*="select"][class*="compact-first-item"]', { timeout: 8000 }).catch(() => null);
      if (selectContainer) {
        console.log('找到下拉菜单容器，准备点击...');
        await selectContainer.click({ force: true });
        console.log('等待下拉选项加载...');
        await this.page.waitForSelector('text=短剧名', { timeout: 5000 }).catch(() => null);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('查找并点击"短剧名"选项...');
        const shortDramaOption = await this.page.waitForSelector('text=短剧名', { timeout: 5000 }).catch(() => null);
        if (shortDramaOption) {
          await shortDramaOption.click();
          console.log('已选择"短剧名"');
          const placeholderUpdated = await this.page.waitForSelector('input[placeholder="搜索短剧名"]', { timeout: 3000 }).catch(() => null);
          if (placeholderUpdated) {
            console.log('下拉菜单选择成功');
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          console.log('未找到"短剧名"选项');
        }
      } else {
        console.log('未找到下拉菜单容器');
      }
    } catch (e) {
      console.log('选择"短剧名"失败（忽略）：', e?.message || e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1000)));
    console.log(`开始搜索关键词: "${keyword}"，目标数量: ${targetCount}`);
    if (keyword && keyword.trim()) {
      await this.performSearch(keyword.trim());
    }
    await new Promise((resolve) => setTimeout(resolve, 5000 + Math.floor(Math.random() * 1000)));
    try {
      const el = await this.page.waitForSelector('text=最多曝光', { timeout: 8000 }).catch(() => null);
      if (el) await el.click();
      console.log('点击"最多曝光"成功');
    } catch (e) {
      console.log('点击"最多曝光"失败(忽略)：', e?.message || e);
      throw new Error('点击"最多曝光"失败: ' + (e?.message || e));
    }
    const timeFilters = ['今天', '昨天', '3天', '7天', '30天', '全周期'];
    let globalResults = [];
    for (const timeFilter of timeFilters) {
      if (globalResults.length >= targetCount) {
        break;
      }
      console.log(`尝试时间筛选器: ${timeFilter}，当前已收集 ${globalResults.length} 个结果，目标 ${targetCount} 个`);
      const filterClicked = await this.clickTimeFilter(timeFilter);
      if (!filterClicked) {
        console.log(`跳过时间筛选器: ${timeFilter}，未找到对应元素`);
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.floor(Math.random() * 1000)));
      const timeRangeResults = await this.crawlInTimeRange(targetCount - globalResults.length);
      globalResults = globalResults.concat(timeRangeResults);
      console.log(`时间筛选器"${timeFilter}"爬取完成，新增 ${timeRangeResults.length} 个结果，总计 ${globalResults.length} 个`);
    }
    console.log(`关键词 "${keyword}" 搜索完成，结果数量: ${globalResults.length}`);
    return globalResults;
  }
  async performSearch(keyword) {
    console.log(`开始搜索关键词: ${keyword}`);
    try {
      const searchInput = await this.page.waitForSelector('input[placeholder*="搜索短剧名"]', { timeout: 10000 });
      if (!searchInput) {
        throw new Error('找不到搜索输入框');
      }
      await searchInput.click();
      await searchInput.fill('');
      await searchInput.type(keyword, { delay: 100 });
      console.log(`已输入搜索关键词: ${keyword}`);
      const searchButton = await this.page.waitForSelector(this.SELECTORS.SEARCH_BUTTON, { timeout: 5000 });
      if (!searchButton) {
        throw new Error('找不到搜索按钮');
      }
      await searchButton.click();
      console.log('已点击搜索按钮');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const hasResults = await this.page.$(this.SELECTORS.CARD);
      if (!hasResults) {
        console.log('未找到搜索结果，可能搜索无结果');
      } else {
        console.log('搜索完成，找到结果');
      }
    } catch (e) {
      console.log('搜索过程中出错:', e?.message || e);
      throw e;
    }
  }
  async clickTimeFilter(timeFilter) {
    try {
      console.log(`尝试点击时间筛选器: ${timeFilter}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1000)));
      let el = await this.page
        .waitForSelector(`li.ae21c3f5-picker-presets-li >> text=${timeFilter}`, {
          timeout: 4000
        })
        .catch(() => null);
      if (!el) {
        el = await this.page.waitForSelector(`text=${timeFilter}`, { timeout: 4000 }).catch(() => null);
      }
      if (el) {
        await el.click();
        console.log(`成功点击时间筛选器: ${timeFilter}`);
        return true;
      } else {
        console.log(`未找到时间筛选器: ${timeFilter}`);
        return false;
      }
    } catch (e) {
      console.log(`点击时间筛选器"${timeFilter}"失败:`, e?.message || e);
      return false;
    }
  }
  async crawlInTimeRange(remainingCount) {
    let timeRangeResults = [];
    let currentPage = 1;
    const maxPages = 10;
    while (timeRangeResults.length < remainingCount && currentPage <= maxPages) {
      console.log(`时间范围内处理第 ${currentPage} 页，当前已收集 ${timeRangeResults.length} 个结果，目标 ${remainingCount} 个`);
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 1000)));
      await this.scrollToLoadMore();
      const pageResult = await this.extractCoverImages(40, 5);
      console.log(`第 ${currentPage} 页 extractCoverImages 结果数量:`, pageResult.length);
      if (pageResult && pageResult.length > 0) {
        const coverUrls = pageResult.map((item) => item.coverImageUrl).filter((url) => url);
        const dedupeResult = await perceptual_hash_1.ImageDeduplicator.prototype.selectDistinctImages.call(
          new perceptual_hash_1.ImageDeduplicator(),
          coverUrls,
          Math.min(remainingCount - timeRangeResults.length, coverUrls.length),
          0.85
        );
        const selectedUrls = new Set(dedupeResult.selected);
        const dedupedPageResults = pageResult.filter((item) => item.coverImageUrl && selectedUrls.has(item.coverImageUrl));
        timeRangeResults = timeRangeResults.concat(dedupedPageResults);
        console.log(`第 ${currentPage} 页处理后，时间范围内去重结果数量: ${timeRangeResults.length}`);
      }
      if (timeRangeResults.length >= remainingCount) {
        break;
      } else {
        const canGoNext = await this.goToNextPage();
        if (!canGoNext) {
          console.log('没有找到可点击的下一页按钮，停止翻页');
          break;
        }
      }
      currentPage++;
    }
    return timeRangeResults;
  }
  async goToNextPage() {
    try {
      const paginationExists = await this.page.waitForSelector(this.SELECTORS.PAGINATION, { timeout: 3000 }).catch(() => null);
      if (!paginationExists) {
        console.log('没有找到翻页组件');
        return false;
      }
      const nextPageButton = await this.page.waitForSelector(this.SELECTORS.NEXT_PAGE_BUTTON, { timeout: 2000 }).catch(() => null);
      if (!nextPageButton) {
        console.log('没有找到可点击的下一页按钮');
        return false;
      }
      await nextPageButton.click();
      await new Promise((resolve) => setTimeout(resolve, 3000 + Math.floor(Math.random() * 1000)));
      console.log('翻页成功');
      return true;
    } catch (e) {
      console.log('翻页失败:', e?.message || e);
      return false;
    }
  }
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
  }
  async extractCoverImages(limit = 15, minDurationSeconds = 0) {
    if (!this.page) return [];
    try {
      await this.page.waitForSelector(this.SELECTORS.CARD, { timeout: 10000 });
      console.log('检测到卡片元素，开始提取...');
      await this.page.evaluate(() => {
        console.log('检测到卡片元素，开始提取...');
      });
    } catch (e) {
      console.log('等待卡片元素超时，尝试直接提取:', e?.message || e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const items = await this.page.$$eval(
      this.SELECTORS.CARD,
      (cards, { limit, minDurationSeconds, selectors }) => {
        const results = [];
        for (let i = 0; i < cards.length && results.length < limit; i++) {
          const card = cards[i];
          const img = card.querySelector(selectors.COVER_IMAGE_INNER);
          let coverImageUrl = '';
          if (img) coverImageUrl = img.getAttribute('data-src') || img.getAttribute('src') || '';
          const durationEl = card.querySelector('.video-duration.css-1tlt978');
          let duration = '';
          let durationSeconds = 0;
          if (durationEl) {
            duration = durationEl.textContent?.trim() || '';
            if (duration) {
              const parts = duration.split(':');
              if (parts.length === 2) {
                const minutes = parseInt(parts[0]) || 0;
                const seconds = parseInt(parts[1]) || 0;
                durationSeconds = minutes * 60 + seconds;
              }
            }
          }
          if (minDurationSeconds > 0 && durationSeconds < minDurationSeconds) {
            console.log(`跳过视频 ${i + 1}，时长 ${duration} (${durationSeconds}秒) 小于最小要求 ${minDurationSeconds}秒`);
            continue;
          }
          if (coverImageUrl) {
            results.push({
              coverImageUrl: coverImageUrl,
              duration: duration,
              durationSeconds: durationSeconds
            });
          }
        }
        return results;
      },
      { limit, minDurationSeconds, selectors: this.SELECTORS }
    );
    console.log(`初步筛选后剩余 ${items.length} 个视频（最小时长要求: ${minDurationSeconds}秒）`);
    for (let i = 0; i < items.length; i++) {
      try {
        const originalCardIndex = await this.page.evaluate(
          ({ targetIndex, selectors }) => {
            const cards = document.querySelectorAll(selectors.CARD);
            let currentIndex = 0;
            for (let j = 0; j < cards.length; j++) {
              const card = cards[j];
              const img = card.querySelector(selectors.COVER_IMAGE_INNER);
              let coverImageUrl = '';
              if (img) coverImageUrl = img.getAttribute('data-src') || img.getAttribute('src') || '';
              const durationEl = card.querySelector('.video-duration.css-1tlt978');
              let duration = '';
              let durationSeconds = 0;
              if (durationEl) {
                duration = durationEl.textContent?.trim() || '';
                if (duration) {
                  const parts = duration.split(':');
                  if (parts.length === 2) {
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseInt(parts[1]) || 0;
                    durationSeconds = minutes * 60 + seconds;
                  }
                }
              }
              if (coverImageUrl && durationSeconds >= 5) {
                if (currentIndex === targetIndex) {
                  return j;
                }
                currentIndex++;
              }
            }
            return -1;
          },
          { targetIndex: i, selectors: this.SELECTORS }
        );
        if (originalCardIndex === -1) {
          console.log(`第${i + 1}个视频找不到对应的原始卡片`);
          continue;
        }
        const videoUrl = await this.page.evaluate(
          ({ cardIndex, selectors }) => {
            const cards = document.querySelectorAll(selectors.CARD);
            const card = cards[cardIndex];
            if (!card) return null;
            const linkEl = card.querySelector(selectors.CARD_COVER_LINK) || card.querySelector('a[href*=".mp4"]') || card.querySelector('a');
            if (!linkEl) return null;
            const playBtnEl = card.querySelector(selectors.COVER_VIDEO_PLAY_BTN);
            if (playBtnEl) {
              ['mouseenter', 'mouseover', 'mousemove'].forEach((eventType) => {
                const event = new MouseEvent(eventType, {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                playBtnEl.dispatchEvent(event);
              });
              return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 3;
                const checkHref = () => {
                  attempts++;
                  const href = linkEl.getAttribute('href');
                  console.log(`卡片${cardIndex}第${attempts}次检查href:`, href);
                  if (href && href !== '#') {
                    resolve(href);
                  } else if (attempts < maxAttempts) {
                    ['mouseenter', 'mouseover'].forEach((eventType) => {
                      const event = new MouseEvent(eventType, {
                        view: window,
                        bubbles: true,
                        cancelable: true
                      });
                      playBtnEl.dispatchEvent(event);
                    });
                    setTimeout(checkHref, 300);
                  } else {
                    resolve(null);
                  }
                };
                setTimeout(checkHref, 500);
              });
            }
            const href = linkEl.getAttribute('href');
            return href && href !== '#' ? href : null;
          },
          { cardIndex: originalCardIndex, selectors: this.SELECTORS }
        );
        if (videoUrl) {
          items[i].videoUrl = videoUrl;
          console.log(`成功提取第${i + 1}个视频链接 (时长: ${items[i].duration}):`, videoUrl);
        } else {
          console.log(`第${i + 1}个视频链接提取失败 (时长: ${items[i].duration})`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.log(`提取第${i + 1}个视频链接失败:`, e?.message || e);
      }
    }
    console.log(`提取到 ${items.length} 个图片URL，其中 ${items.filter((item) => item.videoUrl).length} 个包含视频链接`);
    await this.page.evaluate(
      ({ count, videoCount }) => {
        console.log(`提取到 ${count} 个图片URL，其中 ${videoCount} 个包含视频链接`);
      },
      {
        count: items.length,
        videoCount: items.filter((item) => item.videoUrl).length
      }
    );
    return items;
  }
  async scrollToLoadMore() {
    console.log('开始滚动页面加载更多内容...');
    const initialCardCount = await this.page.$$eval(this.SELECTORS.CARD, (cards) => cards.length);
    if (initialCardCount === 0) {
      console.log('没有发现任何卡片，跳过滚动');
      return;
    }
    for (let i = 0; i < 10; i++) {
      await this.page.evaluate((selectors) => {
        const cards = document.querySelectorAll(selectors.CARD);
        const viewportHeight = window.innerHeight;
        const currentScrollY = window.scrollY;
        let lastVisibleCard = null;
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          if (rect.top < viewportHeight && rect.bottom > 0) {
            lastVisibleCard = card;
          }
        }
        if (lastVisibleCard) {
          const rect = lastVisibleCard.getBoundingClientRect();
          const targetScrollY = currentScrollY + rect.bottom - viewportHeight + 100;
          window.scrollTo(0, targetScrollY);
        } else {
          window.scrollTo(0, currentScrollY + viewportHeight);
        }
      }, this.SELECTORS);
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.floor(Math.random() * 500)));
      const cardCount = await this.page.$$eval(this.SELECTORS.CARD, (cards) => cards.length);
      console.log(`第${i + 1}次滚动后，发现 ${cardCount} 个卡片`);
    }
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('滚动完成');
  }
  async readExcel(filePath) {
    const sheetName = 'Sheet1';
    try {
      console.log(`开始读取Excel文件: ${filePath}`);
      if (sheetName) {
        console.log(`指定工作表: ${sheetName}`);
      }
      let sheetIndex = 0;
      if (sheetName) {
        const fileInfo = await this.excelReader.getExcelInfo(filePath);
        if (!fileInfo.success || !fileInfo.info) {
          return {
            success: false,
            message: `获取文件信息失败: ${fileInfo.message}`
          };
        }
        const targetIndex = fileInfo.info.sheetNames.findIndex((name) => name.toLowerCase() === sheetName.toLowerCase());
        if (targetIndex === -1) {
          return {
            success: false,
            message: `未找到工作表 "${sheetName}"，可用工作表: ${fileInfo.info.sheetNames.join(', ')}`
          };
        }
        sheetIndex = targetIndex;
        console.log(`找到工作表 "${sheetName}"，索引: ${sheetIndex}`);
      }
      const options = {
        hasHeader: true,
        maxRows: 1000,
        sheetIndex: sheetIndex
      };
      const result = await this.excelReader.readExcel(filePath, options);
      if (result.success) {
        const dramaData = this.getAdxDataWithCount(result.data || []);
        await this.browserManager.logToBrowser(this.page, '提取的剧名和数量数据:', dramaData);
        return {
          success: true,
          data: dramaData
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('读取Excel文件失败:', error);
      return {
        success: false,
        message: `读取Excel文件失败: ${error.message}`
      };
    }
  }
  getAdxData(headersName = '剧名', result) {
    try {
      console.log(`开始提取列 "${headersName}" 的数据...`);
      if (!result || !Array.isArray(result)) {
        console.log('输入数据无效');
        return [];
      }
      const extractedData = result
        .map((row, index) => {
          const value = row[headersName];
          return {
            value: value || ''
          };
        })
        .filter((item) => item.value && item.value.trim() !== '');
      console.log(`成功提取到 ${extractedData.length} 条 "${headersName}" 数据:`);
      return extractedData;
    } catch (error) {
      console.error('提取数据失败:', error);
      return [];
    }
  }
  getAdxDataWithCount(result) {
    try {
      console.log(`开始提取剧名和数量数据...`);
      if (!result || !Array.isArray(result)) {
        console.log('输入数据无效');
        return [];
      }
      const extractedData = result
        .map((row, index) => {
          const dramaName = row['剧名'];
          const count = row['数量'];
          let parsedCount = 15;
          if (count !== undefined && count !== null && count !== '') {
            const numCount = parseInt(count);
            if (!isNaN(numCount) && numCount > 0) {
              parsedCount = numCount;
            }
          }
          return {
            dramaName: dramaName || '',
            count: parsedCount
          };
        })
        .filter((item) => item.dramaName && item.dramaName.trim() !== '');
      console.log(`成功提取到 ${extractedData.length} 条剧名和数量数据:`);
      extractedData.forEach((item, index) => {
        console.log(`${index + 1}. 剧名: "${item.dramaName}", 数量: ${item.count}`);
      });
      return extractedData;
    } catch (error) {
      console.error('提取数据失败:', error);
      return [];
    }
  }
  async createFilebyAdxExcle(folderPath, dramaData) {
    try {
      console.log(`开始创建文件夹，目标路径: ${folderPath}`);
      if (!folderPath) {
        return {
          success: false,
          message: '文件夹路径不能为空'
        };
      }
      if (!dramaData || !Array.isArray(dramaData) || dramaData.length === 0) {
        return {
          success: false,
          message: '剧名数据为空，无法创建文件夹'
        };
      }
      console.log(`准备创建 ${dramaData.length} 个文件夹`);
      console.log('剧名数据:', dramaData);
      const fs = require('fs');
      const path = require('path');
      let successCount = 0;
      let failCount = 0;
      const results = [];
      for (let i = 0; i < dramaData.length; i++) {
        const dramaItem = dramaData[i];
        const dramaName = dramaItem.dramaName;
        const targetCount = dramaItem.count;
        try {
          if (!dramaName || dramaName.trim() === '') {
            console.log(`跳过空剧名: ${dramaName}`);
            continue;
          }
          const parsedDrama = this.parseDramaName(dramaName);
          const folderName = parsedDrama.newName;
          console.log(`原始剧名: "${dramaName}" -> 文件夹名: "${folderName}"`);
          const cleanDramaName = folderName.trim().replace(/[<>:"/\\|?*]/g, '_');
          const firstLevelFolderName = cleanDramaName;
          const firstLevelPath = path.join(folderPath, firstLevelFolderName);
          if (!fs.existsSync(firstLevelPath)) {
            fs.mkdirSync(firstLevelPath, { recursive: true });
            console.log(`创建一级文件夹成功: ${firstLevelFolderName}`);
          } else {
            console.log(`一级文件夹已存在: ${firstLevelFolderName}`);
          }
          // 创建"素材"文件夹
          const materialFolderName = '素材';
          const materialFolderPath = path.join(firstLevelPath, materialFolderName);
          if (!fs.existsSync(materialFolderPath)) {
            fs.mkdirSync(materialFolderPath, { recursive: true });
            console.log(`创建素材文件夹成功: ${firstLevelFolderName}/${materialFolderName}`);
          } else {
            console.log(`素材文件夹已存在: ${firstLevelFolderName}/${materialFolderName}`);
          }
          const secondLevelFolderName = '原始素材';
          const secondLevelPath = path.join(materialFolderPath, secondLevelFolderName);
          if (!fs.existsSync(secondLevelPath)) {
            fs.mkdirSync(secondLevelPath, { recursive: true });
            console.log(`创建二级文件夹成功: ${firstLevelFolderName}/${materialFolderName}/${secondLevelFolderName}`);
          } else {
            console.log(`二级文件夹已存在: ${firstLevelFolderName}/${materialFolderName}/${secondLevelFolderName}`);
          }
          successCount++;
          results.push({
            name: firstLevelFolderName,
            subFolder: secondLevelFolderName,
            status: 'success'
          });
        } catch (error) {
          console.error(`创建文件夹失败: ${dramaName}`, error.message);
          failCount++;
          results.push({
            name: dramaName,
            status: 'error',
            error: error.message
          });
        }
      }
      console.log(`\n=== 文件夹创建完成 ===`);
      console.log(`成功: ${successCount} 个，失败: ${failCount} 个`);
      return {
        success: true,
        message: `文件夹创建完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        results: results,
        successCount: successCount,
        failCount: failCount
      };
    } catch (error) {
      console.error('创建文件夹失败:', error);
      return {
        success: false,
        message: `创建文件夹失败: ${error.message}`
      };
    }
  }
  async startProcessing(folderPath, dramaData, exportOptions) {
    try {
      console.log('开始处理，目标路径:', folderPath);
      console.log('剧名数据:', dramaData);
      if (!folderPath || !dramaData || dramaData.length === 0) {
        return {
          success: false,
          message: '参数不完整，无法开始处理'
        };
      }
      let successCount = 0;
      let failCount = 0;
      const results = [];
      const resolveResolution = (res) => {
        if (!res) return { width: 720, height: 1280 };
        if (typeof res === 'string') {
          const m = res.match(/^(\d+)x(\d+)$/);
          if (m) {
            return { width: parseInt(m[1], 10) || 720, height: parseInt(m[2], 10) || 1280 };
          }
          return { width: 720, height: 1280 };
        }
        const w = parseInt(res.width, 10);
        const h = parseInt(res.height, 10);
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          return { width: w, height: h };
        }
        return { width: 720, height: 1280 };
      };
      const { width: exportWidth, height: exportHeight } = resolveResolution(exportOptions?.resolution);
      // 检查内存中是否有 Cookie
      let cookies = this.cookieManager.getCookies('adx');
      if (!cookies || cookies.length === 0) {
        console.log('[Cookie检查] 内存中无 Cookie，尝试从文件加载');
        const FileCookieStore = require('../utils/file-cookie-store');
        const fileCookies = FileCookieStore.loadCookies(this.cookieFileName);
        if (fileCookies) {
          this.cookieManager.saveCookies('adx', fileCookies);
          console.log(`[Cookie检查] 已从文件加载 ${fileCookies.length} 个 Cookie 到内存`);
        } else {
          console.log('[Cookie检查] 文件中也没有 Cookie，请先登录');
        }
      } else {
        console.log(`[Cookie检查] 内存中已有 ${cookies.length} 个 Cookie`);
      }
      for (let i = 0; i < dramaData.length; i++) {
        const dramaItem = dramaData[i];
        const dramaName = dramaItem.dramaName;
        const targetCount = dramaItem.count;
        try {
          console.log(`\n=== 开始处理第 ${i + 1}/${dramaData.length} 个剧目: ${dramaName} ===`);
          if (!dramaName || dramaName.trim() === '') {
            console.log(`跳过空剧名: ${dramaName}`);
            continue;
          }
          const parsedDrama = this.parseDramaName(dramaName);
          const folderName = parsedDrama.newName;
          console.log(`原始剧名: "${dramaName}" -> 文件夹名: "${folderName}"`);
          const cleanDramaName = folderName.trim().replace(/[<>:"/\\|?*]/g, '_');
          const firstLevelFolderName = cleanDramaName;
          const firstLevelPath = path.join(folderPath, firstLevelFolderName);
          if (!fs.existsSync(firstLevelPath)) {
            fs.mkdirSync(firstLevelPath, { recursive: true });
            console.log(`创建一级文件夹成功: ${firstLevelFolderName}`);
          }
          // 创建"素材"文件夹
          const materialFolderName = '素材';
          const materialFolderPath = path.join(firstLevelPath, materialFolderName);
          if (!fs.existsSync(materialFolderPath)) {
            fs.mkdirSync(materialFolderPath, { recursive: true });
            console.log(`创建素材文件夹成功: ${firstLevelFolderName}/${materialFolderName}`);
          }
          const secondLevelFolderName = '原始素材';
          const secondLevelPath = path.join(materialFolderPath, secondLevelFolderName);
          if (!fs.existsSync(secondLevelPath)) {
            fs.mkdirSync(secondLevelPath, { recursive: true });
            console.log(`创建二级文件夹成功: ${firstLevelFolderName}/${materialFolderName}/${secondLevelFolderName}`);
          }
          console.log(`开始搜索剧名: ${dramaName}，目标数量: ${targetCount}`);
          const searchResult = await this.startSearch(dramaName, targetCount);
          await new Promise((resolve) => setTimeout(resolve, 30000));
          if (!searchResult || !searchResult.success) {
            console.log(`搜索失败: ${dramaName}`, searchResult?.message);
            failCount++;
            results.push({
              name: firstLevelFolderName,
              status: 'search_failed',
              error: searchResult?.message || '搜索失败'
            });
            continue;
          }
          const mp4Links =
            searchResult.data?.filter((item) => item.videoUrl && item.videoUrl.trim() !== '').map((item) => ({ videoUrl: item.videoUrl, durationSeconds: item.durationSeconds || 0 })) || [];
          console.log(`找到 ${mp4Links.length} 个MP4链接`);
          if (mp4Links.length < targetCount) {
            console.log(`MP4链接数量不满足要求，跳过: ${dramaName}`);
            failCount++;
            results.push({
              name: firstLevelFolderName,
              status: 'insufficient_links',
              error: `只找到 ${mp4Links.length} 个MP4链接，需要${targetCount}个`
            });
            continue;
          }
          console.log(`开始下载 ${mp4Links.length} 个MP4文件到: ${secondLevelPath}`);
          const toDownload = mp4Links.slice(0, targetCount);
          const downloadedFiles = await this.downloadMp4Files(toDownload, secondLevelPath, dramaName);
          const successDownloadCount = downloadedFiles.length;
          const singleFailCount = toDownload.length - successDownloadCount;
          for (let i2 = 0; i2 < downloadedFiles.length; i2++) {
            const fileInfo = downloadedFiles[i2];
            const fileName = fileInfo.fileName;
            const durationSeconds = fileInfo.durationSeconds;
            const filePath = path.join(secondLevelPath, fileName);
            const videoName = path.basename(fileName, path.extname(fileName));

            // 判断是否为5-10秒视频
            const isShortVideo = durationSeconds >= 5 && durationSeconds <= 10;

            if (isShortVideo) {
              console.log(`检测到5-10秒短视频 (${durationSeconds}秒): ${fileName}，将直接转换到最终成片`);
              try {
                await this.convertDownloadedVideo(filePath, dramaName, firstLevelPath, i2 + 1, exportWidth, exportHeight, exportOptions);
                // 转换成功后删除原始素材中的文件
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  console.log(`已删除原始素材: ${fileName}`);
                }
              } catch (e) {
                console.error(`短视频转换失败: ${fileName}`, e?.message || e);
                if (this.page && !this.page.isClosed()) {
                  await this.browserManager.logToBrowser(this.page, `短视频转换失败: ${fileName} - ${e?.message || e}`);
                }
              }
              continue;
            }

            // 正常流程：分析和处理
            if (true) {
              await this.analyzeDownloadedVideo(filePath, dramaName, firstLevelPath, videoName).catch(async (e) => {
                console.error(`视频分析失败: ${fileName}`, e?.message || e);
                if (this.page && !this.page.isClosed()) {
                  await this.browserManager.logToBrowser(this.page, `视频分析失败: ${fileName} - ${e?.message || e}`);
                }
              });
            }
            // 使用新的批量视频处理方法
            await this.processVideoWithElements(filePath, dramaName, firstLevelPath, i2 + 1, exportWidth, exportHeight, exportOptions).catch((e) => {
              console.error(`视频处理失败: ${fileName}`, e?.message || e);
            });
          }
          console.log(`下载与处理完成: ${dramaName} - 成功 ${successDownloadCount} 个，失败 ${singleFailCount} 个`);
          if (successDownloadCount > 0) {
            successCount++;
            results.push({
              name: firstLevelFolderName,
              status: 'success',
              downloadCount: successDownloadCount,
              failCount: singleFailCount
            });
          } else {
            failCount++;
            results.push({
              name: firstLevelFolderName,
              status: 'download_failed',
              error: '无可用视频下载成功'
            });
          }
        } catch (error) {
          console.error(`处理剧目失败: ${dramaName}`, error);
          failCount++;
          results.push({
            name: dramaName,
            status: 'error',
            error: error.message
          });
        }
      }
      console.log(`\n=== 处理完成 ===`);
      console.log(`成功: ${successCount} 个，失败: ${failCount} 个`);
      return {
        success: true,
        message: `处理完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        results: results,
        successCount: successCount,
        failCount: failCount
      };
    } catch (error) {
      console.error('开始处理失败:', error);
      return {
        success: false,
        message: `开始处理失败: ${error.message}`
      };
    }
  }
  async downloadMp4Files(links, downloadPath, dramaName) {
    try {
      const fs = require('fs');
      const path = require('path');
      if (!Array.isArray(links) || links.length === 0) return [];
      console.log(`准备下载 ${links.length} 个文件（单线程模式）`);
      const results = [];
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const fileIndex = i + 1;
        const mp4Url = link?.videoUrl;
        const durationSeconds = link?.durationSeconds || 0;
        if (!mp4Url || mp4Url.trim() === '') {
          console.log(`跳过空链接: ${fileIndex}`);
          continue;
        }
        const fileName = `${dramaName}_${fileIndex}.mp4`;
        const filePath = path.join(downloadPath, fileName);
        if (fs.existsSync(filePath)) {
          console.log(`文件已存在，跳过: ${fileName}`);
          results.push({ fileName, durationSeconds });
          continue;
        }
        try {
          console.log(`开始下载: ${fileName} (${fileIndex}/${links.length})`);
          await this.downloadFile(mp4Url, filePath);
          console.log(`下载完成: ${fileName}`);
          results.push({ fileName, durationSeconds });
        } catch (error) {
          console.error(`下载失败 ${fileIndex}:`, error.message);
        }
      }
      console.log(`下载任务完成，成功下载 ${results.length} 个文件`);
      return results;
    } catch (error) {
      console.error('批量下载失败:', error.message);
      return [];
    }
  }
  async analyzeDownloadedVideo(filePath, dramaName, firstLevelPath, name) {
    const path = require('path');
    console.log(`开始分析视频: ${path.basename(filePath)}`);
    try {
      const fs = require('fs');
      const VideoAnalyzer = require('../service/VideoAnalyzer');
      const analysisOutputDir = path.join(firstLevelPath, '素材', '检测结果', name);
      if (!fs.existsSync(analysisOutputDir)) {
        fs.mkdirSync(analysisOutputDir, { recursive: true });
      }
      const analyzer = new VideoAnalyzer(filePath, analysisOutputDir, {
        enableONNXDetection: true,
        onnxModelPath: path.join(__dirname, '../models/best.onnx')
      });
      const analysisResult = await analyzer.analyze(filePath, {
        maxFrames: 50,
        heatmapThreshold: 0.5,
        tailDuration: 10,
        multiplier: 3.0
      });
      console.log(`视频分析完成: ${path.basename(filePath)}`, {
        frameCount: analysisResult.frameAnalysis?.frameCount,
        hasTail: analysisResult.tailDetection?.hasTail
      });
      if (this.page && !this.page.isClosed()) {
        await this.browserManager.logToBrowser(
          this.page,
          `视频分析完成: ${path.basename(filePath)} - 帧数: ${analysisResult.frameAnalysis?.frameCount}, 尾部检测: ${analysisResult.tailDetection?.hasTail}`
        );
      }
    } catch (e) {
      throw e;
    }
  }
  async convertDownloadedVideo(filePath, dramaName, firstLevelPath, index, targetWidth = 720, targetHeight = 1280, exportOptions) {
    const path = require('path');
    const fs = require('fs');
    const { getFfmpegPathInfo, convertToTargetResolution } = require('../utils/video-exec-tool');
    const convertedDir = path.join(firstLevelPath, '最终成片');
    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true });
    }
    const ffmpegInfo = await getFfmpegPathInfo();
    if (this.page && !this.page.isClosed()) {
      await this.browserManager.logToBrowser(this.page, `FFmpeg 路径信息: ${JSON.stringify(ffmpegInfo, null, 2)}`);
    } else {
      console.log(`FFmpeg 路径信息: ${JSON.stringify(ffmpegInfo, null, 2)}`);
    }
    console.log(`开始转换短视频 ${index}: ${path.basename(filePath)}`);
    const todayDate = new Date();
    const todayString = todayDate.getFullYear().toString() + (todayDate.getMonth() + 1).toString().padStart(2, '0') + todayDate.getDate().toString().padStart(2, '0');
    const naming = exportOptions?.naming || '{纯扒}-{鱼儿组}-{adx}';
    const match = naming.match(/^\{(.+?)\}-\{(.+?)\}-\{(.+?)\}$/);
    const typeText = match ? match[1] : '纯扒';
    const groupText = match ? match[2] : '鱼儿组';
    const platformText = match ? match[3] : 'adx';
    const convertedFileName = `短剧分销-点众-${dramaName}-${typeText}-${groupText}-机产-${todayString}-竖版-${platformText}-${index}.mp4`;
    const convertedFilePath = path.join(convertedDir, convertedFileName);
    if (fs.existsSync(convertedFilePath)) {
      console.log(`转换文件已存在，跳过: ${convertedFileName}`);
      return;
    }
    const targetCodec = 'h264';
    await convertToTargetResolution(filePath, convertedFilePath, targetWidth, targetHeight, targetCodec);
    console.log(`短视频转换完成: ${path.basename(filePath)} -> ${convertedFileName}`);
    if (this.page && !this.page.isClosed()) {
      await this.browserManager.logToBrowser(this.page, `短视频转换完成: ${convertedFileName}`);
    }
  }
  async processVideoWithElements(filePath, dramaName, firstLevelPath, index, targetWidth = 720, targetHeight = 1280, exportOptions) {
    const path = require('path');
    const fs = require('fs');
    const { buildGenerateVideoParamsForAll, addElementsToVideo } = require('../utils/video-exec-tool');

    // 构建buildConfigs参数
    const buildConfigs = {
      basePath: firstLevelPath, // 剧名根路径
      configPath: exportOptions?.configPath || '', // 配置文件路径
      batchSize: exportOptions?.batchSize || 1, // 视频裂变次数
      naming: exportOptions?.naming || '{纯扒}-{鱼儿组}-{adx}', // 命名规则
      width: targetWidth, // 分辨率宽度
      height: targetHeight, // 分辨率高度
      elements: this.buildElementConfigs(exportOptions) // 智能添加配置
    };
    console.log('buildConfigs:', buildConfigs);

    try {
      // 调用buildGenerateVideoParamsForAll生成处理参数
      const videoParams = await buildGenerateVideoParamsForAll(buildConfigs);
      console.log('videoParams', videoParams);
      if (!videoParams || videoParams.length === 0) {
        console.log(`没有找到需要处理的视频参数: ${path.basename(filePath)}`);
        return;
      }

      // 处理每个视频参数
      for (const params of videoParams) {
        try {
          await addElementsToVideo(params);
          console.log(`视频处理完成: ${path.basename(params.outputPath)}`);
        } catch (error) {
          console.error(`视频处理失败: ${path.basename(params.videoPath)}`, error);
        }
      }
    } catch (error) {
      console.error(`批量视频处理失败: ${path.basename(filePath)}`, error);
      throw error;
    }
  }

  buildElementConfigs(exportOptions) {
    // 将前端的elementConfig转换为buildGenerateVideoParamsForAll需要的格式
    const elementConfig = exportOptions?.elementConfig || {};
    const elements = [];

    // 角标配置
    if (elementConfig.badge) {
      elements.push({
        name: '角标',
        required: elementConfig.badge.mode === 'required',
        occurRate: elementConfig.badge.mode === 'random' ? elementConfig.badge.probability / 100 : 1
      });
    }

    // 剧名配置
    if (elementConfig.title) {
      elements.push({
        name: '剧名',
        required: elementConfig.title.mode === 'required',
        occurRate: elementConfig.title.mode === 'random' ? elementConfig.title.probability / 100 : 1
      });
    }

    // 警示语配置
    if (elementConfig.guide) {
      elements.push({
        name: '警示语',
        required: elementConfig.guide.mode === 'required',
        occurRate: elementConfig.guide.mode === 'random' ? elementConfig.guide.probability / 100 : 1
      });
    }

    // 引导尾帧配置
    if (elementConfig.ending) {
      elements.push({
        name: '引导尾帧',
        required: elementConfig.ending.mode === 'required',
        occurRate: elementConfig.ending.mode === 'random' ? elementConfig.ending.probability / 100 : 1
      });
    }

    return elements;
  }
  async downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
      const { URL } = require('url');
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      const file = fs.createWriteStream(filePath);
      const request = protocol.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(filePath);
          return this.downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          file.close();
          fs.unlinkSync(filePath);
          reject(err);
        });
      });
      request.on('error', (err) => {
        file.close();
        fs.unlinkSync(filePath);
        reject(err);
      });
      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error('下载超时'));
      });
    });
  }
  parseDramaName(dramaName) {
    if (!dramaName || typeof dramaName !== 'string') {
      return {
        newName: dramaName || '',
        originalName: null
      };
    }
    const match = dramaName.match(/^(.+?)（原名：(.+?)）$/);
    if (match) {
      return {
        newName: match[1].trim(),
        originalName: match[2].trim()
      };
    }
    return {
      newName: dramaName.trim(),
      originalName: null
    };
  }
  async createTemplateFolders(basePath, folderStructure, badgeSubFolders) {
    try {
      console.log('开始创建模板文件夹结构...');
      console.log('基础路径:', basePath);
      console.log('文件夹结构:', folderStructure);
      console.log('角标子文件夹:', badgeSubFolders);

      // 先创建"配置文件"文件夹
      const configFolderPath = path.join(basePath, '配置文件');
      if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath, { recursive: true });
        console.log('创建配置文件夹:', configFolderPath);
      } else {
        console.log('配置文件夹已存在:', configFolderPath);
      }

      // 在"配置文件"文件夹下创建子文件夹
      for (const folderName of folderStructure) {
        const folderPath = path.join(configFolderPath, folderName);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
          console.log('创建文件夹:', folderPath);
        } else {
          console.log('文件夹已存在:', folderPath);
        }
      }

      // 在"配置文件/角标"文件夹下创建子文件夹
      const badgeFolderPath = path.join(configFolderPath, '角标');
      for (const subFolderName of badgeSubFolders) {
        const subFolderPath = path.join(badgeFolderPath, subFolderName);
        if (!fs.existsSync(subFolderPath)) {
          fs.mkdirSync(subFolderPath, { recursive: true });
          console.log('创建角标子文件夹:', subFolderPath);
        } else {
          console.log('角标子文件夹已存在:', subFolderPath);
        }
      }
      console.log('模板文件夹结构创建完成！');
      return {
        success: true,
        message: '模板文件夹结构创建成功',
        configFolderPath: configFolderPath,
        createdFolders: {
          main: folderStructure,
          badgeSub: badgeSubFolders
        }
      };
    } catch (error) {
      console.error('创建模板文件夹失败:', error);
      return {
        success: false,
        message: `创建模板文件夹失败: ${error.message}`
      };
    }
  }
}
exports.ADXSearchNode = ADXSearchNode;
