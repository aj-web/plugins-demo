"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Login1688Node = void 0;
const playwright_1 = require("playwright");
const global_cookie_manager_1 = require("../utils/global-cookie-manager");
const file_cookie_store_1 = require("../utils/file-cookie-store");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Login1688Node {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookie_file_name = "1688_cookies.json";
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
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                locale: 'zh-CN',
                timezoneId: 'Asia/Shanghai'
            });
            this.page = await this.context.newPage();
            const cookies = (0, file_cookie_store_1.loadCookies)(this.cookie_file_name);
            console.log('导航到1688登录页面...');
            if (cookies) {
                await this.context.addCookies(cookies);
                await this.page.goto('https://1688.com', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            }
            else {
                await this.page.goto('https://1688.com', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            }
            console.log('1688登录页面已打开，等待用户登录或者自动登录');
            let isLoggedIn = false;
            try {
                isLoggedIn = await this.waitForLogin();
                console.log('登录结果', isLoggedIn);
            }
            catch (error) {
                console.error('登录失败', error);
                (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
            }
            if (isLoggedIn) {
                console.log('登录成功！正在保存cookies...');
                await this.saveCookiesToMemory();
                (0, file_cookie_store_1.saveCookies)(this.cookie_file_name, this.cookieManager.getCookies('1688'));
                console.log('等待3秒后关闭浏览器...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await this.closeBrowser();
                return { success: true, message: '登录成功，cookies已保存到内存和本地文件' };
            }
            else {
                console.log('登录超时或失败');
                await this.closeBrowser();
                (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
                return { success: false, message: '登录超时或失败' };
            }
        }
        catch (error) {
            console.error('登录过程中发生错误:', error);
            (0, file_cookie_store_1.deleteCookies)(this.cookie_file_name);
            return { success: false, message: error.message };
        }
    }
    async waitForLogin() {
        try {
            console.log('等待用户登录...');
            try {
                console.log('等待页面加载完成...');
                await this.page.waitForSelector('.userCard--rUaD9E7Q', {
                    timeout: 30000,
                    state: 'attached'
                });
                console.log('页面加载完成，用户卡片元素已出现');
            }
            catch (error) {
                console.log('等待页面加载超时，继续检查登录状态...');
            }
            const startTime = Date.now();
            const timeout = 300000;
            const checkInterval = 2000;
            while (Date.now() - startTime < timeout) {
                try {
                    const isLoggedIn = await this.checkLoginStatus();
                    if (isLoggedIn) {
                        console.log('检测到用户登录成功！');
                        return true;
                    }
                    await this.page.waitForTimeout(checkInterval);
                }
                catch (error) {
                    console.error('等待登录过程中出错:', error);
                    return false;
                }
            }
            console.log('登录超时');
            return false;
        }
        catch (error) {
            console.error('等待登录失败:', error);
            return false;
        }
    }
    async saveCookiesToMemory() {
        try {
            const cookies = await this.context.cookies();
            console.log('获取到cookies数量:', cookies.length);
            this.cookieManager.saveCookies('1688', cookies);
            console.log('1688 cookies已保存到内存');
        }
        catch (error) {
            console.error('保存cookies失败:', error);
        }
    }
    async checkLoginStatus() {
        try {
            const isLoggedIn = await this.page.evaluate(() => {
                const userCard = document.querySelector('.userCard--rUaD9E7Q');
                if (!userCard) {
                    console.log('未找到用户卡片元素');
                    return false;
                }
                const nickElement = userCard.querySelector('.nick--rUaD9E7Q') ||
                    userCard.querySelector('[class*="nick"]') ||
                    userCard.querySelector('span') ||
                    userCard;
                if (!nickElement) {
                    console.log('未找到用户名元素');
                    return false;
                }
                const nickText = nickElement.textContent || '';
                console.log('检测到的用户名文本:', nickText);
                const isLoggedIn = !nickText.includes('1688买家') &&
                    !nickText.includes('登录') &&
                    nickText.length > 0;
                console.log('登录状态判断结果:', isLoggedIn);
                return isLoggedIn;
            });
            console.log('1688登录状态检查结果:', isLoggedIn);
            return isLoggedIn;
        }
        catch (error) {
            console.error('检查1688登录状态失败:', error);
            return false;
        }
    }
    getRandomUserAgent() {
        const uaList = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.79 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.53 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.5112.79 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.5060.53 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.4844.84 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5112.79 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5060.53 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.4844.84 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5112.79 Safari/537.36"
        ];
        return uaList[Math.floor(Math.random() * uaList.length)];
    }
    async saveCookiesToFile() {
        try {
            const cookies = await this.context.cookies();
            console.log('获取到cookies数量:', cookies.length);
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            await fs.promises.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');
            console.log('1688 cookies已保存到本地文件:', cookieFilePath);
            return true;
        }
        catch (error) {
            console.error('保存cookies到本地文件失败:', error);
            return false;
        }
    }
    checkLocalCookieFileExists() {
        try {
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            const exists = fs.existsSync(cookieFilePath);
            console.log('本地cookie文件检查结果:', exists ? '存在' : '不存在', cookieFilePath);
            return exists;
        }
        catch (error) {
            console.error('检查本地cookie文件失败:', error);
            return false;
        }
    }
    async loadCookiesFromFile() {
        try {
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            if (!fs.existsSync(cookieFilePath)) {
                console.log('本地cookie文件不存在:', cookieFilePath);
                return false;
            }
            const cookieData = await fs.promises.readFile(cookieFilePath, 'utf8');
            const cookies = JSON.parse(cookieData);
            if (!Array.isArray(cookies) || cookies.length === 0) {
                console.log('本地cookie文件为空或格式错误');
                return false;
            }
            console.log('从本地文件加载到cookies数量:', cookies.length);
            if (this.context) {
                await this.context.addCookies(cookies);
                console.log('本地cookies已加载到浏览器上下文');
                return true;
            }
            else {
                console.log('浏览器上下文未初始化，无法加载cookies');
                return false;
            }
        }
        catch (error) {
            console.error('从本地文件加载cookies失败:', error);
            return false;
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
            console.log('1688浏览器已关闭');
        }
        catch (error) {
            console.error('关闭1688浏览器失败:', error);
        }
    }
}
exports.Login1688Node = Login1688Node;
