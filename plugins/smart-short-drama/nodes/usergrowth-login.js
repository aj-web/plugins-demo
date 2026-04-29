/**
 * UserGrowth 登录节点
 * 负责处理用户增长平台的登录流程
 */

// 统一日志初始化
require('./logger-init');

const { BrowserManager } = require('../utils/browser-manager');
const FileCookieStore = require('../utils/file-cookie-store');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class UserGrowthLoginNode {
  constructor() {
    this.cookieFileName = 'usergrowth_cookie.json';
    this.browserManager = new BrowserManager();
    this.cookieManager = GlobalCookieManager.getInstance();
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * UserGrowth 登录方法
   * @returns {Promise<Object>} 登录结果
   */
  async UserGrowthLogin() {
    const loginUrl = 'https://usergrowth.com.cn/open/customer';

    console.log('[UserGrowthLogin] 开始登录流程...');

    this.browser = await this.browserManager.createBrowser();
    let cookies = null;

    try {
      cookies = await FileCookieStore.loadCookies(this.cookieFileName);
      console.log(`[UserGrowthLogin] 从文件读取到 ${cookies?.length || 0} 个 Cookie`);
    } catch (e) {
      cookies = null;
      console.log('[UserGrowthLogin] 读取本地 Cookie 失败，进入手动登录流程:', e);
    }

    // 创建浏览器上下文
    if (cookies && cookies.length > 0) {
      console.log('[UserGrowthLogin] 使用已有 Cookie 创建上下文');
      this.context = await this.browserManager.createContextWithCookies(cookies, this.userAgent);
      this.page = await this.context.newPage();
      await this.page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } else {
      console.log('[UserGrowthLogin] 创建新的上下文');
      this.context = await this.browserManager.createContext(this.userAgent);
      this.page = await this.context.newPage();
      await this.page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    }

    // 等待用户登录
    let loginResult;
    try {
      console.log('[UserGrowthLogin] 开始等待用户登录...');
      loginResult = await this.waitForLogin(this.page);
      console.log('[UserGrowthLogin] 登录结果:', loginResult);
    } catch (error) {
      console.error('[UserGrowthLogin] 登录失败:', error);
      await FileCookieStore.deleteCookies(this.cookieFileName);
      loginResult = { success: false, message: error.message };
    }

    // 处理登录结果
    if (loginResult && loginResult.success) {
      console.log('[UserGrowthLogin] 登录成功！正在保存 Cookies...');
      await this.saveCookiesToMemory();
      await FileCookieStore.saveCookies(this.cookieFileName, this.cookieManager.getCookies('usergrowth'));

      console.log('[UserGrowthLogin] 等待3秒后关闭浏览器...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await this.safeCloseContext();

      return { success: true, message: '登录成功，Cookies已保存' };
    } else {
      console.log('[UserGrowthLogin] 登录失败或取消:', loginResult?.message || '未知原因');
      await FileCookieStore.deleteCookies(this.cookieFileName);
      await this.safeCloseContext();

      return { success: false, message: loginResult?.message || '登录失败' };
    }
  }

  /**
   * 等待用户完成登录
   * @param {Object} page - Playwright 页面对象
   * @param {number} maxAttempts - 最大检查次数（默认60次，共2分钟）
   * @param {number} interval - 检查间隔（毫秒，默认2秒）
   * @returns {Promise<Object>} 登录结果
   */
  async waitForLogin(page, maxAttempts = 60, interval = 2000) {
    console.log('[UserGrowthLogin] 开始轮询检查登录状态...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[UserGrowthLogin] 第 ${attempt} 次检查登录状态...`);

      // 检查页面是否被关闭
      try {
        if (page && page.isClosed()) {
          console.log('[UserGrowthLogin] 检测到页面已关闭，用户取消了登录');
          return { success: false, message: '登录取消' };
        }
      } catch (error) {
        console.log('[UserGrowthLogin] 页面状态检查异常，可能已关闭:', error.message);
        return { success: false, message: '登录取消' };
      }

      // 检查登录状态
      try {
        const currentUrl = page.url();
        console.log(`[UserGrowthLogin] 当前 URL: ${currentUrl}`);

        // 判断是否完成登录：URL不包含"login"
        if (!currentUrl.includes('login')) {
          console.log(`[UserGrowthLogin] 登录成功！共检查了 ${attempt} 次`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return { success: true };
        } else {
          console.log('[UserGrowthLogin] 仍在登录页面，继续等待...');
        }
      } catch (error) {
        console.log(`[UserGrowthLogin] 第 ${attempt} 次检查出错（忽略错误继续检查）: ${error.message}`);
      }

      // 等待下一次检查
      if (attempt < maxAttempts) {
        console.log(`[UserGrowthLogin] 等待 ${interval}ms 后进行下一次检查...`);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    console.log(`[UserGrowthLogin] 登录检查超时，共检查了 ${maxAttempts} 次`);
    return { success: false, message: '登录检查超时' };
  }

  /**
   * 检查登录状态
   * @returns {Promise<Object>} 登录状态检查结果
   */
  async checkLoginStatus() {
    try {
      console.log('[UserGrowthLogin] 检查登录状态...');

      // 检查内存中的 Cookie
      const memoryCookies = this.cookieManager.getCookies('usergrowth');
      if (memoryCookies && memoryCookies.length > 0) {
        console.log(`[UserGrowthLogin] 内存中有 ${memoryCookies.length} 个 Cookie`);
        return { success: true, message: '已登录（内存）' };
      }

      // 检查文件中的 Cookie
      const fileCookies = await FileCookieStore.loadCookies(this.cookieFileName);
      if (fileCookies && fileCookies.length > 0) {
        console.log(`[UserGrowthLogin] 文件中有 ${fileCookies.length} 个 Cookie`);
        // 加载到内存
        this.cookieManager.saveCookies('usergrowth', fileCookies);
        return { success: true, message: '已登录（文件）' };
      }

      console.log('[UserGrowthLogin] 未找到 Cookie，需要登录');
      return { success: false, message: '未登录' };
    } catch (error) {
      console.error('[UserGrowthLogin] 检查登录状态失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 保存 Cookies 到内存
   */
  async saveCookiesToMemory() {
    try {
      if (!this.page) {
        console.error('[UserGrowthLogin] 页面未初始化，无法获取 Cookies');
        return;
      }
      if (!this.context) {
        console.error('[UserGrowthLogin] 浏览器上下文未初始化，无法获取 Cookies');
        return;
      }

      const cookies = await this.context.cookies();
      this.cookieManager.saveCookies('usergrowth', cookies);
      console.log(`[UserGrowthLogin] 成功保存 ${cookies.length} 个 Cookies 到内存`);
    } catch (error) {
      console.error('[UserGrowthLogin] 保存 Cookies 到内存时发生错误:', error);
      throw error;
    }
  }

  /**
   * 安全关闭浏览器上下文
   */
  async safeCloseContext() {
    if (this.page) {
      try {
        await this.page.close();
      } catch {}
      this.page = null;
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch {}
      this.context = null;
    }

    await this.browserManager.disposeBrowser();
    console.log('[UserGrowthLogin] 浏览器上下文已关闭');
  }
}

exports.UserGrowthLoginNode = UserGrowthLoginNode;
