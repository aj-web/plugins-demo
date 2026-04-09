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
exports.ImageSearchNode = void 0;
const playwright_1 = require('playwright');
const path = __importStar(require('path'));
const fs = __importStar(require('fs'));
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
const logger = require('../utils/logger');
class ImageSearchNode {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.searchResults = [];
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
  }
  async startBrowser() {
    try {
      console.log('启动浏览器...');
      const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      console.log('使用Chrome路径:', chromePath);
      const browserArgs = ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-web-security', '--disable-dev-shm-usage', '--disable-gpu'];
      this.browser = await playwright_1.chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: browserArgs
      });
      this.context = await this.browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      this.page = await this.context.newPage();
      console.log('浏览器启动成功');
    } catch (error) {
      console.error('启动浏览器失败:', error);
      throw error;
    }
  }
  async closeBrowser() {
    try {
      console.log('正在关闭浏览器...');
      if (this.page) {
        await this.page.close();
        this.page = null;
        console.log('页面已关闭');
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
        console.log('浏览器上下文已关闭');
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        console.log('浏览器已关闭');
      }
      console.log('浏览器关闭完成');
    } catch (error) {
      console.error('关闭浏览器时出错:', error);
      this.page = null;
      this.context = null;
      this.browser = null;
    }
  }
  async loginWithCookies() {
    try {
      const cookies = this.cookieManager.getCookies('taobao');
      if (cookies.length > 0) {
        await this.context.addCookies(cookies);
        console.log(`已添加 ${cookies.length} 个cookies`);
        return { success: true };
      } else {
        return { success: false, message: '没有可用的cookies' };
      }
    } catch (error) {
      console.error('Cookie登录失败:', error);
      return { success: false, message: error.message };
    }
  }
  async checkLoginStatus() {
    try {
      console.log('开始检查登录状态...');
      if (!this.page) return false;
      const userNick = await this.page.$('.J_UserMemberNick');
      if (userNick) {
        const nickText = await userNick.textContent();
        if (nickText && nickText.trim()) {
          console.log(`发现用户昵称: ${nickText.trim()}`);
          return true;
        }
      }
      const cartElement = await this.page.$('.member-cart strong');
      if (cartElement) {
        const cartText = await cartElement.textContent();
        if (cartText && cartText.trim()) {
          console.log(`发现购物车数量: ${cartText.trim()}`);
          return true;
        }
      }
      const orderElements = await this.page.$$('.member-awaiting strong, .member-delivery strong, .member-nonpayment strong, .member-comment strong');
      if (orderElements.length > 0) {
        for (const element of orderElements) {
          const text = await element.textContent();
          if (text && text.trim() !== '') {
            console.log(`发现订单信息: ${text.trim()}`);
            return true;
          }
        }
      }
      const avatarElement = await this.page.$('.J_UserMemberAvatar');
      if (avatarElement) {
        console.log('发现用户头像区域');
        return true;
      }
      const myTaobaoLink = await this.page.$('a[href*="i.taobao.com"]');
      if (myTaobaoLink) {
        console.log('发现"我的淘宝"链接');
        return true;
      }
      const favoriteLink = await this.page.$('a[href*="favorite.taobao.com"]');
      if (favoriteLink) {
        console.log('发现"收藏夹"链接');
        return true;
      }
      const boughtLink = await this.page.$('a[href*="buyertrade.taobao.com"]');
      if (boughtLink) {
        console.log('发现"已买到"链接');
        return true;
      }
      const footprintLink = await this.page.$('a[href*="footMark"]');
      if (footprintLink) {
        console.log('发现"足迹"链接');
        return true;
      }
      console.log('未找到明确的登录状态标识，默认为未登录');
      return false;
    } catch (error) {
      console.error('检查登录状态时出错:', error);
      return false;
    }
  }
  async refreshPage() {
    try {
      console.log('刷新页面避免弹窗...');
      await this.page.reload();
      await this.page.waitForTimeout(10000);
      try {
        const closeButtons = await this.page.$$('.close, .modal-close, .dialog-close');
        for (const button of closeButtons) {
          try {
            await button.click({ timeout: 1000 });
          } catch (e) {}
        }
      } catch (e) {}
    } catch (error) {
      console.error('刷新页面失败:', error);
    }
  }
  async loadLocalImage(imagePath) {
    try {
      console.log(`加载本地图片: ${imagePath}`);
      if (!fs.existsSync(imagePath)) {
        console.error(`图片文件不存在: ${imagePath}`);
        return null;
      }
      const fileContent = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.bmp':
          mimeType = 'image/bmp';
          break;
        default:
          console.warn(`未知的图片格式: ${ext}，使用默认MIME类型`);
      }
      const fileName = path.basename(imagePath);
      return {
        name: fileName,
        mimeType: mimeType,
        buffer: fileContent
      };
    } catch (error) {
      console.error('加载本地图片失败:', error);
      return null;
    }
  }
  async loadImageByPath(filePath) {
    if (path.isAbsolute(filePath) || filePath.includes(path.sep)) {
      return await this.loadLocalImage(filePath);
    }
    const possiblePaths = [
      filePath,
      path.join(__dirname, filePath),
      path.join(__dirname, '../uploads', filePath),
      path.join(__dirname, '../../uploads', filePath),
      path.join(__dirname, '../temp', filePath),
      path.join(__dirname, '../../temp', filePath),
      path.join(process.cwd(), 'uploads', filePath),
      path.join(process.cwd(), 'temp', filePath)
    ];
    for (const imagePath of possiblePaths) {
      if (fs.existsSync(imagePath)) {
        console.log(`找到图片文件: ${imagePath}`);
        return await this.loadLocalImage(imagePath);
      }
    }
    console.error(`未找到图片文件: ${filePath}`);
    console.log('尝试过的路径:', possiblePaths);
    return null;
  }
  async uploadImageSearch(filePath) {
    console.log('uploadImageSearch', filePath);
    try {
      console.log(`开始图片搜索: ${filePath}`);
      const filePayload = await this.loadImageByPath(filePath);
      if (!filePayload) {
        console.log(`本地图片加载失败: ${filePath}`);
        return false;
      }
      console.log('寻找搜同款按钮...');
      try {
        const pageTitle = await this.page.title();
        const currentUrl = this.page.url();
        console.log(`页面标题: ${pageTitle}`);
        console.log(`当前URL: ${currentUrl}`);
        const pageContent = await this.page.content();
        if (pageContent.includes('搜同款')) {
          console.log('页面中包含"搜同款"文本');
        } else {
          console.log('页面中未找到"搜同款"文本');
        }
      } catch (e) {
        console.log(`获取页面信息失败: ${e}`);
      }
      const searchSameSelectors = [
        '.image-search-icon-outerMode',
        '[data-spm="image_search_icon"]',
        'text="搜同款"',
        '[title="搜同款"]',
        '.search-camera',
        '[data-spm*="camera"]',
        '[class*="camera"]',
        '.image-icon-text'
      ];
      let clicked = false;
      for (const selector of searchSameSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            console.log(`找到元素: ${selector}`);
            try {
              await this.page.evaluate(() => {
                const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                interceptors.forEach((el) => {
                  if (el instanceof HTMLElement) {
                    el.style.pointerEvents = 'none';
                    el.style.display = 'none';
                  }
                });
              });
              console.log('已移除拦截元素');
            } catch {}
            try {
              await this.page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element instanceof HTMLElement) {
                  element.click();
                  return true;
                }
                return false;
              }, selector);
              console.log(`已通过JavaScript点击搜同款按钮: ${selector}`);
              clicked = true;
              break;
            } catch (jsError) {
              console.log(`JavaScript点击失败: ${jsError}`);
              await element.click({ timeout: 3000 });
              console.log(`已点击搜同款按钮: ${selector}`);
              clicked = true;
              break;
            }
          } else {
            console.log(`未找到元素: ${selector}`);
          }
        } catch (e) {
          console.log(`点击 ${selector} 失败: ${e}`);
          continue;
        }
      }
      console.log('等待图片搜索页面加载...');
      await this.page.waitForTimeout(5000);
      const newUrl = this.page.url();
      console.log(`当前页面URL: ${newUrl}`);
      console.log('上传图片...');
      try {
        const ok = await this.uploadImageWithFallback(filePayload);
        if (!ok) {
          console.log('图片上传失败: setInputFiles 多重尝试均未成功');
          return false;
        }
        console.log('图片上传成功');
      } catch (e) {
        console.log(`图片上传失败: ${e}`);
        return false;
      }
      console.log('等待图片上传完成...');
      await this.page.waitForTimeout(5000);
      console.log('执行搜索...');
      const searchButtonSelectors = ['#image-search-upload-button', 'button[type="submit"]', 'text="搜索"', 'text="开始搜索"', '[class*="search"][class*="btn"]', '[class*="submit"]'];
      let searchButtonClicked = false;
      let newPage = null;
      for (const selector of searchButtonSelectors) {
        try {
          const [page] = await Promise.all([this.context.waitForEvent('page'), this.page.click(selector, { timeout: 3000 })]);
          console.log(`已点击搜索按钮: ${selector}`);
          searchButtonClicked = true;
          newPage = page;
          break;
        } catch (e) {
          console.log(`搜索按钮点击失败: ${e}`);
          continue;
        }
      }
      if (!searchButtonClicked) {
        console.log('未找到搜索按钮，尝试按回车键');
        try {
          const [page] = await Promise.all([this.context.waitForEvent('page'), this.page.keyboard.press('Enter')]);
          newPage = page;
        } catch {}
      }
      try {
        console.log('等待搜索结果页面打开...');
        if (newPage) {
          console.log(`新窗口已打开: ${newPage.url()}`);
          this.page = newPage;
          await this.page.waitForTimeout(5000);
        } else {
          console.log('没有新窗口，可能是在当前页面显示结果');
          await this.page.waitForTimeout(5000);
        }
        return true;
      } catch (e) {
        console.log(`等待新窗口超时: ${e}`);
        await this.page.waitForTimeout(5000);
        return true;
      }
    } catch (error) {
      console.error('图片搜索过程出错:', error);
      return false;
    }
  }
  async uploadImageWithFallback(filePayload) {
    try {
      const selectors = ['input[type="file"]', 'input[name="imgfile"]', 'input[accept*="image"]', '[id*="upload"][type="file"]'];
      for (let attempt = 1; attempt <= 3; attempt++) {
        for (const sel of selectors) {
          try {
            const el = await this.page.$(sel);
            if (el) {
              await this.page.setInputFiles(sel, {
                name: filePayload.name,
                mimeType: filePayload.mimeType,
                buffer: filePayload.buffer
              });
              const ok = await this.waitUploadCompleted();
              if (ok) {
                console.log(`通过 setInputFiles 上传成功: ${sel}`);
                return true;
              }
            }
          } catch (e) {}
        }
        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 1000));
      }
      return false;
    } catch (e) {
      console.log(`uploadImageWithFallback 出错: ${e}`);
      return false;
    }
  }
  async waitUploadCompleted() {
    try {
      await Promise.race([
        this.page.waitForSelector('.image-preview, .preview, img[src*="alicdn.com"]', { timeout: 15000 }),
        this.page.waitForResponse((r) => r.url().includes('image_search') && r.ok(), { timeout: 15000 })
      ]);
      return true;
    } catch {
      return false;
    }
  }
  async extractSearchResults(targetNum) {
    try {
      logger.info('开始提取搜索结果', { targetNum, currentUrl: this.page.url() });
      const results = [];
      let taobaoCount = 0;
      let otherCount = 0;
      logger.debug('等待搜索结果页面加载');
      const containerSelectors = ['.tbpc-col.search-content-col', '#content_items_wrapper', '.content-items-wrapper', '.search-result-container', '.items-container', '.product-list'];
      let containerFound = false;
      for (const selector of containerSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          logger.info('找到商品容器', { selector });
          containerFound = true;
          break;
        } catch (e) {
          continue;
        }
      }
      if (!containerFound) {
        logger.error('未找到商品容器', { selectors: containerSelectors });
        return results;
      }
      await this.page.waitForTimeout(5000);
      const itemSelectors = ['.tbpc-col.search-content-col', '.item-card', '.product-item', '.search-item', '[data-spm*="item"]'];
      let items = [];
      for (const selector of itemSelectors) {
        items = await this.page.$$(selector);
        if (items.length > 0) {
          logger.info('找到商品元素', { selector, count: items.length });
          break;
        }
      }
      if (items.length === 0) {
        logger.error('未找到商品元素', { selectors: itemSelectors });
        return results;
      }
      logger.info('开始提取商品信息', { totalItems: items.length, targetNum });
      for (let i = 0; i < items.length; i++) {
        try {
          const linkSelectors = ['a[href*="item.taobao.com"]', 'a[href*="detail.tmall.com"]', 'a[href*="product"]', 'a[href*="item"]'];
          let link = '';
          for (const selector of linkSelectors) {
            try {
              const linkElement = await items[i].$(selector);
              if (linkElement) {
                link = (await linkElement.getAttribute('href')) || '';
                if (link && (link.includes('item.taobao.com') || link.includes('detail.tmall.com'))) {
                  if (link.startsWith('//')) {
                    link = 'https:' + link;
                  } else if (link.startsWith('/')) {
                    link = 'https://item.taobao.com' + link;
                  } else if (!link.startsWith('http')) {
                    link = 'https://' + link;
                  }
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          let productSource = '';
          if (link) {
            if (link.includes('item.taobao.com') && !link.includes('tmall.com')) {
              productSource = '淘宝';
              taobaoCount++;
            } else if (link.includes('tmall.com')) {
              productSource = '天猫';
              taobaoCount++;
            } else {
              productSource = '其他';
              otherCount++;
              logger.debug('未知来源商品，跳过', { index: i + 1, link });
              continue;
            }
          } else {
            logger.debug('商品缺少有效链接，跳过', { index: i + 1 });
            continue;
          }
          const titleSelectors = ['.title--qJ7Xg_90 span', '.title', '.product-title', '.item-title', 'h3', 'h4', '[class*="title"]'];
          let title = '';
          for (const selector of titleSelectors) {
            try {
              const titleElement = await items[i].$(selector);
              if (titleElement) {
                const titleText = await titleElement.innerText();
                if (titleText && titleText.trim()) {
                  title = titleText.trim();
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          const result = {
            rank: results.length + 1,
            title: title,
            link: link,
            source: productSource
          };
          results.push(result);
          logger.debug('商品提取成功', {
            index: results.length,
            title: title.substring(0, 30),
            source: productSource
          });
          if (results.length >= targetNum) {
            logger.info('已达到目标数量，停止提取', { collected: results.length, targetNum });
            break;
          }
        } catch (e) {
          logger.warn('提取商品失败', { index: i + 1, error: e.message });
          continue;
        }
      }
      logger.info('提取结果统计', {
        taobaoProducts: results.length,
        filteredOtherPlatforms: otherCount,
        totalProcessed: taobaoCount + otherCount
      });
      return results;
    } catch (error) {
      logger.error('提取搜索结果失败', { error: error.message, stack: error.stack });
      return [];
    }
  }
  async runSearch(filePath, skuId = null) {
    try {
      console.log('开始执行搜索流程...');
      console.log('filePath', filePath);
      console.log('skuId', skuId);
      await this.startBrowser();
      const loginResult = await this.loginWithCookies();
      if (!loginResult.success) {
        console.log('Cookie登录失败:', loginResult.message);
        return JSON.stringify({ success: false, message: loginResult.message });
      }
      console.log('访问淘宝首页...');
      await this.page.goto('https://www.taobao.com/');
      await this.page.waitForTimeout(5000);
      const isLoggedIn = await this.checkLoginStatus();
      if (!isLoggedIn) {
        console.log('登录状态检查失败');
        return JSON.stringify({ success: false, message: '登录状态失效，需要重新登录' });
      }
      await this.refreshPage();
      let results = [];
      if (skuId) {
        const skuIdList = skuId
          .split(/[\s,;，；、 \n\r]+/)
          .map((id) => id.trim())
          .filter((id) => !!id);
        if (skuIdList.length !== 0) {
          results = skuIdList.map((id, idx) => {
            const productUrl = `https://item.taobao.com/item.htm?id=${id}`;
            return {
              rank: idx + 1,
              title: `商品ID: ${id}`,
              link: productUrl,
              source: '淘宝'
            };
          });
        } else {
          console.log('SKU ID格式无效' + skuId);
        }
        console.log(
          `SKU ID模式：共解析出${skuIdList.length}个SKU，构造商品URL:`,
          results.map((r) => r.link)
        );
      } else if (filePath) {
        console.log('执行图片搜索...');
        const searchSuccess = await this.uploadImageSearch(filePath);
        if (!searchSuccess) {
          return JSON.stringify({ success: false, message: '图片搜索失败' });
        }
        console.log('等待搜索结果加载...');
        await this.page.waitForTimeout(5000);
        results = await this.extractSearchResults(50);
      } else {
        return JSON.stringify({ success: false, message: '请提供图片路径或SKU ID' });
      }
      this.searchResults = results;
      console.log(`搜索完成，找到 ${results.length} 个淘宝商品`);
      console.log('开始爬取评价图片...');
      const crawlResults = await this.crawlReviewImages(results, 0, 5, 200);
      const enhancedResults = results.map((product, index) => {
        const crawlResult = crawlResults.find((r) => r.productIndex === index);
        return {
          ...product,
          img_urls: crawlResult ? crawlResult.links : []
        };
      });
      const jsonResult = JSON.stringify(
        {
          success: true,
          data: enhancedResults,
          total: enhancedResults.length,
          timestamp: new Date().toISOString()
        },
        null,
        2
      );
      console.log('搜索和爬取完成', jsonResult);
      await this.closeBrowser();
      return jsonResult;
    } catch (error) {
      console.error('图片搜索流程出错:', error);
      await this.closeBrowser();
      return JSON.stringify(
        {
          success: false,
          message: error.message,
          timestamp: new Date().toISOString()
        },
        null,
        2
      );
    } finally {
      await this.closeBrowser();
    }
  }
  async crawlReviewImages(searchResults, index = 0, judgeNum = 20, totalNum = 60) {
    logger.info('=== 开始爬取评价图片 ===', {
      startIndex: index,
      judgeNum,
      totalNum,
      totalProducts: searchResults.length
    });
    this.searchResults = searchResults;
    const results = [];
    const imagesPerProduct = 100;
    let validImagesCollected = 0;
    let currentIndex = index;
    logger.info('爬取策略', { imagesPerProduct, judgeNum });
    while (currentIndex < searchResults.length && validImagesCollected < totalNum) {
      const product = searchResults[currentIndex];
      if (!product || !product.link) {
        logger.warn('商品缺少有效链接，跳过', {
          index: currentIndex + 1,
          title: product?.title
        });
        currentIndex++;
        continue;
      }
      logger.info('--- 开始处理商品 ---', {
        index: currentIndex + 1,
        title: product.title?.substring(0, 50),
        link: product.link,
        currentValidImages: validImagesCollected,
        targetImages: totalNum
      });
      try {
        logger.debug('导航到商品页面', { url: product.link });
        await this.page.goto(product.link, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(8000);
        logger.debug('开始爬取商品评价图片', { productIndex: currentIndex + 1 });
        const imageUrls = await this.crawlProductReviewImages(currentIndex + 1, imagesPerProduct);
        const imagesCount = imageUrls.length;
        logger.info('商品评价图片爬取完成', {
          index: currentIndex + 1,
          title: product.title?.substring(0, 30),
          imagesCount,
          judgeNum,
          isValid: imagesCount >= judgeNum
        });
        if (imagesCount > 0) {
          results.push({
            productIndex: currentIndex,
            title: product.title || `商品${currentIndex + 1}`,
            links: imageUrls,
            imagesCount: imagesCount,
            isValid: imagesCount >= judgeNum
          });
          if (imagesCount >= judgeNum) {
            validImagesCollected += imagesCount;
            logger.info('商品达到门槛，计入总数', {
              index: currentIndex + 1,
              imagesCount,
              totalValidImages: validImagesCollected
            });
          } else {
            logger.warn('商品未达门槛，不计入总数', {
              index: currentIndex + 1,
              imagesCount,
              judgeNum
            });
          }
        } else {
          logger.warn('商品未找到任何图片', {
            index: currentIndex + 1,
            title: product.title?.substring(0, 30)
          });
        }
      } catch (error) {
        logger.error('处理商品时出错', {
          index: currentIndex + 1,
          title: product.title?.substring(0, 30),
          error: error.message,
          stack: error.stack
        });
      }
      currentIndex++;
    }
    const validProducts = results.filter((r) => r.isValid).length;
    const invalidProducts = results.filter((r) => !r.isValid).length;
    logger.info('=== 爬取完成统计 ===', {
      totalProcessed: results.length,
      validProducts,
      invalidProducts,
      totalValidImages: validImagesCollected,
      targetImages: totalNum,
      completionRate: `${((validImagesCollected / totalNum) * 100).toFixed(1)}%`,
      usedAllProducts: currentIndex >= searchResults.length,
      reachedTarget: validImagesCollected >= totalNum
    });
    return results;
  }
  async crawlProductReviewImages(productIndex, maxImages) {
    const imageUrls = [];
    try {
      const productLink = this.searchResults[productIndex - 1].link;
      if (!productLink) {
        logger.warn('商品缺少链接', { productIndex });
        return [];
      }
      logger.info('打开商品页面', { productIndex, url: productLink });
      await this.page.goto(productLink, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(8000);
      try {
        await this.page.evaluate(`
                // 移除J_MIDDLEWARE_FRAME_WIDGET拦截元素
                const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                interceptors.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });

                // 移除弹窗遮罩层
                const dialogMasks = document.querySelectorAll('.baxia-dialog-mask, .dialog-mask, .modal-mask');
                dialogMasks.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });

                // 移除弹窗本身
                const dialogs = document.querySelectorAll('.baxia-dialog, .dialog, .modal');
                dialogs.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });
            `);
        logger.debug('已移除拦截元素和弹窗', { productIndex });
        logger.info('尝试点击用户评价标签', { productIndex });
        let clicked = false;
        const selectors = ['#titleTabs .tabTitle--BHerXaZ2', 'text="用户评价"', '[data-spm*="comment"]', '.tabTitle'];
        for (const selector of selectors) {
          try {
            if (selector.startsWith('text=')) {
              await this.page.getByText('用户评价').first().click({ timeout: 3000 });
            } else {
              await this.page.click(selector, { timeout: 3000 });
            }
            logger.info('点击用户评价标签成功', { productIndex, selector });
            clicked = true;
            break;
          } catch (clickError) {
            logger.debug('点击用户评价标签失败，尝试下一个选择器', {
              productIndex,
              selector,
              error: clickError.message
            });
            continue;
          }
        }
        if (!clicked) {
          logger.debug('所有选择器都失败，尝试JavaScript点击', { productIndex });
          try {
            const jsResult = await this.page.evaluate(
              `
                        (text) => {
                            const elements = Array.from(document.querySelectorAll('*'));
                            const targetElement = elements.find(el => 
                                el.textContent && el.textContent.includes(text)
                            );
                            if (targetElement) {
                                targetElement.click();
                                return true;
                            }
                            return false;
                        }
                    `,
              '用户评价'
            );
            if (jsResult) {
              logger.info('通过JavaScript点击用户评价标签成功', { productIndex });
            clicked = true;
            } else {
              logger.warn('JavaScript点击用户评价标签失败：未找到元素', { productIndex });
            }
          } catch (jsError) {
            logger.warn('JavaScript点击用户评价标签异常', {
              productIndex,
              error: jsError.message
            });
          }
        }
        if (!clicked) {
          logger.error('所有点击用户评价标签的方式都失败', { productIndex });
          throw new Error('所有点击方式都失败了');
        }
      } catch (error) {
        logger.error('点击用户评价标签失败', {
          productIndex,
          error: error.message
        });
        return imageUrls;
      }
      await this.page.waitForTimeout(3000);
      logger.info('=== 关键步骤：尝试点击查看全部评价按钮 ===', { productIndex });
      try {
        await this.page.evaluate(`
                // 移除J_MIDDLEWARE_FRAME_WIDGET拦截元素
                const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                interceptors.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });

                // 移除弹窗遮罩层
                const dialogMasks = document.querySelectorAll('.baxia-dialog-mask, .dialog-mask, .modal-mask');
                dialogMasks.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });

                // 移除弹窗本身
                const dialogs = document.querySelectorAll('.baxia-dialog, .dialog, .modal');
                dialogs.forEach(el => {
                    if (el.style) {
                        el.style.pointerEvents = 'none';
                        el.style.display = 'none';
                    }
                });
            `);
        logger.debug('已移除拦截元素和弹窗（点击查看全部评价前）', { productIndex });

        // 检查按钮是否存在
        const buttonExists = await this.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements.some((el) => el.textContent && el.textContent.includes('查看全部评价'));
        });
        logger.info('检查查看全部评价按钮是否存在', { productIndex, buttonExists });

        let clicked = false;
        const selectors = ['text="查看全部评价"', '[data-spm*="comment"]', '.view-all-comments', '.comment-link'];
        logger.info('开始尝试点击查看全部评价按钮', { productIndex, selectors });

        for (const selector of selectors) {
          try {
            if (selector.startsWith('text=')) {
              await this.page.getByText('查看全部评价').first().click({ timeout: 3000 });
            } else {
              await this.page.click(selector, { timeout: 3000 });
            }
            logger.info('点击查看全部评价按钮成功', { productIndex, selector });
            clicked = true;
            break;
          } catch (clickError) {
            logger.debug('点击查看全部评价按钮失败，尝试下一个选择器', {
              productIndex,
              selector,
              error: clickError.message
            });
            continue;
          }
        }
        if (!clicked) {
          logger.warn('所有选择器都失败，尝试JavaScript点击查看全部评价按钮', { productIndex });
          try {
            const jsResult = await this.page.evaluate(
              `
                        (text) => {
                            const elements = Array.from(document.querySelectorAll('*'));
                            const targetElement = elements.find(el => 
                                el.textContent && el.textContent.includes(text)
                            );
                            if (targetElement) {
                                targetElement.click();
                                return true;
                            }
                            return false;
                        }
                    `,
              '查看全部评价'
            );
            if (jsResult) {
              logger.info('通过JavaScript点击查看全部评价按钮成功', { productIndex });
            clicked = true;
            } else {
              logger.error('JavaScript点击查看全部评价按钮失败：未找到元素', { productIndex });
            }
          } catch (jsError) {
            logger.error('JavaScript点击查看全部评价按钮异常', {
              productIndex,
              error: jsError.message
            });
          }
        }
        if (!clicked) {
          logger.error('所有点击查看全部评价按钮的方式都失败', { productIndex });
          throw new Error('查看全部评价按钮点击失败');
        }
      } catch (error) {
        logger.error('点击查看全部评价按钮失败，终止当前商品处理', {
          productIndex,
          error: error.message
        });
        return imageUrls;
      }
      await this.page.waitForTimeout(3000);
      logger.info('等待评价弹窗出现', { productIndex });
      try {
        await this.page.waitForSelector('.Drawer--nzZd5HyY', { timeout: 10000 });
        logger.info('评价弹窗已加载', { productIndex });
      } catch (error) {
        logger.error('评价弹窗未出现，终止当前商品处理', {
          productIndex,
          error: error.message,
          currentUrl: this.page.url()
        });
        return imageUrls;
      }
      logger.info('尝试点击图/视频筛选按钮', { productIndex });
      try {
        const filterButton = this.page.locator('.Drawer--nzZd5HyY .imprItem--fTAkDWa5').filter({ hasText: '图/视频' }).first();
        await filterButton.click();
        logger.info('点击图/视频筛选按钮成功', { productIndex });
      } catch (error) {
        try {
          await this.page.locator('.Drawer--nzZd5HyY').getByText('图/视频').click();
          logger.info('使用备用方法点击图/视频筛选按钮成功', { productIndex });
        } catch (error2) {
          logger.warn('筛选按钮点击失败', { productIndex, error: error2.message });
          return imageUrls;
        }
      }
      await this.page.waitForTimeout(3000);
      logger.info('开始滚动加载评价图片', { productIndex });
      let scrollContainer = await this.page.$('.Drawer--nzZd5HyY .comments--ChxC7GEN');
      if (!scrollContainer) {
        scrollContainer = await this.page.$('.Drawer--nzZd5HyY');
        if (!scrollContainer) {
          logger.error('未找到滚动容器', { productIndex });
          return imageUrls;
        }
      }
      let scrollCount = 0;
      const maxScrolls = 20;
      logger.debug('开始滚动评价列表', { productIndex, maxScrolls });
      while (scrollCount < maxScrolls) {
        scrollCount++;
        const scrollInfo = await scrollContainer.evaluate((el) => ({
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }));
        const before = scrollInfo.scrollTop;
        const maxScroll = scrollInfo.scrollHeight - scrollInfo.clientHeight;
        if (before >= maxScroll - 10) {
          logger.debug('已滚动到底部', { productIndex, scrollCount, scrollTop: before, maxScroll });
          break;
        }
        await scrollContainer.evaluate((el, clientHeight) => {
          el.scrollTop += clientHeight;
        }, scrollInfo.clientHeight);
        await this.page.waitForTimeout(800);
        const after = await scrollContainer.evaluate((el) => el.scrollTop);
        if (after - before < 10) {
          logger.debug('滚动步进太小，已到底部', { productIndex, scrollCount, before, after });
          break;
        }
      }
      logger.info('滚动完成', { productIndex, scrollCount });
      logger.debug('回到顶部', { productIndex });
      try {
        const beforeScroll = await scrollContainer.evaluate((element) => element.scrollTop);
        await scrollContainer.evaluate((element) => (element.scrollTop = 0));
        await this.page.waitForTimeout(1000);
        const afterScroll = await scrollContainer.evaluate((element) => element.scrollTop);
        if (afterScroll === 0) {
          logger.debug('成功回到顶部', { productIndex });
        } else {
          logger.warn('未完全回到顶部', { productIndex, afterScroll });
        }
      } catch (error) {
        logger.warn('回到顶部失败', { productIndex, error: error.message });
      }
      await this.page.waitForTimeout(2000);
      logger.info('开始解析所有评价图片', { productIndex });
      let comments = [];
      try {
        comments = await this.page.$$('.Drawer--nzZd5HyY .Comment--H5QmJwe9');
        if (comments.length === 0) {
          comments = await this.page.$$('.Drawer--nzZd5HyY .comments--ChxC7GEN .Comment--H5QmJwe9');
        }
        logger.info('找到评价条数', { productIndex, commentsCount: comments.length });
      } catch (error) {
        logger.error('获取评价失败', { productIndex, error: error.message });
        return imageUrls;
      }
      logger.debug('开始提取图片URL', { productIndex });
      let validImageCount = 0;
      let skippedImageCount = 0;
      for (let commentIndex = 0; commentIndex < comments.length; commentIndex++) {
        const comment = comments[commentIndex];
        try {
          const album = await comment.$('.album--sq8vrGV3');
          if (!album) {
            continue;
          }
          let imgElements = await album.$$('.photo--ZUITAPZq.cover--RMqEO6_9 img');
          if (imgElements.length === 0) {
            imgElements = await album.$$('img');
          }
          for (const imgElement of imgElements) {
            try {
              const imgSrc = await imgElement.getAttribute('src');
              let processedImgSrc = imgSrc;
              if (imgSrc && imgSrc.startsWith('//')) {
                processedImgSrc = 'https:' + imgSrc;
              } else if (imgSrc && !imgSrc.startsWith('http')) {
                processedImgSrc = 'https://' + imgSrc;
              }
              const placeholderUrls = [
                'https://img.alicdn.com/imgextra/i2/O1CN01Dqo1gd1wMhnobvRco_!!6000000006294-2-tps-145-145.png',
                '//img.alicdn.com/imgextra/i2/O1CN01Dqo1gd1wMhnobvRco_!!6000000006294-2-tps-145-145.png'
              ];
              const isValidImage =
                processedImgSrc &&
                typeof processedImgSrc === 'string' &&
                !placeholderUrls.includes(processedImgSrc) &&
                !processedImgSrc.endsWith('2-tps-145-145.png') &&
                (processedImgSrc.includes('rate.jpg') || processedImgSrc.includes('tbbala.jpg') || processedImgSrc.includes('rate.jpg_960x960.jpg_.webp'));
              if (isValidImage && processedImgSrc) {
                if (!imageUrls.includes(processedImgSrc)) {
                  imageUrls.push(processedImgSrc);
                  validImageCount++;
                } else {
                  skippedImageCount++;
                }
              } else {
                skippedImageCount++;
              }
            } catch (error) {
              skippedImageCount++;
              continue;
            }
          }
        } catch (error) {
          continue;
        }
      }
      logger.info('图片解析完成', {
        productIndex,
        totalImages: imageUrls.length,
        validImages: validImageCount,
        skippedImages: skippedImageCount
      });
      if (maxImages !== undefined && maxImages > 0 && imageUrls.length > maxImages) {
        const truncatedUrls = imageUrls.slice(0, maxImages);
        logger.debug('截取图片', { productIndex, maxImages, total: imageUrls.length });
        return truncatedUrls;
      }
      return imageUrls;
    } catch (error) {
      logger.error('爬取商品评价图片失败', { productIndex, error: error.message, stack: error.stack });
      return imageUrls;
    }
  }
}
exports.ImageSearchNode = ImageSearchNode;
