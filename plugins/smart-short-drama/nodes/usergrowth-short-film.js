/**
 * UserGrowth（墨攻平台）短剧数据爬取
 * 负责从墨攻平台获取短剧数据
 */

// 统一日志初始化
require('./logger-init');

const { BrowserManager } = require('../utils/browser-manager');
const FileCookieStore = require('../utils/file-cookie-store');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class UserGrowthShortFilmNode {
  constructor(browserManager = null) {
    this.cookieFileName = 'usergrowth_cookie.json';
    // 如果传入了 browserManager，使用传入的，否则创建新的
    this.browserManager = browserManager || new BrowserManager();
    this.cookieManager = GlobalCookieManager.getInstance();
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.browser = null;
    this.context = null;
    this.page = null;
    this.capturedRequests = []; // 存储捕获的网络请求
    this.lastCapturedVideoUrl = '';

    // UserGrowth URLs
    this.baseUrl = 'https://usergrowth.com.cn/';
    this.targetUrl = 'https://usergrowth.com.cn/open/customer';

    console.log('[UserGrowthShortFilm] 节点已初始化');
  }

  /**
   * 批量处理墨攻平台剧目
   * @param {string[]} dramaNames - 剧目名称数组
   * @param {string} outputPath - 输出路径
   * @returns {Promise<Object>} { "短剧A": "filepath", "短剧B": "filepath" }
   */
  async processUserGrowthDramas(dramaNames, outputPath) {
    const results = {};
    const succDramas = [];
    const failedDramas = [];
    const originalCounts = {}; // 新增：记录每部剧的集数

    try {
      console.log(`[UserGrowthShortFilm] 开始批量处理墨攻平台剧目，共 ${dramaNames.length} 部`);

      // 检查登录状态
      const loginCheck = await this.checkUserGrowthLogin();
      if (!loginCheck.success) {
        console.error('[UserGrowthShortFilm] UserGrowth 未登录，跳过处理');
        // 返回空结果（不添加任何短剧）
        return {
          results: results,
          succDramas: succDramas,
          failedDramas: failedDramas,
          originalCounts: originalCounts
        };
      }

      // 初始化浏览器
      await this.initBrowser();

      // 步骤1: 初始化页面（首次访问 + 导航步骤）
      await this.initializePage();

      // 遍历处理每个剧目
      for (let i = 0; i < dramaNames.length; i++) {
        const dramaName = dramaNames[i];
        console.log(`[UserGrowthShortFilm] 处理墨攻剧目 ${i + 1}/${dramaNames.length}: ${dramaName}`);

        try {
          // 传入 dedupeExpireDays 参数（默认30天）
          const dedupeExpireDays = 30;
          const result = await this.processSingleUserGrowthDrama(dramaName, outputPath, dedupeExpireDays);
          // 只有获取到文件路径才添加到结果中
          if (result && result.filepath) {
            results[dramaName] = result.filepath;
            originalCounts[dramaName] = result.episodeCount; // 记录集数
            succDramas.push(dramaName);
            console.log(`[UserGrowthShortFilm] 剧目 ${dramaName} 处理成功: ${result.filepath}, 集数: ${result.episodeCount}`);
          } else {
            failedDramas.push(dramaName);
            console.error(`[UserGrowthShortFilm] 剧目 ${dramaName} 处理失败: 没有获取到文件路径`);
          }
        } catch (error) {
          failedDramas.push(dramaName);
          console.error(`[UserGrowthShortFilm] 剧目 ${dramaName} 处理异常:`, error);
          // 失败时不添加到结果中，直接跳过进入下一个循环
        }

        // 步骤7: 如果不是最后一个剧目，重新初始化页面，准备处理下一个剧目
        if (i < dramaNames.length - 1) {
          console.log(`[UserGrowthShortFilm] 准备处理下一个剧目，重新初始化页面...`);
          try {
            await this.reinitializePage();
          } catch (error) {
            console.error(`[UserGrowthShortFilm] 重新初始化页面失败:`, error);
            // 如果初始化失败，尝试继续处理下一个剧目
          }
        }
      }

      // 关闭浏览器
      await this.safeCloseAll();

      return {
        results: results, // { "短剧A": "filepath", "短剧B": "filepath" }
        succDramas: succDramas, // ["短剧A", "短剧B"]
        failedDramas: failedDramas, // ["短剧C"]
        originalCounts: originalCounts // { "短剧A": 75, "短剧B": 60 }
      };
    } catch (error) {
      console.error('[UserGrowthShortFilm] 批量处理墨攻平台剧目失败:', error);
      await this.safeCloseAll();
      // 即使出错也返回已处理的结果
      return {
        results: results,
        succDramas: succDramas,
        failedDramas: failedDramas,
        originalCounts: originalCounts
      };
    }
  }

  /**
   * 初始化页面（首次访问 + 导航步骤）
   */
  async initializePage() {
    console.log('[UserGrowthShortFilm] 初始化页面...');

    // 访问目标页面
    console.log('[UserGrowthShortFilm] 访问目标页面...');
    await this.page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 执行导航步骤
    await this.navigateToTargetPage();
  }

  /**
   * 重新初始化页面（不刷新页面，直接返回到搜索状态）
   */
  async reinitializePage() {
    console.log('[UserGrowthShortFilm] 重新初始化页面...');
    
    // 尝试返回到搜索列表页面，而不是刷新
    try {
      // 方法1: 尝试点击返回按钮
      const goBack = await this.page.$('.arco-btnarco-btn-icon-only');
      if (goBack) {
        await goBack.click();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log('[UserGrowthShortFilm] 已点击返回按钮');
      }
    } catch (e) {
      // 返回失败，继续尝试其他方法
    }
    
    // 检查当前是否已经在搜索页面
    const searchInput = await this.page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      console.log('[UserGrowthShortFilm] 已在搜索页面，清空搜索框...');
      await searchInput.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      // 清空搜索框
      await this.page.keyboard.press('Control+a');
      await this.page.keyboard.press('Backspace');
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }
    
    // 如果不在搜索页面，刷新并重新导航
    console.log('[UserGrowthShortFilm] 不在搜索页面，刷新页面...');
    await this.page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // 执行导航步骤
    await this.navigateToTargetPage();
  }

  /**
   * 导航到目标页面（执行所有导航步骤）
   */
  async navigateToTargetPage() {
    console.log('[UserGrowthShortFilm] 执行导航步骤...');

    // 步骤1: 检查并处理活动弹窗
    await this.handleActivityPopup();

    // 步骤2: 点击"进入"按钮
    await this.clickEnterButton();

    // 步骤3: 点击"墨攻AI"按钮
    await this.clickMoGongAIButton();

    // 步骤4: 点击"选品灵感" → "短剧选剧"
    await this.clickShortDramaSelection();

    // 步骤5: 点击"番茄短剧" → "全部上架剧"
    await this.clickTomatoDrama();

    console.log('[UserGrowthShortFilm] 导航步骤完成');
  }

  /**
   * 检查是否已下载该剧目（去重）
   * @param {string} dramaName - 剧目名称
   * @param {string} outputPath - 输出路径
   * @param {number} dedupeExpireDays - 去重天数（默认30天）
   * @returns {Object|null} 如果已存在，返回 { filepath, episodeCount }，否则返回 null
   */
  checkExistingDownload(dramaName, outputPath, dedupeExpireDays = 30) {
    const fs = require('fs');
    const path = require('path');

    try {
      // 检查输出目录是否存在
      if (!fs.existsSync(outputPath)) {
        return null;
      }

      // 获取所有文件和文件夹
      const items = fs.readdirSync(outputPath);

      // 查找以"短剧名"开头的文件夹（直接匹配或带时间戳）
      const matchingFolders = items.filter((item) => {
        const itemPath = path.join(outputPath, item);
        const isDirectory = fs.statSync(itemPath).isDirectory();
        // 匹配 "短剧名" 或 "短剧名_时间戳" 格式
        return isDirectory && (item === dramaName || item.startsWith(`${dramaName}_`));
      });

      if (matchingFolders.length === 0) {
        console.log(`[UserGrowthShortFilm] 未找到 ${dramaName} 的已下载文件夹`);
        return null;
      }

      console.log(`[UserGrowthShortFilm] 找到 ${matchingFolders.length} 个匹配的文件夹: ${matchingFolders.join(', ')}`);

      // 遍历所有匹配的文件夹，检查是否满足去重条件
      for (const folderName of matchingFolders) {
        // 提取时间戳（如果有的话）
        const timestampMatch = folderName.match(/_(\d+)$/);
        let folderDate = null;
        let daysDiff = 0;

        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          folderDate = new Date(timestamp);
          const now = new Date();
          daysDiff = (now.getTime() - folderDate.getTime()) / (1000 * 60 * 60 * 24);

          console.log(`[UserGrowthShortFilm] 文件夹 ${folderName}:`);
          console.log(`[UserGrowthShortFilm]   下载时间: ${folderDate.toLocaleString()}`);
          console.log(`[UserGrowthShortFilm]   距今天数: ${daysDiff.toFixed(1)} 天`);

          // 判断1: 如果超过去重天数，跳过该文件夹
          if (daysDiff > dedupeExpireDays) {
            console.log(`[UserGrowthShortFilm]   超过 ${dedupeExpireDays} 天，视为过期，继续检查下一个文件夹`);
            continue;
          }
        } else {
          // 如果没有时间戳，直接检查（视为新格式）
          console.log(`[UserGrowthShortFilm] 文件夹 ${folderName}:`);
          console.log(`[UserGrowthShortFilm]   无时间戳，视为当前文件夹`);
        }

        // 判断2: 检查文件夹内的视频文件数量
        const folderPath = path.join(outputPath, folderName);
        const files = fs.readdirSync(folderPath);
        const videoFiles = files.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
        });

        const videoCount = videoFiles.length;
        console.log(`[UserGrowthShortFilm]   视频文件数量: ${videoCount}`);

        // 判断3: 如果文件数量 >= 10，认为已下载完整
        if (videoCount >= 10) {
          console.log(`[UserGrowthShortFilm]   文件数量满足条件（>= 10），跳过下载`);
          return {
            filepath: folderPath,
            episodeCount: videoCount
          };
        } else {
          console.log(`[UserGrowthShortFilm]   文件数量不足（< 10），需要重新下载`);
        }
      }

      // 所有文件夹都不满足条件，需要重新下载
      console.log(`[UserGrowthShortFilm] 所有已存在文件夹均不满足去重条件，将重新下载`);
      return null;
    } catch (error) {
      console.error(`[UserGrowthShortFilm] 检查已下载文件夹失败:`, error);
      return null;
    }
  }

  /**
   * 处理单个墨攻平台剧目
   * @param {string} dramaName - 短剧名称
   * @param {string} outputPath - 输出路径
   * @param {number} dedupeExpireDays - 去重天数（默认30天）
   * @returns {Promise<string>} 下载后的文件夹路径
   */
  async processSingleUserGrowthDrama(dramaName, outputPath, dedupeExpireDays = 30) {
    const path = require('path');

    console.log(`[UserGrowthShortFilm] 开始处理短剧: ${dramaName}`);

    // 步骤0: 去重检查
    console.log(`[UserGrowthShortFilm] ========== 去重检查 ==========`);
    const existingDownload = this.checkExistingDownload(dramaName, outputPath, dedupeExpireDays);
    if (existingDownload) {
      console.log(`[UserGrowthShortFilm]   剧目 ${dramaName} 已存在，跳过下载`);
      console.log(`[UserGrowthShortFilm]   路径: ${existingDownload.filepath}`);
      console.log(`[UserGrowthShortFilm]   集数: ${existingDownload.episodeCount}`);
      return existingDownload;
    }
    console.log(`[UserGrowthShortFilm] 未找到有效的已下载文件，开始下载流程...`);
    console.log(`[UserGrowthShortFilm] ========== 开始下载 ==========`);

    // 步骤1: 输入短剧名搜索
    await this.searchDrama(dramaName);

    // 步骤2: 点击"全部上架剧"（搜索后再点击），并检查结果
    const hasResults = await this.clickAllDramas();
    
    if (!hasResults) {
      console.warn(`[UserGrowthShortFilm] 短剧 ${dramaName} 在"全部上架剧"和"即将上架剧"中都无结果，跳过`);
      return null;
    }

    // 步骤3: 启动网络监听
    console.log('[UserGrowthShortFilm] 启动全局网络监听...');
    this.resetCapturedVideoRequests();
    await this.setupNetworkMonitoring();

    // 步骤4: 点击第一个搜索结果的"查看详情"
    await this.clickViewDetails();

    // 步骤5: 抓取所有视频下载链接
    const videoLinks = await this.extractVideoLinks(dramaName);
    console.log(`[UserGrowthShortFilm] 共抓取到 ${videoLinks.length} 个视频链接`);

    // 步骤6: 下载所有视频
    if (videoLinks.length > 0) {
      console.log('[UserGrowthShortFilm] ========== 开始下载视频 ==========');
      const downloadResult = await this.downloadVideos(dramaName, videoLinks, outputPath);

      // 返回下载后的文件夹路径和集数
      const dramaDir = path.join(outputPath, dramaName);
      console.log(`[UserGrowthShortFilm] 短剧 ${dramaName} 处理完成，文件夹路径: ${dramaDir}, 集数: ${videoLinks.length}`);
      return { filepath: dramaDir, episodeCount: videoLinks.length };
    } else {
      console.error(`[UserGrowthShortFilm] 短剧 ${dramaName} 没有抓取到视频链接`);
      return null;
    }
  }

  /**
   * 检查 UserGrowth 登录状态
   */
  async checkUserGrowthLogin() {
    try {
      // 检查内存中的 Cookie
      const memoryCookies = this.cookieManager.getCookies('usergrowth');
      if (memoryCookies && memoryCookies.length > 0) {
        console.log('[UserGrowthShortFilm] UserGrowth 已登录（内存）');
        return { success: true };
      }

      // 检查文件中的 Cookie
      const fileCookies = await FileCookieStore.loadCookies(this.cookieFileName);
      if (fileCookies && fileCookies.length > 0) {
        console.log('[UserGrowthShortFilm] UserGrowth 已登录（文件）');
        this.cookieManager.saveCookies('usergrowth', fileCookies);
        return { success: true };
      }

      console.log('[UserGrowthShortFilm] UserGrowth 未登录');
      return { success: false, message: '未登录 UserGrowth' };
    } catch (error) {
      console.error('[UserGrowthShortFilm] 检查登录状态失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    try {
      console.log('[UserGrowthShortFilm] 初始化浏览器...');
      this.browser = await this.browserManager.createBrowser();

      // 加载 Cookie
      const cookies = this.cookieManager.getCookies('usergrowth') || (await FileCookieStore.loadCookies(this.cookieFileName));

      if (cookies && cookies.length > 0) {
        this.context = await this.browserManager.createContextWithCookies(cookies, this.userAgent);
      } else {
        this.context = await this.browserManager.createContext(this.userAgent);
      }

      this.page = await this.context.newPage();
      console.log('[UserGrowthShortFilm] 浏览器初始化完成');
    } catch (error) {
      console.error('[UserGrowthShortFilm] 浏览器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查并处理活动弹窗
   */
  async handleActivityPopup() {
    try {
      console.log('[UserGrowthShortFilm] 检查活动弹窗...');

      // 等待一小段时间，让弹窗有时间出现
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 检查弹窗是否存在且可见
      const popup = await this.page.$('#task-popup');

      if (popup) {
        // 检查弹窗是否可见
        const isVisible = await popup.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (isVisible) {
          console.log('[UserGrowthShortFilm] 检测到活动弹窗，准备点击"我已知悉"按钮...');

          // 查找"我已知悉"按钮
          const dismissButton = await this.page.waitForSelector('#dismissButton', {
            timeout: 5000,
            state: 'visible'
          });

          if (dismissButton) {
            // 尝试滚动到按钮位置
            try {
              await dismissButton.scrollIntoViewIfNeeded();
              await new Promise((resolve) => setTimeout(resolve, 500));

              // 检查按钮是否在视口中
              const isInViewport = await dismissButton.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return (
                  rect.top >= 0 &&
                  rect.left >= 0 &&
                  rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                  rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
              });

              if (!isInViewport) {
                console.log('[UserGrowthShortFilm] 按钮不在视口中，使用JavaScript点击');
                await this.page.evaluate(() => {
                  const btn = document.querySelector('#dismissButton');
                  if (btn) btn.click();
                });
              } else {
                await dismissButton.click();
              }

              console.log('[UserGrowthShortFilm] 已点击"我已知悉"按钮');
            } catch (error) {
              console.log('[UserGrowthShortFilm] 常规点击失败，使用JavaScript点击');
              await this.page.evaluate(() => {
                const btn = document.querySelector('#dismissButton');
                if (btn) btn.click();
              });
            }

            // 等待遮罩层消失
            console.log('[UserGrowthShortFilm] 等待遮罩层消失...');
            const maxWaitTime = 10;
            const waitInterval = 0.5;
            let waitedTime = 0;

            while (waitedTime < maxWaitTime) {
              const overlayGone = await this.page.evaluate(() => {
                const overlay = document.querySelector('#task-overlay');
                if (!overlay) return true;

                const style = window.getComputedStyle(overlay);
                return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none';
              });

              if (overlayGone) {
                console.log('[UserGrowthShortFilm] 遮罩层已消失');
                break;
              }

              await new Promise((resolve) => setTimeout(resolve, waitInterval * 1000));
              waitedTime += waitInterval;
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
            return true;
          }
        } else {
          console.log('[UserGrowthShortFilm] 弹窗存在但不可见');
        }
      } else {
        console.log('[UserGrowthShortFilm] 未检测到活动弹窗');
      }

      return false;
    } catch (error) {
      console.log('[UserGrowthShortFilm] 检查活动弹窗异常（可忽略）:', error.message);
      return false;
    }
  }

  /**
   * 点击"进入"按钮
   */
  async clickEnterButton() {
    try {
      console.log('[UserGrowthShortFilm] 查找"进入"按钮...');

      // 等待页面完全加载
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const enterButton = await this.page.waitForSelector('button.ug-button-secondary:has-text("进 入")', {
        timeout: 20000,
        state: 'visible'
      });

      if (!enterButton) {
        throw new Error('未找到进入按钮');
      }

      // 滚动到按钮位置
      await enterButton.scrollIntoViewIfNeeded();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await enterButton.click();
      console.log('[UserGrowthShortFilm] 已点击"进入"按钮');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击进入按钮失败:', error);
      throw error;
    }
  }

  /**
   * 点击"墨攻AI"按钮
   */
  async clickMoGongAIButton() {
    try {
      console.log('[UserGrowthShortFilm] 查找"墨攻AI"按钮...');

      // 再次检查并处理活动弹窗（进入后可能再次弹出）
      await this.handleActivityPopup();

      const mogongAIButton = await this.page.waitForSelector('div.arco-menu-item:has-text("墨攻AI")', {
        timeout: 40000,
        state: 'visible'
      });

      if (!mogongAIButton) {
        throw new Error('未找到墨攻AI按钮');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await mogongAIButton.click();
      console.log('[UserGrowthShortFilm] 已点击"墨攻AI"按钮');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击墨攻AI按钮失败:', error);
      throw error;
    }
  }

  /**
   * 点击"选品灵感" → "短剧选剧"
   */
  async clickShortDramaSelection() {
    try {
      console.log('[UserGrowthShortFilm] 点击"选品灵感"...');

      // 查找并点击"选品灵感" - 根据HTML结构，文本在span中
      const selectionInspiration = await this.page.waitForSelector('span:has-text("选品灵感")', {
        timeout: 40000,
        state: 'visible'
      });

      if (!selectionInspiration) {
        throw new Error('未找到"选品灵感"按钮');
      }

      await selectionInspiration.click();
      console.log('[UserGrowthShortFilm] 已点击"选品灵感"');
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // 查找并点击"短剧选剧" - 使用更精确的选择器
      console.log('[UserGrowthShortFilm] 点击"短剧选剧"...');
      const shortDramaSelection = await this.page.waitForSelector('span.arco-menu-item-inner:has-text("短剧选剧")', {
        timeout: 10000,
        state: 'visible'
      });

      if (!shortDramaSelection) {
        throw new Error('未找到"短剧选剧"按钮');
      }

      await shortDramaSelection.click();
      console.log('[UserGrowthShortFilm] 已点击"短剧选剧"');
      await new Promise((resolve) => setTimeout(resolve, 8000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击短剧选剧失败:', error);
      throw error;
    }
  }

  /**
   * 点击"番茄短剧"
   */
  async clickTomatoDrama() {
    try {
      console.log('[UserGrowthShortFilm] 点击"番茄短剧"...');

      // 查找并点击"番茄短剧" - 使用tab选择器
      const tomatoDrama = await this.page.waitForSelector('div.arco-tabs-header-title:has-text("番茄短剧")', {
        timeout: 40000,
        state: 'visible'
      });

      if (!tomatoDrama) {
        throw new Error('未找到"番茄短剧"按钮');
      }

      await tomatoDrama.click();
      console.log('[UserGrowthShortFilm] 已点击"番茄短剧"');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击番茄短剧失败:', error);
      throw error;
    }
  }

  /**
   * 点击"全部上架剧"并检查结果，如果无结果则尝试"即将上架剧"
   * @returns {Promise<boolean>} 是否有搜索结果
   */
  async clickAllDramas() {
    try {
      console.log('[UserGrowthShortFilm] 点击"全部上架剧"...');
      
      // 查找并点击"全部上架剧" - 这是一个radio button
      const allDramas = await this.page.waitForSelector('button.arco-btn:has-text("全部上架剧")', {
        timeout: 10000,
        state: 'visible'
      });

      if (!allDramas) {
        throw new Error('未找到"全部上架剧"按钮');
      }

      await allDramas.click();
      console.log('[UserGrowthShortFilm] 已点击"全部上架剧"');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 检查是否有搜索结果
      const hasResults = await this.checkSearchResults();
      
      if (hasResults) {
        console.log('[UserGrowthShortFilm] "全部上架剧"中找到搜索结果');
        return true;
      }

      // 如果"全部上架剧"无结果，尝试"即将上架剧"
      console.log('[UserGrowthShortFilm] "全部上架剧"中无结果，尝试"即将上架剧"...');
      
      const upcomingDramas = await this.page.waitForSelector('button.arco-btn:has-text("即将上架剧")', {
        timeout: 10000,
        state: 'visible'
      });

      if (!upcomingDramas) {
        console.warn('[UserGrowthShortFilm] 未找到"即将上架剧"按钮');
        return false;
      }

      await upcomingDramas.click();
      console.log('[UserGrowthShortFilm] 已点击"即将上架剧"');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 再次检查是否有搜索结果
      const hasResultsUpcoming = await this.checkSearchResults();
      
      if (hasResultsUpcoming) {
        console.log('[UserGrowthShortFilm] "即将上架剧"中找到搜索结果');
        return true;
      }

      console.warn('[UserGrowthShortFilm] "全部上架剧"和"即将上架剧"中都无搜索结果');
      return false;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击分类失败:', error);
      throw error;
    }
  }

  /**
   * 切换到旧UI布局
   * @returns {Promise<boolean>} 是否切换成功
   */
  async switchToOldLayout() {
    try {
      console.log('[UserGrowthShortFilm] 检测到新UI布局，尝试切换...');
      
      // 查找布局切换按钮
      const switchButton = await this.page.$('button.arco-btn-icon-only:has(svg.ug_menu-icon-magoai_detail_mode)');
      
      if (!switchButton) {
        console.warn('[UserGrowthShortFilm] 未找到布局切换按钮');
        return false;
      }
      
      // 点击切换按钮
      await switchButton.click();
      console.log('[UserGrowthShortFilm] 已点击布局切换按钮，等待 10 秒让布局切换完成...');
      
      // 等待 10 秒让布局切换完成
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('[UserGrowthShortFilm] 布局切换完成');
      
      return true;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 切换布局失败:', error);
      return false;
    }
  }

  /**
   * 关闭视频播放器弹窗
   * @returns {Promise<boolean>} 是否成功关闭
   */
  async closeVideoPlayer() {
    try {
      // 查找关闭按钮（使用 arco-modal-close-icon 类名）
      const closeButton = await this.page.$('.arco-modal-close-icon');
      
      if (closeButton) {
        await closeButton.click();
        console.log('[UserGrowthShortFilm] 已关闭视频播放器');
        await new Promise((resolve) => setTimeout(resolve, 500));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 关闭播放器失败:', error);
      return false;
    }
  }

  /**
   * 检查搜索结果是否存在
   * @returns {Promise<boolean>} 是否有搜索结果
   */
  async checkSearchResults() {
    try {
      // 等待页面加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 方式1: 检查是否存在"查看详情"按钮（表示有搜索结果）
      const viewDetailButton = await this.page.$('button.view-button-OM6STd:has-text("查看详情")');
      
      if (viewDetailButton) {
        return true;
      }

      // 方式2: 检查是否有"暂无数据"等提示
      const noDataText = await this.page.$('text=暂无数据');
      if (noDataText) {
        return false;
      }

      // 默认返回 false（未找到明确的结果标识）
      return false;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 检查搜索结果失败:', error);
      // 出错时保守返回 false
      return false;
    }
  }

  /**
   * 搜索短剧
   */
  async searchDrama(dramaName) {
    try {
      console.log(`[UserGrowthShortFilm] 搜索短剧: ${dramaName}`);

      // 查找搜索输入框
      const searchInput = await this.page.waitForSelector('input[placeholder*="搜索"], input[type="search"]', {
        timeout: 10000,
        state: 'visible'
      });

      if (!searchInput) {
        throw new Error('未找到搜索输入框');
      }

      // 点击输入框并输入短剧名
      await searchInput.click();
      await searchInput.fill(dramaName);
      console.log(`[UserGrowthShortFilm] 已输入短剧名: ${dramaName}`);

      // 按回车搜索
      await searchInput.press('Enter');
      console.log('[UserGrowthShortFilm] 已触发搜索');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 搜索短剧失败:', error);
      throw error;
    }
  }

  /**
   * 点击第一个搜索结果的"查看详情"按钮
   */
  async clickViewDetails() {
    try {
      console.log('[UserGrowthShortFilm] 查找第一个搜索结果的"查看详情"按钮...');

      // 等待搜索结果加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 查找第一个结果卡片中的"查看详情"按钮
      const viewDetailButton = await this.page.waitForSelector('button.view-button-OM6STd:has-text("查看详情")', {
        timeout: 10000,
        state: 'visible'
      });

      if (!viewDetailButton) {
        throw new Error('未找到"查看详情"按钮');
      }

      await viewDetailButton.click();
      console.log('[UserGrowthShortFilm] 已点击"查看详情"按钮');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('[UserGrowthShortFilm] 点击查看详情失败:', error);
      throw error;
    }
  }

  /**
   * 抓取所有视频下载链接（分组按钮模式）
   * 使用CDP监听方式抓取
   */
  async extractVideoLinks(dramaName) {
    try {
      console.log('[UserGrowthShortFilm] ========== 开始抓取视频链接（分组按钮模式）==========');
      console.log('[UserGrowthShortFilm] 目标剧目:', dramaName);

      // 优化1: 等待30秒让页面充分加载资源
      console.log('[UserGrowthShortFilm] 等待30秒让页面加载资源...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const videoMap = [];
      const capturedTitles = new Set(); // 用标题去重

      // 步骤1: 获取所有分组按钮（1-20, 21-40, 41-60, 61-75）
      const groupButtons = await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('#group-selector button');
        return Array.from(buttons).map((btn, index) => ({
          index: index,
          text: btn.textContent.trim()
        }));
      });

      console.log(`[UserGrowthShortFilm] 发现 ${groupButtons.length} 个分组按钮: [${groupButtons.map((b) => b.text).join(', ')}]`);

      // 步骤1.5: 如果没有分组按钮（短剧数量 < 20），直接切换到旧布局
      if (groupButtons.length === 0) {
        console.log('[UserGrowthShortFilm] 没有发现分组按钮（短剧数量 < 20），切换到旧布局...');
        await this.switchToOldLayout();
        
        // 切换后直接获取剧集列表（不需要遍历分组）
        console.log('[UserGrowthShortFilm] 从旧布局获取剧集列表...');
        const episodeCards = await this.page.evaluate(() => {
          const container = document.querySelector('[data-overlayscrollbars-contents]');
          if (!container) return [];

          const labels = container.querySelectorAll('label.arco-radio');
          const episodes = [];

          labels.forEach((label, index) => {
            const titleEl = label.querySelector('.information-title-UFXPjf');
            const title = titleEl ? titleEl.textContent.trim() : '';
            
            // 跳过"全部剧集"
            if (title === '全部剧集' || title.includes('全部')) {
              console.log(`[跳过] index=${index}, title=${title}`);
              return;
            }

            if (titleEl) {
              episodes.push({
                index: index,
                title: title
              });
            }
          });

          return episodes;
        });

        console.log(`[UserGrowthShortFilm] 旧布局下共有 ${episodeCards.length} 个剧集`);
        
        // 处理这些剧集
        for (const episode of episodeCards) {
          if (capturedTitles.has(episode.title)) {
            console.log(`[UserGrowthShortFilm] ⊙ ${episode.title} - 已捕获，跳过`);
            continue;
          }
          capturedTitles.add(episode.title);
          
          // 点击左侧剧集获取视频链接
          await this.page.evaluate((index) => {
            const labels = document.querySelectorAll('label.arco-radio');
            if (labels[index]) {
              labels[index].click();
            }
          }, episode.index);
          
          console.log(`[UserGrowthShortFilm] 已点击左侧剧集: ${episode.title}`);
          await new Promise((resolve) => setTimeout(resolve, 1500));

          this.resetCapturedVideoRequests();
          
          // 点击右侧卡片触发视频加载
          const cardClicked = await this.page.evaluate(() => {
            const card = document.querySelector('.content-preview-container-znYX8w');
            if (card) {
              card.click();
              return true;
            }
            return false;
          });
          
          if (!cardClicked) {
            console.log(`[UserGrowthShortFilm]  ${episode.title} - 未找到右侧卡片`);
            continue;
          }
          
          // 等待视频捕获
          let capturedUrl = null;
          const startTime = Date.now();
          const timeout = 15000;
          const checkInterval = 500;
          
          while (Date.now() - startTime < timeout) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            const afterCount = this.capturedRequests.length;
            const newUrls = this.capturedRequests.slice(0, afterCount);
            
            if (newUrls.length > 0) {
              capturedUrl = newUrls[0];
              const waitTime = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(`[UserGrowthShortFilm]  ${episode.title} - 捕获到URL (等待${waitTime}秒)`);
              break;
            }
          }
          
          if (capturedUrl) {
            videoMap.push({
              title: episode.title,
              url: capturedUrl,
              size: ''
            });
            // 关闭播放器弹窗
            await this.closeVideoPlayer();
          } else {
            console.warn(`[UserGrowthShortFilm] ⊙ ${episode.title} - 未捕获到视频URL`);
          }
        }

        console.log(`[UserGrowthShortFilm] 共抓取到 ${videoMap.length} 个视频链接`);
        return videoMap;
      }

      // 步骤2: 遍历每个分组按钮
      for (const groupBtn of groupButtons) {
        console.log(`[UserGrowthShortFilm] ========== 处理分组: ${groupBtn.text} ==========`);

        // 点击分组按钮
        await this.page.evaluate((index) => {
          const buttons = document.querySelectorAll('#group-selector button');
          if (buttons[index]) {
            buttons[index].click();
          }
        }, groupBtn.index);

        console.log(`[UserGrowthShortFilm] 已点击分组按钮: ${groupBtn.text}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 步骤3: 获取该分组下的所有剧集卡片（优化2&3: 跳过"全部剧集"，直接从第1集开始）
        const episodeCards = await this.page.evaluate(() => {
          const container = document.querySelector('[data-overlayscrollbars-contents]');
          if (!container) return [];

          const labels = container.querySelectorAll('label.arco-radio');
          const episodes = [];

          labels.forEach((label, index) => {
            const titleEl = label.querySelector('.information-title-UFXPjf');
            const title = titleEl ? titleEl.textContent.trim() : '';
            
            // 跳过"全部剧集"（根据标题判断，而不是索引）
            if (title === '全部剧集' || title.includes('全部')) {
              console.log(`[跳过] index=${index}, title=${title}`);
              return;
            }

            if (titleEl) {
              episodes.push({
                index: index,
                title: title
              });
            }
          });

          return episodes;
        });

        console.log(`[UserGrowthShortFilm] 分组 ${groupBtn.text} 下有 ${episodeCards.length} 个剧集`);

        // 步骤3.5: 如果解析到0个剧集，可能是新UI布局，尝试切换到旧布局
        if (episodeCards.length === 0 && groupBtn.index === 0) {
          console.warn(`[UserGrowthShortFilm] 检测到新UI布局（无法解析剧集），尝试切换到旧布局...`);
          
          const switched = await this.switchToOldLayout();
          
          if (switched) {
            console.log('[UserGrowthShortFilm] 已切换到旧布局，重新点击分组按钮...');
            
            // 重新点击分组按钮
            await this.page.evaluate((index) => {
              const buttons = document.querySelectorAll('#group-selector button');
              if (buttons[index]) {
                buttons[index].click();
              }
            }, groupBtn.index);
            
            await new Promise((resolve) => setTimeout(resolve, 2000));
            
            // 重新解析剧集列表
            const retriedEpisodeCards = await this.page.evaluate(() => {
              const container = document.querySelector('[data-overlayscrollbars-contents]');
              if (!container) return [];

              const labels = container.querySelectorAll('label.arco-radio');
              const episodes = [];

              labels.forEach((label, index) => {
                const titleEl = label.querySelector('.information-title-UFXPjf');
                const title = titleEl ? titleEl.textContent.trim() : '';
                
                // 跳过"全部剧集"
                if (title === '全部剧集' || title.includes('全部')) {
                  return;
                }

                if (titleEl) {
                  episodes.push({
                    index: index,
                    title: title
                  });
                }
              });

              return episodes;
            });
            
            console.log(`[UserGrowthShortFilm] 切换后重新解析: ${retriedEpisodeCards.length} 个剧集`);
            
            if (retriedEpisodeCards.length === 0) {
              console.error('[UserGrowthShortFilm] 切换布局后仍无法解析剧集，跳过整个短剧');
              return { filepath: null, episodeCount: 0 };
            }
            
            // 使用重新解析的结果
            episodeCards.length = 0;
            episodeCards.push(...retriedEpisodeCards);
          } else {
            console.error('[UserGrowthShortFilm] 无法切换布局，跳过整个短剧');
            return { filepath: null, episodeCount: 0 };
          }
        }

        // 步骤4: 遍历该分组下的每个剧集
        for (const episode of episodeCards) {
          // 检查是否已经捕获过
          if (capturedTitles.has(episode.title)) {
            console.log(`[UserGrowthShortFilm] ⊙ ${episode.title} - 已捕获，跳过`);
            continue;
          }

          try {
            // 点击左侧剧集卡片
            await this.page.evaluate((index) => {
              const container = document.querySelector('[data-overlayscrollbars-contents]');
              if (!container) return;

              const labels = container.querySelectorAll('label.arco-radio');
              if (labels[index]) {
                // 滚动到卡片位置
                labels[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 等待一下再点击
                setTimeout(() => {
                  const input = labels[index].querySelector('input[type="radio"]');
                  if (input) {
                    input.click();
                  }
                }, 200);
              }
            }, episode.index);

            console.log(`[UserGrowthShortFilm] 已点击左侧剧集: ${episode.title}`);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            this.resetCapturedVideoRequests();

            // 点击右侧卡片触发视频加载
            const cardClicked = await this.page.evaluate(() => {
              const card = document.querySelector('.content-preview-container-znYX8w');
              if (card) {
                card.click();
                return true;
              }
              return false;
            });

            if (!cardClicked) {
              console.log(`[UserGrowthShortFilm]  ${episode.title} - 未找到右侧卡片`);
              continue;
            }

            // 智能等待机制：动态检测是否捕获到URL
            const maxRetries = 3; // 最多重试3次
            const timeout = 20000; // 每次超时时间20秒
            const checkInterval = 500; // 每500ms检查一次
            let capturedUrl = null;
            let retryCount = 0;

            while (retryCount <= maxRetries && !capturedUrl) {
              const startTime = Date.now();
              let elapsed = 0;

              // 如果是重试，先关闭播放器，再重新点击卡片
              if (retryCount > 0) {
                console.log(`[UserGrowthShortFilm]  ${episode.title} - 第${retryCount}次重试，先关闭播放器...`);
                await this.closeVideoPlayer();
                
                // 步骤1: 重新点击左侧剧集列表
                console.log(`[UserGrowthShortFilm]  ${episode.title} - 重新点击左侧剧集...`);
                await this.page.evaluate((index) => {
                  const container = document.querySelector('[data-overlayscrollbars-contents]');
                  if (!container) return;

                  const labels = container.querySelectorAll('label.arco-radio');
                  if (labels[index]) {
                    labels[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                      const input = labels[index].querySelector('input[type="radio"]');
                      if (input) {
                        input.click();
                      }
                    }, 200);
                  }
                }, episode.index);
                await new Promise((resolve) => setTimeout(resolve, 1500));
                this.resetCapturedVideoRequests();
                
                // 步骤2: 点击右侧预览卡片触发视频加载
                console.log(`[UserGrowthShortFilm]  ${episode.title} - 重新点击右侧卡片...`);
                const cardClicked = await this.page.evaluate(() => {
                  const card = document.querySelector('.content-preview-container-znYX8w');
                  if (card) {
                    card.click();
                    return true;
                  }
                  return false;
                });
                
                if (!cardClicked) {
                  console.log(`[UserGrowthShortFilm]  ${episode.title} - 重试时未找到右侧卡片，跳过此次重试`);
                  retryCount++;
                  continue;
                }
                
                await new Promise((resolve) => setTimeout(resolve, 500));
              }

              // 动态等待：持续检查是否捕获到URL，直到超时
              while (elapsed < timeout) {
                await new Promise((resolve) => setTimeout(resolve, checkInterval));
                elapsed = Date.now() - startTime;

                // 检查是否有新的URL
                const afterCount = this.capturedRequests.length;
                const newUrls = this.capturedRequests.slice(0, afterCount);

                if (newUrls.length > 0) {
                  capturedUrl = newUrls[0];
                  const waitTime = (elapsed / 1000).toFixed(2);
                  console.log(`[UserGrowthShortFilm]  ${episode.title} - 捕获到URL (等待${waitTime}秒${retryCount > 0 ? `, 重试${retryCount}次后成功` : ''})`);
                  break;
                }
              }

              // 如果这次尝试没有捕获到URL
              if (!capturedUrl) {
                retryCount++;
                if (retryCount <= maxRetries) {
                  console.log(`[UserGrowthShortFilm]  ${episode.title} - 超时${timeout / 1000}秒未捕获到URL`);
                }
              }
            }

            // 保存结果
            if (capturedUrl) {
              capturedTitles.add(episode.title);
              videoMap.push({
                title: episode.title,
                url: capturedUrl
              });
            } else {
              console.log(`[UserGrowthShortFilm]  ${episode.title} - 重试${maxRetries}次后仍未捕获到URL，跳过`);
            }

            // 关闭弹窗
            await this.closeVideoModal();
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (error) {
            console.error(`[UserGrowthShortFilm]  ${episode.title} 处理失败:`, error.message);
            try {
              await this.closeVideoModal();
            } catch {}
          }
        }

        console.log(`[UserGrowthShortFilm] 分组 ${groupBtn.text} 处理完成，当前累计 ${videoMap.length} 个视频`);
      }

      console.log(`[UserGrowthShortFilm] ========== 抓取完成 ==========`);
      console.log(`[UserGrowthShortFilm] 总分组数: ${groupButtons.length}, 共 ${videoMap.length} 个视频`);

      // 按标题排序（如果标题是"第X集"格式）
      videoMap.sort((a, b) => {
        const numA = parseInt(a.title.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.title.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

      // 测试第一个视频链接并获取正确的headers
      if (videoMap.length > 0) {
        console.log('[UserGrowthShortFilm] ========== 测试视频链接可访问性 ==========');
        const validHeaders = await this.getVideoHeaders(videoMap[0].url);
        if (validHeaders) {
          console.log('[UserGrowthShortFilm] ========== 下载视频所需的Headers ==========');
          console.log(JSON.stringify(validHeaders, null, 2));
        }
      }

      // 打印结果（只打印前10个和后5个，避免日志过长）
      console.log('[UserGrowthShortFilm] 视频映射表:');
      if (videoMap.length <= 15) {
        videoMap.forEach((item, idx) => {
          console.log(`  ${idx + 1}. [${item.title}] ${item.url.substring(0, 80)}...`);
        });
      } else {
        // 打印前10个
        videoMap.slice(0, 10).forEach((item, idx) => {
          console.log(`  ${idx + 1}. [${item.title}] ${item.url.substring(0, 80)}...`);
        });
        console.log(`  ... (省略 ${videoMap.length - 15} 个)`);
        // 打印后5个
        videoMap.slice(-5).forEach((item, idx) => {
          console.log(`  ${videoMap.length - 5 + idx + 1}. [${item.title}] ${item.url.substring(0, 80)}...`);
        });
      }

      return videoMap;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 抓取视频链接失败:', error);
      throw error;
    }
  }

  /**
   * 下载所有视频
   */
  async downloadVideos(dramaName, videoLinks, outputPath) {
    const fs = require('fs');
    const path = require('path');
    const axios = require('axios');

    try {
      // 创建目录结构：outputPath/短剧名/
      const dramaDir = path.join(outputPath, dramaName);
      if (!fs.existsSync(dramaDir)) {
        fs.mkdirSync(dramaDir, { recursive: true });
        console.log(`[UserGrowthShortFilm] 创建目录: ${dramaDir}`);
      }

      // 准备下载所需的 headers
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://usergrowth.com.cn/'
      };

      console.log(`[UserGrowthShortFilm] 准备下载 ${videoLinks.length} 个视频到: ${dramaDir}`);

      let successCount = 0;
      let failCount = 0;

      // 遍历所有视频链接
      for (let i = 0; i < videoLinks.length; i++) {
        const video = videoLinks[i];

        // 从标题中提取集数（例如 "第5集" -> 5）
        const episodeMatch = video.title.match(/第?(\d+)集/);
        const episodeNum = episodeMatch ? episodeMatch[1] : i + 1;

        // 文件名：短剧名_X.mp4
        const filename = `${dramaName}_${episodeNum}.mp4`;
        const filepath = path.join(dramaDir, filename);

        // 检查文件是否已存在
        if (fs.existsSync(filepath)) {
          console.log(`[UserGrowthShortFilm] [${i + 1}/${videoLinks.length}] ${video.title} - 已存在，跳过`);
          successCount++;
          continue;
        }

        // 支持重试机制：失败后重试一次
        let downloadSuccess = false;
        const maxRetries = 2; // 最多尝试2次（首次 + 重试1次）

        for (let retry = 0; retry < maxRetries && !downloadSuccess; retry++) {
          try {
            if (retry > 0) {
              console.log(`[UserGrowthShortFilm] [${i + 1}/${videoLinks.length}] 重试下载 (${retry}/${maxRetries - 1}): ${video.title}`);
            } else {
              console.log(`[UserGrowthShortFilm] [${i + 1}/${videoLinks.length}] 开始下载: ${video.title} -> ${filename}`);
            }

            // 使用 axios 下载视频
            const response = await axios({
              method: 'GET',
              url: video.url,
              headers: headers,
              responseType: 'stream',
              timeout: 120000 // 120秒超时
            });

            // 创建写入流
            const writer = fs.createWriteStream(filepath);

            // 监听下载进度
            let downloadedSize = 0;
            const totalSize = parseInt(response.headers['content-length'] || '0');

            response.data.on('data', (chunk) => {
              downloadedSize += chunk.length;
              if (totalSize > 0) {
                const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                // 每下载 10% 打印一次进度
                if (downloadedSize % Math.floor(totalSize / 10) < chunk.length) {
                  console.log(`[UserGrowthShortFilm]   进度: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(2)}MB / ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
                }
              }
            });

            // 管道传输
            response.data.pipe(writer);

            // 等待下载完成
            await new Promise((resolve, reject) => {
              writer.on('finish', () => {
                const fileSize = fs.statSync(filepath).size;
                console.log(`[UserGrowthShortFilm]  ${video.title} 下载完成 (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
                successCount++;
                downloadSuccess = true;
                resolve();
              });
              writer.on('error', (error) => {
                console.error(`[UserGrowthShortFilm]  ${video.title} 写入失败:`, error.message);
                reject(error);
              });
              response.data.on('error', (error) => {
                console.error(`[UserGrowthShortFilm]  ${video.title} 下载失败:`, error.message);
                reject(error);
              });
            });

            // 下载间隔，避免请求过快（增加到3秒）
            await new Promise((resolve) => setTimeout(resolve, 3000));
          } catch (error) {
            console.error(`[UserGrowthShortFilm]  [${i + 1}/${videoLinks.length}] ${video.title} 下载失败 (尝试 ${retry + 1}/${maxRetries}):`, error.message);

            // 删除不完整的文件
            if (fs.existsSync(filepath)) {
              try {
                fs.unlinkSync(filepath);
                console.log(`[UserGrowthShortFilm]   已删除不完整文件: ${filename}`);
              } catch {}
            }

            // 如果是最后一次尝试且仍然失败，记录失败
            if (retry === maxRetries - 1) {
              failCount++;
              console.error(`[UserGrowthShortFilm]  ${video.title} 下载失败，已跳过`);
            } else {
              // 重试前等待2秒
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        }
      }

      console.log(`[UserGrowthShortFilm] ========== 下载完成 ==========`);
      console.log(`[UserGrowthShortFilm] 总计: ${videoLinks.length} 个，成功: ${successCount} 个，失败: ${failCount} 个`);
      console.log(`[UserGrowthShortFilm] 保存路径: ${dramaDir}`);

      return {
        success: successCount,
        failed: failCount,
        total: videoLinks.length
      };
    } catch (error) {
      console.error('[UserGrowthShortFilm] 下载视频失败:', error);
      throw error;
    }
  }

  /**
   * 获取视频URL的正确请求头
   */
  async getVideoHeaders(videoUrl) {
    try {
      console.log('[UserGrowthShortFilm] 测试视频URL:', videoUrl.substring(0, 100) + '...');

      // 方案1: 在当前页面的上下文中测试访问
      console.log('[UserGrowthShortFilm] --- 方案1: 在当前页面中测试fetch ---');
      const fetchResult = await this.page.evaluate(async (url) => {
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            credentials: 'include'
          });
          return {
            success: true,
            status: res.status,
            statusText: res.statusText
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, videoUrl);

      console.log('[UserGrowthShortFilm] Fetch结果:', fetchResult);

      // 方案2: 监听视频请求，获取真实的headers
      console.log('[UserGrowthShortFilm] --- 方案2: 监听视频播放时的实际请求 ---');

      let capturedHeaders = null;
      const requestListener = (request) => {
        const url = request.url();
        if (url.includes('chameleon.usergrowth.com.cn') && url.includes('/video/')) {
          capturedHeaders = request.headers();
          console.log('[UserGrowthShortFilm]  捕获到视频请求!');
          console.log('[UserGrowthShortFilm] 请求URL:', url.substring(0, 100) + '...');
        }
      };

      this.page.on('request', requestListener);

      // 触发视频播放（点击第一个卡片）
      console.log('[UserGrowthShortFilm] 尝试触发视频播放以捕获headers...');

      // 点击第一个分组按钮
      await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('#group-selector button');
        if (buttons[0]) {
          buttons[0].click();
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 点击第一个剧集（跳过"全部剧集"）
      await this.page.evaluate(() => {
        const container = document.querySelector('[data-overlayscrollbars-contents]');
        if (container) {
          const labels = container.querySelectorAll('label.arco-radio');
          if (labels[1]) {
            // 第二个是第1集
            const input = labels[1].querySelector('input[type="radio"]');
            if (input) {
              input.click();
            }
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 点击右侧卡片触发视频加载
      await this.page.evaluate(() => {
        const card = document.querySelector('.content-preview-container-znYX8w');
        if (card) {
          card.click();
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 移除监听器
      this.page.off('request', requestListener);

      if (capturedHeaders) {
        console.log('[UserGrowthShortFilm]  成功捕获视频请求的Headers:');
        const importantHeaders = ['referer', 'origin', 'user-agent', 'cookie', 'authorization', 'accept', 'accept-encoding', 'accept-language'];

        importantHeaders.forEach((key) => {
          if (capturedHeaders[key]) {
            const value = key === 'cookie' ? capturedHeaders[key].substring(0, 100) + '...' : capturedHeaders[key];
            console.log(`  ${key}: ${value}`);
          }
        });

        // 关闭弹窗
        await this.closeVideoModal();

        return capturedHeaders;
      } else {
        console.log('[UserGrowthShortFilm]  未能捕获到视频请求的headers');

        // 关闭弹窗
        await this.closeVideoModal();

        return null;
      }
    } catch (error) {
      console.error('[UserGrowthShortFilm] 获取视频headers失败:', error);
      return null;
    }
  }

  /**
   * 安全点击卡片（缩短超时，加快失败检测）
   */
  async safeClickCard(index) {
    try {
      await this.page.evaluate((idx) => {
        const cards = document.querySelectorAll('.common-card-item-eVVh45');
        if (cards[idx]) {
          cards[idx].click();
        }
      }, index);

      // 等待弹窗出现（缩短到2秒）
      await this.page.waitForSelector('.arco-modal.video-modal-c_Hxq6', {
        timeout: 2000,
        state: 'visible'
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 设置网络监听（模拟猫抓插件）
   */
  async setupNetworkMonitoring() {
    try {
      // 使用CDP (Chrome DevTools Protocol) 监听网络请求
      const client = await this.page.context().newCDPSession(this.page);

      // 启用网络监听
      await client.send('Network.enable');

      this.lastCapturedVideoUrl = '';

      // 监听所有响应
      client.on('Network.responseReceived', (params) => {
        const url = params.response.url;
        const mimeType = params.response.mimeType || '';

        // 检查是否是视频资源
        if (this.isVideoResource(url, mimeType) && url !== this.lastCapturedVideoUrl) {
          this.lastCapturedVideoUrl = url;
          this.capturedRequests.push(url);
          console.log(`[CDP监听] 捕获视频 #${this.capturedRequests.length}: ${url.substring(0, 100)}...`);
        }
      });

      console.log('[UserGrowthShortFilm] CDP网络监听已启动');
    } catch (error) {
      console.error('[UserGrowthShortFilm] CDP监听设置失败:', error);
    }
  }

  isVideoResource(url, mimeType = '') {
    const cleanUrl = String(url || '').split('?')[0].toLowerCase();
    const normalizedMime = String(mimeType || '').toLowerCase();

    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.m3u8') ||
      cleanUrl.endsWith('.ts') ||
      normalizedMime.startsWith('video/') ||
      normalizedMime.includes('application/vnd.apple.mpegurl') ||
      (cleanUrl.includes('chameleon.usergrowth.com.cn') && cleanUrl.includes('/video/'))
    );
  }

  resetCapturedVideoRequests() {
    this.capturedRequests = [];
    this.lastCapturedVideoUrl = '';
  }

  /**
   * 从弹窗中获取视频信息
   */
  async getVideoInfoFromModal() {
    try {
      const info = await this.page.evaluate(() => {
        const modal = document.querySelector('.arco-modal.video-modal-c_Hxq6');
        if (!modal) return { title: '' };

        // 获取标题
        const titleEl = modal.querySelector('.arco-modal-title');
        const title = titleEl ? titleEl.textContent.trim() : '';

        // 获取video标签的src
        const video = modal.querySelector('video');
        const videoSrc = video ? video.getAttribute('src') : '';

        return { title, videoSrc };
      });

      return info;
    } catch (error) {
      console.error('[UserGrowthShortFilm] 获取视频信息失败:', error);
      return { title: '' };
    }
  }

  /**
   * 关闭视频弹窗
   */
  async closeVideoModal() {
    try {
      // 查找关闭按钮
      const closeButton = await this.page.$('.arco-modal.video-modal-c_Hxq6 .arco-modal-close-icon');

      if (closeButton) {
        await closeButton.click();
        // 等待弹窗消失
        await this.page.waitForSelector('.arco-modal.video-modal-c_Hxq6', {
          timeout: 3000,
          state: 'hidden'
        });
        console.log('[UserGrowthShortFilm] 弹窗已关闭');
      } else {
        // 备用方案：按ESC键
        await this.page.keyboard.press('Escape');
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('[UserGrowthShortFilm] 通过ESC键关闭弹窗');
      }
    } catch (error) {
      console.error('[UserGrowthShortFilm] 关闭弹窗失败:', error);
      // 尝试按ESC键作为最后手段
      try {
        await this.page.keyboard.press('Escape');
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {}
    }
  }

  /**
   * 打印前5个结果
   */
  printFirst5Results(methodName, links) {
    if (links.length === 0) {
      console.log(`${methodName} 没有抓取到任何结果`);
      return;
    }

    console.log(`${methodName} 前5个结果：`);
    const showCount = Math.min(5, links.length);
    for (let i = 0; i < showCount; i++) {
      console.log(`  ${i + 1}. ${links[i]}`);
    }
  }

  /**
   * 安全关闭浏览器
   */
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
    console.log('[UserGrowthShortFilm] 浏览器已关闭');
  }
}

exports.UserGrowthShortFilmNode = UserGrowthShortFilmNode;
