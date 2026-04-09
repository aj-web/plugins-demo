'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.XhsLoginNode = void 0;
const playwright_1 = require('playwright');
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
const file_cookie_store_1 = require('../utils/file-cookie-store');

/**
 * 小红书登录节点
 *
 * 流程与淘宝登录保持一致：
 * - 启动 Playwright 浏览器（使用宿主注入的 CHROME_PATH）
 * - 读取本地 cookies（若有）并注入
 * - 打开小红书页面，等待用户手动登录
 * - 轮询检查登录状态
 * - 登录成功后：保存 cookies 到 GlobalCookieManager 与本地文件
 */
class XhsLoginNode {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cookieFileName = 'xhs_cookies.json';
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
  }

  /**
   * 启动登录流程
   */
  async startLogin() {
    try {
      console.log('[XhsLoginNode] 启动 Playwright 浏览器...');
      const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      console.log('[XhsLoginNode] 使用 Chrome 路径:', chromePath);

      this.browser = await playwright_1.chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu']
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      this.page = await this.context.newPage();

      const cookies = (0, file_cookie_store_1.loadCookies)(this.cookieFileName);

      console.log('[XhsLoginNode] 导航到小红书首页...');
      if (cookies && Array.isArray(cookies) && cookies.length > 0) {
        await this.context.addCookies(cookies);
      }

      await this.page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('[XhsLoginNode] 小红书页面已打开，等待用户登录（或使用已有登录态）...');

      let loginResult = null;
      try {
        loginResult = await this.waitForLogin();
        console.log('[XhsLoginNode] 登录结果:', loginResult);
      } catch (error) {
        console.error('[XhsLoginNode] 登录失败:', error);
        (0, file_cookie_store_1.deleteCookies)(this.cookieFileName);
        loginResult = {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }

      if (loginResult && loginResult.success) {
        console.log('[XhsLoginNode] 登录成功，开始保存 cookies...');
        await this.saveCookiesToMemory();
        (0, file_cookie_store_1.saveCookies)(this.cookieFileName, this.cookieManager.getCookies('xhs'));
        console.log('[XhsLoginNode] cookies 已保存，3 秒后关闭浏览器...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.closeBrowser();
        return { success: true, message: '登录成功，cookies 已保存' };
      } else {
        console.log('[XhsLoginNode] 登录失败或取消:', (loginResult === null || loginResult === void 0 ? void 0 : loginResult.message) || '未知原因');
        (0, file_cookie_store_1.deleteCookies)(this.cookieFileName);
        await this.closeBrowser();
        return {
          success: false,
          message: (loginResult === null || loginResult === void 0 ? void 0 : loginResult.message) || '登录失败'
        };
      }
    } catch (error) {
      console.error('[XhsLoginNode] 登录过程中发生错误:', error);
      (0, file_cookie_store_1.deleteCookies)(this.cookieFileName);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 轮询检查登录状态
   */
  async waitForLogin(maxAttempts = 100, interval = 2000) {
    console.log('[XhsLoginNode] 开始轮询检查登录状态...');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[XhsLoginNode] 第 ${attempt} 次检查登录状态（最多 ${maxAttempts} 次）...`);

      try {
        if (this.page && this.page.isClosed()) {
          console.log('[XhsLoginNode] 检测到页面已关闭，用户取消了登录');
          return { success: false, message: '登录取消' };
        }
      } catch (error) {
        console.log('[XhsLoginNode] 页面状态检查异常，可能已关闭:', error instanceof Error ? error.message : String(error));
        return { success: false, message: '登录取消' };
      }

      try {
        const result = await this.checkLoginStatus();
        if (result.success) {
          console.log(`[XhsLoginNode] 检测到已登录，小红书登录完成（共检查 ${attempt} 次）`);
          return result;
        }
      } catch (error) {
        console.log(`[XhsLoginNode] 第 ${attempt} 次检查出错（忽略继续）:`, error instanceof Error ? error.message : String(error));
      }

      if (attempt < maxAttempts) {
        console.log(`[XhsLoginNode] 等待 ${interval}ms 后进行下一次检查...`);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    console.log(`[XhsLoginNode] 登录检查超时，共检查了 ${maxAttempts} 次，仍未检测到登录成功`);
    return { success: false, message: '登录检查超时' };
  }

  /**
   * 检查登录状态
   *
   * 说明：
   * - 仅依赖 cookies（a1 / web_session）不可靠，因为在未真正登录时也可能存在
   * - 这里使用你提供的“用户信息栏”选择器，检查是否存在用户头像 URL 来判定登录态
   */
  async checkLoginStatus() {
    try {
      console.log('[XhsLoginNode] 开始检查登录状态...');
      if (!this.context || !this.page) {
        return { success: false, message: '浏览器上下文或页面未初始化' };
      }

      const currentUrl = this.page.url();
      console.log('[XhsLoginNode] 当前 URL:', currentUrl);

      // 若仍停留在明显的登录页或包含 login 关键字的地址，直接视为未登录
      if (/login/i.test(currentUrl)) {
        console.log('[XhsLoginNode] 当前仍在登录相关页面（URL 含 login），判定为未登录');
        return { success: false, message: '仍在登录页面' };
      }

      // 利用你提供的 selector 精确检测“用户信息栏”是否存在头像 URL
      const domStatus = await this.page.evaluate(() => {
        const selector = '#global > div.main-container > div.side-bar > ul > div.channel-list-content > li.user.side-bar-component';
        const userItem = document.querySelector(selector);
        let avatarUrl = '';
        if (userItem) {
          const img = userItem.querySelector('img');
          if (img && img.src) {
            avatarUrl = img.src;
          }
        }
        return {
          hasUserInfo: !!avatarUrl,
          avatarUrl
        };
      });

      console.log('[XhsLoginNode] DOM 登录状态检测结果:', domStatus);

      // 只要能找到用户头像 URL，就认为已经登录
      if (domStatus && domStatus.hasUserInfo) {
        console.log('[XhsLoginNode] 发现用户头像，判定为已登录，avatarUrl:', domStatus.avatarUrl);
        return { success: true, message: '登录成功' };
      }

      console.log('[XhsLoginNode] 未检测到用户头像，判定为未登录');
      return { success: false, message: '未找到登录标识' };
    } catch (error) {
      console.error('[XhsLoginNode] 检查登录状态时出错:', error);
      return { success: false, message: '检查登录状态时出错' };
    }
  }

  /**
   * 将 cookies 保存到内存（GlobalCookieManager）
   */
  async saveCookiesToMemory() {
    try {
      if (!this.page) {
        console.error('[XhsLoginNode] 页面未初始化，无法获取 cookies');
        return;
      }
      if (!this.context) {
        console.error('[XhsLoginNode] 浏览器上下文未初始化，无法获取 cookies');
        return;
      }
      const cookies = await this.context.cookies();
      this.cookieManager.saveCookies('xhs', cookies);
      console.log(`[XhsLoginNode] 成功保存 ${cookies.length} 个 cookies 到内存`);
    } catch (error) {
      console.error('[XhsLoginNode] 保存 cookies 到内存时发生错误:', error);
      throw error;
    }
  }

  /**
   * 关闭浏览器与相关资源
   */
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
      console.log('[XhsLoginNode] 浏览器已关闭');
    } catch (error) {
      console.error('[XhsLoginNode] 关闭浏览器时发生错误:', error);
    }
  }

  /**
   * 暴露 CookieManager（如有需要可复用）
   */
  getCookieManager() {
    return this.cookieManager;
  }
}
exports.XhsLoginNode = XhsLoginNode;
