'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KeywordSearchNode = void 0;
const image_search_1 = require('./image-search');
const logger = require('../utils/logger');
class KeywordSearchNode extends image_search_1.ImageSearchNode {
  async inputKeywordAndSearch(keyword) {
    if (!this.page) {
      throw new Error('页面未初始化');
    }
    logger.info('定位搜索输入框', { keyword });
    const inputSelectors = ['#q', 'input[name="q"]', '.search-suggest-combobox-imageSearch-input'];
    const buttonSelectors = ['button.btn-search.tb-bg', 'button.btn-search', 'button[type="submit"]'];
    let targetInput = null;
    for (const selector of inputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        const element = await this.page.$(selector);
        if (element) {
          targetInput = selector;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    if (!targetInput) {
      logger.error('未找到搜索输入框', { selectors: inputSelectors });
      throw new Error('未找到搜索输入框');
    }
    logger.info('找到搜索输入框', { selector: targetInput });
    try {
      await this.page.fill(targetInput, '');
      await this.page.type(targetInput, keyword, { delay: 30 });
    } catch (error) {
      logger.warn('使用fill/type失败，改用JavaScript方式输入', { error: error.message });
      await this.page.evaluate(
        (selector, value) => {
          const input = document.querySelector(selector);
          if (!input) {
            return;
          }
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        targetInput,
        keyword
      );
    }
    logger.info('关键词输入完成', { keyword });
    const newPagePromise = this.context ? this.context.waitForEvent('page', { timeout: 10000 }).catch(() => null) : null;
    const navigationPromise = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
    logger.info('尝试触发搜索', { keyword });
    let clicked = false;
    for (const selector of buttonSelectors) {
      try {
        await this.page.click(selector, { timeout: 3000 });
        logger.info('点击搜索按钮成功', { selector });
        clicked = true;
        break;
      } catch (error) {
        logger.debug('搜索按钮点击失败，尝试下一个', { selector, error: error.message });
        continue;
      }
    }
    if (!clicked) {
      logger.warn('未找到搜索按钮，尝试回车提交');
      await this.page.keyboard.press('Enter');
    }
    const newPage = newPagePromise ? await newPagePromise : null;
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
      await newPage.bringToFront().catch(() => null);
      logger.info('检测到新搜索结果页面');
      return newPage;
    }
    await navigationPromise;
    await this.page.waitForTimeout(2000);
    logger.info('搜索结果在当前页面加载');
    return this.page;
  }
  async keyWordSearch(keyword) {
    if (!keyword || !keyword.trim()) {
      logger.warn('关键词为空');
      return JSON.stringify({ success: false, message: '关键词不能为空' });
    }
    const trimmedKeyword = keyword.trim();
    logger.info('=== 开始关键词搜索流程 ===', { keyword: trimmedKeyword });
    try {
      await this.startBrowser();
      const loginResult = await this.loginWithCookies();
      if (!loginResult.success) {
        logger.error('Cookie登录失败', { message: loginResult.message });
        return JSON.stringify({ success: false, message: loginResult.message });
      }
      logger.info('访问淘宝首页');
      await this.page.goto('https://www.taobao.com/');
      await this.page.waitForTimeout(5000);
      const isLoggedIn = await this.checkLoginStatus();
      if (!isLoggedIn) {
        logger.error('登录状态检查失败');
        return JSON.stringify({ success: false, message: '登录状态失效，需要重新登录' });
      }
      logger.info('登录状态验证通过');
      await this.refreshPage();
      const searchPage = await this.inputKeywordAndSearch(trimmedKeyword);
      if (searchPage && searchPage !== this.page) {
        this.page = searchPage;
      }
      logger.info('开始解析搜索结果', { targetNum: 50 });
      const results = await this.extractSearchResults(50);
      this.searchResults = results;
      logger.info('关键词搜索完成，找到商品列表', {
        totalProducts: results.length,
        products: results.map((r) => ({ title: r.title?.substring(0, 30), link: r.link }))
      });
      logger.info('开始爬取评价图片', {
        startIndex: 0,
        judgeNum: 5,
        totalNum: 100,
        productsToProcess: results.length
      });
      const crawlResults = await this.crawlReviewImages(results, 0, 5, 100);

      // 仅返回已成功抓取图片的商品，并统计总图片数
      const enhancedResults = results
        .map((product, index) => {
          const crawlResult = crawlResults.find((r) => r.productIndex === index);
          const imgs = crawlResult ? crawlResult.links : [];
          return { ...product, img_urls: imgs };
        })
        .filter((item) => Array.isArray(item.img_urls) && item.img_urls.length > 0);

      const totalImages = enhancedResults.reduce((sum, item) => sum + item.img_urls.length, 0);
      logger.info('关键词搜索流程完成', {
        totalProducts: results.length,
        productsWithImages: enhancedResults.length,
        totalImages: totalImages
      });
      const response = JSON.stringify(
        {
          success: true,
          data: enhancedResults,
          total: totalImages,
          timestamp: new Date().toISOString()
        },
        null,
        2
      );
      return response;
    } catch (error) {
      logger.error('关键词搜索失败', {
        keyword: trimmedKeyword,
        error: error.message,
        stack: error.stack
      });
      return JSON.stringify({ success: false, message: (error === null || error === void 0 ? void 0 : error.message) || '关键词搜索失败' });
    } finally {
      await this.closeBrowser();
    }
  }
}
exports.KeywordSearchNode = KeywordSearchNode;
