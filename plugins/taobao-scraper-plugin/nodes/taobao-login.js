"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaobaoLoginNode = void 0;
const playwright_1 = require("playwright");
const global_cookie_manager_1 = require("../utils/global-cookie-manager");
const file_cookie_store_1 = require("../utils/file-cookie-store");
class TaobaoLoginNode {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookie_file_name = "taobao_cookies.json";
        this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
    }
    async startLogin() {
        try {
            console.log('启动Playwright浏览器...');
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
                    '--disable-gpu'
                ]
            });
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            this.page = await this.context.newPage();
            const cookies = (0, file_cookie_store_1.loadCookies)(this.cookie_file_name);
            console.log('导航到淘宝登录页面...');
            if (cookies) {
                await this.context.addCookies(cookies);
                await this.page.goto('https://login.taobao.com/havanaone/login/login.htm?bizName=taobao&spm=a21bo.jianhua/a.action.dlogin.5af92a89D4lfpE&f=top&redirectURL=http%3A%2F%2Fwww.taobao.com%2F', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            }
            else {
                await this.page.goto('https://login.taobao.com/havanaone/login/login.htm?bizName=taobao&spm=a21bo.jianhua/a.action.dlogin.5af92a89D4lfpE&f=top&redirectURL=http%3A%2F%2Fwww.taobao.com%2F', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await this.page.waitForSelector('.login-box', { timeout: 10000 });
            }
            console.log('淘宝登录页面已打开，等待用户登录或者自动登录');
            let loginResult = null;
            try {
                loginResult = await this.waitForLogin();
                console.log('登录结果', loginResult);
            }
            catch (error) {
                console.error('登录失败', error);
                (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
                loginResult = { success: false, message: error.message };
            }
            if (loginResult && loginResult.success) {
                console.log('登录成功！正在保存cookies...');
                await this.saveCookiesToMemory();
                (0, file_cookie_store_1.saveCookies)(this.cookie_file_name, this.cookieManager.getCookies('taobao'));
                console.log('等待3秒后关闭浏览器...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await this.closeBrowser();
                return { success: true, message: '登录成功，cookies已保存' };
            }
            else {
                console.log('登录失败或取消:', loginResult?.message || '未知原因');
                (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
                await this.closeBrowser();
                return { success: false, message: loginResult?.message || '登录失败' };
            }
        }
        catch (error) {
            console.error('登录过程中发生错误:', error);
            (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
            return { success: false, message: error.message };
        }
    }
    async waitForLogin(maxAttempts = 100, interval = 2000) {
        console.log('开始轮询检查登录状态...');
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`第 ${attempt} 次检查登录状态...`);
            try {
                if (this.page && this.page.isClosed()) {
                    console.log('检测到页面已关闭，用户取消了登录');
                    return { success: false, message: '登录取消' };
                }
            }
            catch (error) {
                console.log('页面状态检查异常，可能已关闭:', error.message);
                return { success: false, message: '登录取消' };
            }
            try {
                const result = await this.checkLoginStatus();
                if (result.success) {
                    console.log(`登录成功！共检查了 ${attempt} 次`);
                    return result;
                }
            }
            catch (error) {
                console.log(`第 ${attempt} 次检查出错（忽略错误继续检查）: ${error.message}`);
            }
            if (attempt < maxAttempts) {
                console.log(`等待 ${interval}ms 后进行下一次检查...`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        console.log(`登录检查超时，共检查了 ${maxAttempts} 次`);
        return { success: false, message: '登录检查超时' };
    }
    async checkLoginStatus() {
        try {
            console.log('开始检查登录状态...');
            if (!this.page) {
                return { success: false, message: '页面未初始化' };
            }
            const userNick = await this.page.$('.J_UserMemberNick');
            if (userNick) {
                const nickText = await userNick.textContent();
                if (nickText && nickText.trim()) {
                    console.log(`发现用户昵称: ${nickText.trim()}`);
                    return { success: true, message: `登录成功` };
                }
            }
            const cartElement = await this.page.$('.member-cart strong');
            if (cartElement) {
                const cartText = await cartElement.textContent();
                if (cartText && cartText.trim()) {
                    console.log(`发现购物车数量: ${cartText.trim()}`);
                    return { success: true, message: `登录成功` };
                }
            }
            console.log('未找到明确的登录状态标识，默认为未登录');
            return { success: false, message: '未找到登录标识' };
        }
        catch (error) {
            console.error('检查登录状态时出错:', error);
            return { success: false, message: '检查登录状态时出错' };
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
            console.log('浏览器已关闭');
        }
        catch (error) {
            console.error('关闭浏览器时发生错误:', error);
        }
    }
    async saveCookiesToMemory() {
        try {
            if (!this.page) {
                console.error('页面未初始化，无法获取cookies');
                return;
            }
            if (!this.context) {
                console.error('浏览器上下文未初始化，无法获取cookies');
                return;
            }
            const cookies = await this.context.cookies();
            this.cookieManager.saveCookies('taobao', cookies);
            console.log(`成功保存 ${cookies.length} 个cookies`);
        }
        catch (error) {
            console.error('保存cookies到内存时发生错误:', error);
            throw error;
        }
    }
    getCookieManager() {
        return this.cookieManager;
    }
}
exports.TaobaoLoginNode = TaobaoLoginNode;
