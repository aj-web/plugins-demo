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
// 统一日志初始化
require('./logger-init');

const TaskDataManager = require('../utils/taskDataManager');

class ADXSearchNode {
  constructor() {
    // 使用 JSON 文件管理扒产任务
    this.taskManager = new TaskDataManager('smart-short-drama-data.json');

    this.SELECTORS = {
      CARD: '[class*="-card"][class*="-card-bordered"]',
      CARD_COVER: '[class*="-card-cover"]:not([class*="-card-cover-link"])',
      CARD_COVER_LINK: '[class*="-card-cover"] a',
      COVER_IMAGE_INNER: '[class*="-cover-image-inner"] img',
      COVER_VIDEO_PLAY_BTN: '[class*="-cover-video-play-btn"]',
      SEARCH_BUTTON: 'button[class*="btn-primary"] span[role="img"][type="SearchLinedIcon"]',
      PAGINATION: 'ul[class*="-pagination"]',
      NEXT_PAGE_BUTTON: 'li[class*="-pagination-item"][class*="-pagination-prev"]:not([class*="-pagination-prev-disabled"])',
      EXPOSURE_FILTER: 'text=最多曝光',
      TODAY_FILTER: 'text=今天',
      TODAY_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=今天',
      YESTERDAY_FILTER: 'text=昨天',
      YESTERDAY_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=昨天',
      THREE_DAYS_FILTER: 'text=3天',
      THREE_DAYS_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=3天',
      SEVEN_DAYS_FILTER: 'text=7天',
      SEVEN_DAYS_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=7天',
      THIRTY_DAYS_FILTER: 'text=30天',
      THIRTY_DAYS_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=30天',
      ALL_PERIOD_FILTER: 'text=全周期',
      ALL_PERIOD_FILTER_LI: 'li[class*="-picker-presets-li"] >> text=全周期'
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
      const selectContainer = await this.page.waitForSelector('[class*="select"][class*="compact-first-item"]', { timeout: 8000 }).catch(() => null);      if (selectContainer) {
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
  // Excel parsing disabled: dramaData will be provided via platform API (hot list) or other sources.
  // async readExcel(filePath) {
  //   // Excel parsing logic removed. Use platform API or frontend-provided dramaData instead.
  //   return { success: false, message: 'Excel parsing disabled in this plugin build' };
  // }
  // getAdxData disabled: Excel parsing removed. Use external dramaData sources.
  // getAdxData(headersName = '剧名', result) { return []; }
  // getAdxDataWithCount disabled: Excel parsing removed. Use platform-provided drama list.
  // getAdxDataWithCount(result) { return []; }
  async createFilebyAdxExcle(folderPath, dramaData, dateStr) {
    try {
      const today = dateStr || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      console.log(`开始创建文件夹，目标路径: ${folderPath}, 日期: ${today}`);
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
          const dramaDir = path.join(folderPath, '爆款扒产', today, cleanDramaName);
          if (!fs.existsSync(dramaDir)) {
            fs.mkdirSync(dramaDir, { recursive: true });
            console.log(`创建文件夹成功: 爆款扒产/${today}/${cleanDramaName}`);
          } else {
            console.log(`文件夹已存在: 爆款扒产/${today}/${cleanDramaName}`);
          }
          successCount++;
          results.push({
            name: cleanDramaName,
            subFolder: today,
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
  async startProcessing(folderPath, dramaData, exportOptions, dateStr) {
    const fs = require('fs');
    const path = require('path');

    try {
      const today = dateStr || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      console.log('开始处理，基础路径:', folderPath, '日期:', today);
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
          const dramaDir = path.join(folderPath, '爆款扒产', today, cleanDramaName);
          if (!fs.existsSync(dramaDir)) {
            fs.mkdirSync(dramaDir, { recursive: true });
            console.log(`创建文件夹成功: 爆款扒产/${today}/${cleanDramaName}`);
          }
          console.log(`开始搜索剧名: ${dramaName}，目标数量: ${targetCount}`);
          const searchResult = await this.startSearch(dramaName, targetCount);
          await new Promise((resolve) => setTimeout(resolve, 30000));
          if (!searchResult || !searchResult.success) {
            console.log(`搜索失败: ${dramaName}`, searchResult?.message);
            failCount++;
            results.push({
              name: cleanDramaName,
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
              name: cleanDramaName,
              status: 'insufficient_links',
              error: `只找到 ${mp4Links.length} 个MP4链接，需要${targetCount}个`
            });
            continue;
          }
          console.log(`开始下载 ${mp4Links.length} 个MP4文件到: ${dramaDir}`);
          const toDownload = mp4Links.slice(0, targetCount);
          const downloadedFiles = await this.downloadMp4Files(toDownload, dramaDir, dramaName);
          const successDownloadCount = downloadedFiles.length;
          const singleFailCount = toDownload.length - successDownloadCount;
          for (let i2 = 0; i2 < downloadedFiles.length; i2++) {
            const fileInfo = downloadedFiles[i2];
            const fileName = fileInfo.fileName;
            const durationSeconds = fileInfo.durationSeconds;
            const filePath = path.join(dramaDir, fileName);
            const videoName = path.basename(fileName, path.extname(fileName));
          }
          console.log(`下载与处理完成: ${dramaName} - 成功 ${successDownloadCount} 个，失败 ${singleFailCount} 个`);
          if (successDownloadCount > 0) {
            successCount++;
            results.push({
              name: cleanDramaName,
              status: 'success',
              downloadCount: successDownloadCount,
              failCount: singleFailCount
            });
          } else {
            failCount++;
            results.push({
              name: cleanDramaName,
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

  // async convertDownloadedVideo(filePath, dramaName, firstLevelPath, index, targetWidth = 720, targetHeight = 1280, exportOptions) {
  //   const path = require('path');
  //   const fs = require('fs');
  //   const { getFfmpegPathInfo, convertToTargetResolution } = require('../utils/video-exec-tool');
  //   const convertedDir = path.join(firstLevelPath, '最终成片');
  //   if (!fs.existsSync(convertedDir)) {
  //     fs.mkdirSync(convertedDir, { recursive: true });
  //   }
  //   const ffmpegInfo = await getFfmpegPathInfo();
  //   if (this.page && !this.page.isClosed()) {
  //     await this.browserManager.logToBrowser(this.page, `FFmpeg 路径信息: ${JSON.stringify(ffmpegInfo, null, 2)}`);
  //   } else {
  //     console.log(`FFmpeg 路径信息: ${JSON.stringify(ffmpegInfo, null, 2)}`);
  //   }
  //   console.log(`开始转换短视频 ${index}: ${path.basename(filePath)}`);
  //   const todayDate = new Date();
  //   const todayString = todayDate.getFullYear().toString() + (todayDate.getMonth() + 1).toString().padStart(2, '0') + todayDate.getDate().toString().padStart(2, '0');
  //   const naming = exportOptions?.naming || '{纯扒}-{鱼儿组}-{adx}';
  //   const match = naming.match(/^\{(.+?)\}-\{(.+?)\}-\{(.+?)\}$/);
  //   const typeText = match ? match[1] : '纯扒';
  //   const groupText = match ? match[2] : '鱼儿组';
  //   const platformText = match ? match[3] : 'adx';
  //   const convertedFileName = `短剧分销-点众-${dramaName}-${typeText}-${groupText}-机产-${todayString}-竖版-${platformText}-${index}.mp4`;
  //   const convertedFilePath = path.join(convertedDir, convertedFileName);
  //   if (fs.existsSync(convertedFilePath)) {
  //     console.log(`转换文件已存在，跳过: ${convertedFileName}`);
  //     return;
  //   }
  //   const targetCodec = 'h264';
  //   await convertToTargetResolution(filePath, convertedFilePath, targetWidth, targetHeight, targetCodec);
  //   console.log(`短视频转换完成: ${path.basename(filePath)} -> ${convertedFileName}`);
  //   if (this.page && !this.page.isClosed()) {
  //     await this.browserManager.logToBrowser(this.page, `短视频转换完成: ${convertedFileName}`);
  //   }
  // }

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
  // ==================== 自动执行（含去重） ====================
  async autoStartProcessing(outputPath, videoCount = 5, exportConfig = {}, dedupeExpireDays = 30, isScheduledTask = false) {
    console.log('[AdxSearch] autoStartProcessing 开始执行');
    console.log('[AdxSearch] 接收到的参数:', { outputPath, videoCount, exportConfig, dedupeExpireDays, isScheduledTask });

    // 懒加载任务队列
    const taskQueue = require('../utils/task-queue');
    if (!taskQueue.taskManager) {
      taskQueue.init(this.taskManager);
    }

    // 1. 创建 Task 对象
    const taskId = Date.now().toString();
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const task = {
      id: taskId,
      name: timeStr,
      module: '爆款扒产',
      createdAt: timeStr,
      status: '待执行', // 初始状态
      outputPath: outputPath,
      dramas: [], // 将在执行时填充
      result: {
        successCount: 0,
        failCount: 0,
        message: ''
      },
      params: {
        outputPath,
        processCount: 5,
        exportConfig,
        dedupeExpireDays,
        isScheduledTask,
        videoCount
      }
    };

    // 2. 定义执行函数（真正的业务逻辑）
    const executor = async (params) => {
      console.log('[AdxSearch] 开始执行任务业务逻辑');

      const data = this.taskManager.readTaskData();
      const tasks = data.tasks || [];
      console.log(`[AdxSearch] 读取到 ${tasks.length} 个历史任务`);

      const hotDramas = await this.fetchHotDramas();
      console.log(`[AdxSearch] 千沧热榜: ${hotDramas.length} 部`);
      if (!hotDramas || hotDramas.length === 0) {
        throw new Error('获取热门剧目失败');
      }

      const downloaded = this.extractRecentDownloads(tasks, params.dedupeExpireDays);
      console.log(`[AdxSearch] 最近${params.dedupeExpireDays}天已下载: ${downloaded.length} 部`, downloaded);

      const available = hotDramas.filter((name) => !downloaded.includes(name));
      console.log(`[AdxSearch] 可用剧目: ${available.length} 部`);

      const selected = available.slice(0, params.processCount);
      if (selected.length === 0) {
        throw new Error('没有可下载的新剧目（所有热门剧最近都已下载）');
      }

      console.log(`[AdxSearch] 选中剧目: ${selected.length} 部`, selected);

      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const dramas = selected.map((name) => ({ dramaName: name, count: params.videoCount }));
      const result = await this.startProcessing(params.outputPath, dramas, params.exportConfig, today);

      // 返回结果（包含 dramas 字段用于更新 Task）
      return {
        result: {
          successCount: result.successCount || 0,
          failCount: result.failCount || 0,
          message: result.message || ''
        },
        dramas: selected // 用于更新 task.dramas
      };
    };

    // 3. 加入队列并返回 taskId
    try {
      await taskQueue.addTask(task, executor);

      console.log(`[AdxSearch] 任务已提交到队列: ${taskId}`);

      return {
        success: true,
        taskId: taskId,
        message: '任务已提交，排队中...',
        queueLength: taskQueue.getQueueLength()
      };
    } catch (error) {
      console.error('[AdxSearch] 提交任务失败:', error);
      return {
        success: false,
        message: `提交任务失败: ${error.message}`
      };
    }
  }
  extractRecentDownloads(tasks, expireDays) {
    const now = Date.now();
    const downloaded = new Set();
    tasks
      .filter((task) => task.status === '已完成' && task.module === '爆款扒产')
      .forEach((task) => {
        const taskTimestamp = parseInt(task.id);
        const daysSince = (now - taskTimestamp) / (1000 * 60 * 60 * 24);
        if (daysSince <= expireDays) {
          // 从JSON的dramas字段读取（字符串数组）
          const dramas = task.dramas || [];
          dramas.forEach((name) => downloaded.add(name));
        }
      });
    return Array.from(downloaded);
  }
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
  async getTasks() {
    const tasks = this.taskManager.getTasks();
    return { success: true, tasks };
  }
  async saveTask(task) {
    this.taskManager.saveTask(task);
    return { success: true };
  }
}
exports.ADXSearchNode = ADXSearchNode;
