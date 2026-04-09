'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.JdLoginNode = void 0;
const playwright_1 = require('playwright');
const global_cookie_manager_1 = require('../utils/global-cookie-manager');
const file_cookie_store_1 = require('../utils/file-cookie-store');
class JdLoginNode {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cookie_file_name = 'jd_cookies.json';
    this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
  }
  async startLogin() {
    try {
      console.log('[JD][Login] 启动浏览器...');
      const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
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
          '--disable-blink-features=AutomationControlled'
        ]
      });
      this.context = await this.browser.newContext({
        userAgent: this.getRandomUserAgent(),
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        bypassCSP: true,
        locale: 'zh-CN'
      });
      this.page = await this.context.newPage();
      const cookies = (0, file_cookie_store_1.loadCookies)(this.cookie_file_name);
      if (cookies && cookies.length > 0) {
        console.log(`[JD][Login] 载入历史 cookies ${cookies.length} 个`);
        await this.context.addCookies(cookies);
        await this.page.goto('https://www.jd.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } else {
        console.log('[JD][Login] 打开登录页...');
        await this.page.goto('https://passport.jd.com/new/login.aspx?ReturnUrl=https%3A%2F%2Fwww.jd.com%2F', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      }

      const loginSuccess = await this.waitForLogin();
      //等待8s，确保保存的cookie是页面加载完成后的
      await this.page.waitForTimeout(10000);
      console.log('[JD][Login] 登录成功:', loginSuccess);
      if (loginSuccess) {
        await this.saveCookiesToMemory();
        (0, file_cookie_store_1.saveCookies)(this.cookie_file_name, this.cookieManager.getCookies('jd'));
        console.log('[JD][Login] 登录成功，已保存 cookies');
        return { success: true, message: '登录成功，cookies已保存' };
      }
      console.log('[JD][Login] 登录超时或失败');
      (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
      return { success: false, message: '登录超时或失败' };
    } catch (error) {
      console.error('[JD][Login] 登录流程出错:', error);
      (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
      return { success: false, message: error?.message || '登录失败' };
    } finally {
      await this.closeBrowser();
    }
  }
  async waitForLogin(maxDuration = 5 * 60 * 1000, interval = 2000) {
    const startTime = Date.now();
    console.log('[JD][Login] 等待用户完成登录...');
    while (Date.now() - startTime < maxDuration) {
      if (!this.page || this.page.isClosed()) {
        console.log('[JD][Login] 页面已关闭，可能用户终止了登录');
        return false;
      }
      try {
        const isLoggedIn = await this.checkLoginStatus();
        if (isLoggedIn) {
          console.log('[JD][Login] 检测到登录成功');
          return true;
        }
      } catch (error) {
        console.log('[JD][Login] 检查登录状态失败（忽略继续轮询）:', error?.message);
      }
      await this.page.waitForTimeout(interval);
    }
    console.log('[JD][Login] 登录等待超时');
    return false;
  }
  async checkLoginStatus() {
    if (!this.page) {
      return false;
    }
    try {
      const currentUrl = this.page.url();
      if (currentUrl.toLowerCase().includes('login')) {
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
        console.log(`[JD][Login] 检测到已登录用户名: ${username}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[JD][Login] 检查登录状态出错:', error);
      return false;
    }
  }
  async saveCookiesToMemory() {
    if (!this.context) {
      return;
    }
    const cookies = await this.context.cookies();
    this.cookieManager.saveCookies('jd', cookies);
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
      console.error('[JD][Login] 关闭浏览器失败:', error);
    }
  }
  getRandomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
}
exports.JdLoginNode = JdLoginNode;
