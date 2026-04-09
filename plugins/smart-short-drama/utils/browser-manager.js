'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require('playwright');
class BrowserManager {
  constructor() {
    this.browser = null;
  }
  async createBrowser() {
    if (this.browser) return this.browser;
    const chromePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    console.log('启动Playwright浏览器...');
    console.log('使用Chrome路径:', chromePath);
    this.browser = await playwright_1.chromium.launch({
      headless: false,
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu', '--start-maximized']
    });
    return this.browser;
  }
  async createContext(userAgent) {
    const browser = await this.createBrowser();
    const context = await browser.newContext({
      userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: null
    });
    return context;
  }
  async createContextWithCookies(cookies, userAgent) {
    const browser = await this.createBrowser();
    const context = await browser.newContext({
      userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: null
    });
    if (Array.isArray(cookies) && cookies.length > 0) {
      try {
        await context.addCookies(cookies);
      } catch (e) {
        console.log('addCookies 失败，检查 cookie 格式:', e);
      }
    }
    return context;
  }
  async disposeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log('关闭浏览器时出错:', e);
      } finally {
        this.browser = null;
      }
    }
  }
  async logToBrowser(page, message, ...args) {
    try {
      await page.evaluate(
        (data) => {
          console.log(data.msg, ...data.params);
        },
        { msg: message, params: args }
      );
    } catch (e) {
      console.log('浏览器控制台输出失败:', e?.message || e);
    }
  }
}
exports.BrowserManager = BrowserManager;
