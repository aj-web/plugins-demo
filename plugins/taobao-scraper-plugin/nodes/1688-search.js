'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Search1688Node = void 0;
const playwright_1 = require('playwright');
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
class Search1688Node {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.searchResults = [];
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
  }
  async startSearch(filePath, skuId = null) {
    try {
      console.log('开始1688搜索流程...');
      console.log('filePath', filePath);
      console.log('skuId', skuId);
      const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      console.log('使用Chrome路径:', chromePath);
      this.browser = await playwright_1.chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--enable-features=CanvasOopRasterization',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors',
          '--disable-extensions-except',
          '--disable-plugins-discovery',
          '--enable-unsafe-swiftshader',
          '--enable-webgl',
          '--enable-webgl2',
          '--use-gl=swiftshader',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      this.context = await this.browser.newContext({
        userAgent: this.getRandomUserAgent(),
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        javaScriptEnabled: true,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai'
      });
      this.page = await this.context.newPage();
      const cookies = await this.cookieManager.getCookies('1688');
      if (cookies && cookies.length > 0) {
        await this.context.addCookies(cookies);
        console.log('已加载1688 cookies，数量:', cookies.length);
      } else {
        console.log('未找到1688 cookies，需要先登录');
        return JSON.stringify({ success: false, message: '未找到1688 cookies，请先登录' });
      }
      console.log('访问1688首页验证登录状态...');
      await this.page.goto('https://www.1688.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await this.page.waitForTimeout(10000);
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        console.log('1688登录成功，开始图片搜索流程...');
        const searchResult = await this.performImageSearch(filePath, skuId);
        console.log('1688图片搜索结果:', searchResult);
        return searchResult;
      } else {
        console.log('1688登录失败，cookies可能已过期');
        return JSON.stringify({ success: false, message: '1688登录失败，cookies可能已过期，请重新登录' });
      }
    } catch (error) {
      console.error('启动1688搜索失败:', error);
      return JSON.stringify({ success: false, message: error.message });
    }
  }
  async checkLoginStatus() {
    try {
      const isLoggedIn = await this.page.evaluate(() => {
        console.log('查找用户卡片元素');
        const userCard = document.querySelector('.userCard--rUaD9E7Q');
        if (!userCard) {
          console.log('未找到用户卡片元素');
          return false;
        }
        console.log('找到用户卡片元素');
        const nickElement = userCard.querySelector('.nick--rUaD9E7Q') || userCard.querySelector('[class*="nick"]') || userCard.querySelector('span') || userCard;
        if (!nickElement) {
          console.log('未找到用户名元素');
          return false;
        }
        const nickText = nickElement.textContent || '';
        console.log('检测到的用户名文本:', nickText);
        const isLoggedIn = !nickText.includes('1688买家') && !nickText.includes('登录') && nickText.length > 0;
        console.log('登录状态判断结果:', isLoggedIn);
        return isLoggedIn;
      });
      console.log('1688登录状态检查结果:', isLoggedIn);
      return isLoggedIn;
    } catch (error) {
      console.error('检查1688登录状态失败:', error);
      return false;
    }
  }
  async performImageSearch(filePath, skuId) {
    try {
      console.log('开始执行图片搜索...');
      const allResults = [];
      if (skuId) {
        const skuIdList = skuId
          .split(/[\s,;，；、 \n\r]+/)
          .map((id) => id.trim())
          .filter((id) => !!id);
        if (skuIdList.length !== 0) {
          const results = skuIdList.map((id, idx) => {
            const productUrl = `https://detail.1688.com/offer/${id}.html`;
            return {
              rank: idx + 1,
              title: `商品ID: ${id}`,
              url: productUrl,
              offerId: id,
              source: '1688'
            };
          });
          allResults.push(...results);
          console.log(
            `SKU ID模式：共解析出${skuIdList.length}个SKU，构造商品URL:`,
            results.map((r) => r.url)
          );
        } else {
          console.log('SKU ID格式无效' + skuId);
        }
      }
      if (filePath) {
        console.log('执行图片搜索...');
        await this.page.waitForTimeout(2000);
        console.log('定位以图搜款按钮...');
        const imageSearchButton = await this.page.$('.image-upload-button-container');
        if (!imageSearchButton) {
          throw new Error('未找到以图搜款按钮');
        }
        console.log('点击以图搜款按钮，等待文件选择器...');
        const [fileChooser] = await Promise.all([this.page.waitForEvent('filechooser'), imageSearchButton.click()]);
        console.log('文件选择器已出现');
        console.log('开始上传图片文件:', filePath);
        await fileChooser.setFiles(filePath);
        console.log('图片文件上传成功');
        await this.page.waitForTimeout(3000);
        console.log('查找搜索图片按钮...');
        const searchButton =
          (await this.page.$('.search-btn')) ||
          (await this.page.$('[data-tracker="pasteImagePreview"]')) ||
          (await this.page.$('div.search-btn')) ||
          (await this.page.$('button:has-text("搜索图片")')) ||
          (await this.page.$('button:has-text("搜索")')) ||
          (await this.page.$('[class*="search"] button')) ||
          (await this.page.$('button[type="submit"]'));
        if (!searchButton) {
          throw new Error('未找到搜索图片按钮');
        }
        console.log('点击搜索图片按钮，等待新窗口...');
        const [newPage] = await Promise.all([this.context.waitForEvent('page'), searchButton.click()]);
        console.log('已点击搜索图片按钮');
        console.log('等待搜索结果页面加载...');
        await this.page.waitForTimeout(10000);
        console.log('等待搜索结果页面打开...');
        if (newPage) {
          console.log(`新窗口已打开: ${newPage.url()}`);
          this.page = newPage;
          await this.page.waitForTimeout(5000);
          const searchUrl = this.page.url();
          console.log('搜索结果页面URL:', searchUrl);
          const extractResult = await this.extractProductUrls(50);
          const imageResults = extractResult.map((item, index) => ({
            ...item,
            rank: allResults.length + index + 1
          }));
          allResults.push(...imageResults);
          console.log(`图片搜索完成，找到 ${imageResults.length} 个商品`);
        } else {
          console.log('没有新窗口，可能是在当前页面显示结果');
          const currentUrl = this.page.url();
          console.log('当前页面URL:', currentUrl);
          if (allResults.length === 0) {
            return JSON.stringify({
              success: false,
              message: '图片搜索完成，但没有找到任何商品'
            });
          }
        }
      }
      if (allResults.length === 0) {
        return JSON.stringify({
          success: false,
          message: '图片搜索完成，但没有找到任何商品'
        });
      }
      console.log(`开始爬取评价图片，总共 ${allResults.length} 个商品...`);
      const crawlResults = await this.crawlReviewImages(allResults, 0, 5, 200);
      const enhancedResults = allResults.map((product, index) => {
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
      return jsonResult;
    } catch (error) {
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
  async extractProductUrls(count = 15) {
    try {
      console.log(`开始提取商品URL,目标数量: ${count}`);
      await this.page.waitForTimeout(3000);
      const results = await this.page.evaluate((targetCount) => {
        const results = [];
        // 兼容新版结构：卡片是 div.searchOfferWrapper--xxx，挂在 #offer-list-content 下
        const productCards = document.querySelectorAll('#offer-list-content .searchOfferWrapper--lmbrqOXR, #offer-list a.searchOfferWrapper--lmbrqOXR, #offer-list-content [data-tracker="offer"]');
        console.log(`找到 ${productCards.length} 个商品卡片（可能包含广告）`);
        let skippedAds = 0;
        for (let i = 0; i < productCards.length && results.length < targetCount; i++) {
          const card = productCards[i];
          try {
            let href = card.getAttribute('href') || '';

            // 新版结构下，卡片是 div，需要从内部或属性中推导出商品链接
            if (!href) {
              const innerLink = card.querySelector('a[href*="detail.1688.com/offer/"]');
              if (innerLink) {
                href = innerLink.getAttribute('href') || innerLink.href || '';
              }
            }

            let offerId = '';
            // 优先从 data-offer-id 读取
            if (card.getAttribute('data-offer-id')) {
              offerId = card.getAttribute('data-offer-id');
            }

            // 其次从 data-extra（旺旺锚点上的 JSON）里解析 offerId
            if (!offerId) {
              const extraEl = card.querySelector('[data-extra]');
              if (extraEl) {
                try {
                  const extraRaw = extraEl.getAttribute('data-extra') || '';
                  const extra = extraRaw ? JSON.parse(extraRaw) : null;
                  if (extra && extra.offerId) {
                    offerId = extra.offerId;
                  }
                } catch (e) {
                  console.log('解析 data-extra 失败:', e);
                }
              }
            }

            // 再次从 data-splus-exp-url 追踪串中解析 object_id@{offerId}
            if (!offerId && card.getAttribute('data-splus-exp-url')) {
              const expUrl = card.getAttribute('data-splus-exp-url') || '';
              const match = expUrl.match(/object_id@(\d+)/);
              if (match && match[1]) {
                offerId = match[1];
              }
            }

            // 如果还没有 href，但拿到了 offerId，则自行构造详情页链接
            if ((!href || !href.includes('detail.1688.com/offer/')) && offerId) {
              href = `https://detail.1688.com/offer/${offerId}.html`;
            }

            if (!href) {
              console.log(`商品 #${i + 1} 未能解析出有效链接，跳过`);
              continue;
            }

            // 广告判断：老逻辑保留，兼容以防 href 依然是广告落地页
            if (href.includes('dj.1688.com/ci_bb')) {
              skippedAds++;
              console.log(`跳过广告商品 #${i + 1}`);
              continue;
            }

            if (!href.includes('detail.1688.com/offer/')) {
              console.log(`商品 #${i + 1} 不是有效商品链接，跳过`);
              continue;
            }

            const titleElement = card.querySelector('.titleText--TB6mnS3m div');
            const title = titleElement ? titleElement.textContent?.trim() || '' : '';
            const result = {
              rank: results.length + 1,
              title: title || `1688商品${results.length + 1}`,
              url: href
            };
            results.push(result);
            console.log(`提取第 ${result.rank} 个商品: ${result.title}`);
          } catch (err) {
            console.error(`处理第 ${i + 1} 个商品卡片时出错:`, err);
          }
        }
        console.log(`共跳过 ${skippedAds} 个广告商品`);
        return results;
      }, count);
      console.log(`成功提取 ${results.length} 个普通商品URL`);
      return results;
    } catch (error) {
      console.error('提取商品URL失败:', error);
      return [];
    }
  }
  async crawlReviewImages(searchResults, index = 0, judgeNum = 20, totalNum = 60) {
    console.log(`开始爬取1688评价图片，起始索引: ${index}，单品门槛: ${judgeNum}张，总目标: ${totalNum}张`);
    this.searchResults = searchResults;
    const results = [];
    const imagesPerProduct = 20;
    let validImagesCollected = 0;
    let currentIndex = index;
    console.log(`策略：每个商品爬取 ${imagesPerProduct} 张图片，>= ${judgeNum} 张才计入总数`);
    while (currentIndex < searchResults.length && validImagesCollected < totalNum) {
      const product = searchResults[currentIndex];
      if (!product || !product.url) {
        console.log(`第 ${currentIndex + 1} 个商品没有有效链接，跳过`);
        currentIndex++;
        continue;
      }
      console.log(`\n正在处理第 ${currentIndex + 1} 个1688商品: ${product.title || '未知商品'}`);
      console.log(`当前有效图片: ${validImagesCollected}/${totalNum}`);
      try {
        console.log('访问商品详情页...');
        await this.page.goto(product.url, { waitUntil: 'domcontentloaded' });
        const randomWaitTime = Math.floor(Math.random() * 3000) + 3000;
        console.log(`随机等待 ${randomWaitTime}ms...`);
        await this.page.waitForTimeout(randomWaitTime);
        const imageUrls = await this.crawlProductReviewImages(currentIndex + 1, imagesPerProduct);
        const imagesCount = imageUrls.length;
        if (imagesCount > 0) {
          const result = {
            productIndex: currentIndex,
            title: product.title || `商品${currentIndex + 1}`,
            links: imageUrls,
            imagesCount: imagesCount
          };
          if (imagesCount >= judgeNum) {
            validImagesCollected += imagesCount;
            results.push(result);
            console.log(`第 ${currentIndex + 1} 个商品完成，获得 ${imagesCount} 张图片（达到门槛），累计有效 ${validImagesCollected} 张`);
          } else {
            results.push(result);
            console.log(`第 ${currentIndex + 1} 个商品完成，获得 ${imagesCount} 张图片（未达门槛 ${judgeNum}），不计入总数`);
          }
        } else {
          console.log(`第 ${currentIndex + 1} 个商品没有找到图片，跳过`);
        }
      } catch (error) {
        console.error(`处理第 ${currentIndex + 1} 个商品时出错:`, error);
      }
      currentIndex++;
    }
    const validProducts = results.filter((r) => r.imagesCount >= judgeNum).length;
    const invalidProducts = results.filter((r) => r.imagesCount < judgeNum).length;
    console.log(`\n1688爬取完成统计:`);
    console.log(`  处理商品总数: ${results.length} 个`);
    console.log(`  达到门槛商品: ${validProducts} 个`);
    console.log(`  未达门槛商品: ${invalidProducts} 个`);
    console.log(`  有效图片总数: ${validImagesCollected} 张`);
    console.log(`  目标完成度: ${validImagesCollected}/${totalNum} (${((validImagesCollected / totalNum) * 100).toFixed(1)}%)`);
    if (currentIndex >= searchResults.length) {
      console.log(`  已用完所有 ${searchResults.length} 个商品`);
    }
    if (validImagesCollected >= totalNum) {
      console.log(`  已达到目标图片数量`);
    }
    console.log(`爬取结果:`, results);
    console.log(`总共处理了 ${results.length} 个商品，收集了 ${validImagesCollected} 张有效图片`);
    return results;
  }
  async crawlProductReviewImages(productIndex, maxImages) {
    console.log(`开始爬取商品 ${productIndex} 的评价图片，目标数量: ${maxImages}`);
    try {
      console.log('第一步：查找并点击"查看全部评价"按钮...');
      await this.page.waitForTimeout(2000);
      const selectors = [
        '#productEvaluation > div > div.collapse-body > div.evaluation-list > div.evaluation-more',
        '.evaluation-more',
        'button:has-text("查看全部评价")',
        '[data-spm-anchor-id*="viewAllReviews"]',
        '.ant-btn:has-text("查看全部评价")'
      ];
      let buttonClicked = false;
      for (const selector of selectors) {
        try {
          console.log(`尝试选择器: ${selector}`);
          const button = await this.page.$(selector);
          if (button) {
            console.log(`找到"查看全部评价"按钮，使用选择器: ${selector}`);
            await button.scrollIntoViewIfNeeded();
            await this.page.waitForTimeout(1000);
            await button.click();
            console.log('成功点击"查看全部评价"按钮');
            buttonClicked = true;
            break;
          }
        } catch (error) {
          console.log(`选择器 ${selector} 失败: ${error}`);
          continue;
        }
      }
      if (!buttonClicked) {
        console.log('未找到"查看全部评价"按钮，可能页面结构不同或按钮不存在');
      }
      console.log('等待评价内容加载...');
      await this.page.waitForTimeout(3000);
      console.log('第二步：点击"有图"按钮筛选包含图片的评价...');
      await this.page.waitForTimeout(2000);
      const imageFilterSelectors = ['.evaluate-panel-categorize button:has-text("有图")', '.select-categorize button:has-text("有图")', 'button:has-text("有图")', '.ant-btn:has-text("有图")'];
      let imageFilterClicked = false;
      for (const selector of imageFilterSelectors) {
        try {
          console.log(`尝试选择器: ${selector}`);
          const imageFilterButton = await this.page.$(selector);
          if (imageFilterButton) {
            console.log(`找到"有图"按钮，使用选择器: ${selector}`);
            await imageFilterButton.scrollIntoViewIfNeeded();
            await this.page.waitForTimeout(1000);
            await imageFilterButton.click();
            console.log('成功点击"有图"按钮');
            imageFilterClicked = true;
            break;
          }
        } catch (error) {
          console.log(`选择器 ${selector} 失败: ${error}`);
          continue;
        }
      }
      if (!imageFilterClicked) {
        console.log('未找到"有图"按钮，可能页面结构不同或按钮不存在，跳过当前商品');
        return [];
      }
      console.log('等待筛选结果加载...');
      await this.page.waitForTimeout(3000);
      console.log('第三步：开始提取评价图片URL...');
      const allImageUrls = [];
      let currentPage = 1;
      const maxPages = 3;
      while (currentPage <= maxPages && allImageUrls.length < maxImages) {
        console.log(`正在处理第 ${currentPage} 页...`);
        const pageImageUrls = await this.page.evaluate(() => {
          const imageUrls = [];
          const imageElements = document.querySelectorAll('.evaluate-images .ant-image-img');
          imageElements.forEach((img) => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('//')) {
              imageUrls.push('https:' + src);
            } else if (src && src.startsWith('http')) {
              imageUrls.push(src);
            }
          });
          return imageUrls;
        });
        console.log(`第 ${currentPage} 页找到 ${pageImageUrls.length} 张图片`);
        allImageUrls.push(...pageImageUrls);
        if (allImageUrls.length >= maxImages) {
          break;
        }
        if (currentPage < maxPages) {
          try {
            console.log('尝试点击下一页...');
            await this.page.waitForTimeout(2000);
            const nextPageSelectors = [
              'li.ant-pagination-next:not(.ant-pagination-disabled) button',
              '.ant-pagination-next:not(.ant-pagination-disabled) button',
              'li[title="下一页"] button',
              '.ant-pagination-next button[type="button"]',
              '.ant-pagination-next button:not([disabled])',
              '.ant-pagination-next .ant-pagination-item-link'
            ];
            let nextPageClicked = false;
            for (const selector of nextPageSelectors) {
              try {
                const nextButton = await this.page.$(selector);
                if (nextButton) {
                  console.log(`找到下一页按钮，使用选择器: ${selector}`);
                  const isClickable = await this.page.evaluate((button) => {
                    if (button.disabled || button.getAttribute('disabled')) {
                      return false;
                    }
                    const parentLi = button.closest('li');
                    if (parentLi && parentLi.getAttribute('aria-disabled') === 'true') {
                      return false;
                    }
                    const style = window.getComputedStyle(button);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                      return false;
                    }
                    return true;
                  }, nextButton);
                  if (!isClickable) {
                    console.log('下一页按钮不可点击（可能只有一页），跳过当前商品');
                    nextPageClicked = false;
                    break;
                  }
                  await nextButton.scrollIntoViewIfNeeded();
                  await this.page.waitForTimeout(1000);
                  await nextButton.click();
                  console.log('成功点击下一页');
                  nextPageClicked = true;
                  await this.page.waitForTimeout(3000);
                  break;
                }
              } catch (error) {
                console.log(`选择器 ${selector} 失败: ${error}`);
                continue;
              }
            }
            if (!nextPageClicked) {
              console.log('未找到下一页按钮或按钮不可点击，停止翻页');
              break;
            }
          } catch (error) {
            console.log(`翻页失败: ${error.message}`);
            break;
          }
        }
        currentPage++;
      }
      const result = allImageUrls.slice(0, maxImages);
      console.log(`总共提取到 ${allImageUrls.length} 张图片，返回 ${result.length} 张`);
      return result;
    } catch (error) {
      console.error(`爬取商品 ${productIndex} 评价图片失败:`, error);
      return [];
    }
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
      console.log('1688搜索浏览器已关闭');
    } catch (error) {
      console.error('关闭1688搜索浏览器失败:', error);
    }
  }
  getRandomUserAgent() {
    const uaList = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.5112.79 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    return uaList[Math.floor(Math.random() * uaList.length)];
  }
}
exports.Search1688Node = Search1688Node;
