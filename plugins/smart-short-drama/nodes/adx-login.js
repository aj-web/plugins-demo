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
exports.ADXLoginNode = void 0;
const browser_manager_1 = require("../utils/browser-manager");
const file_cookie_store_1 = __importStar(require("../utils/file-cookie-store"));
const global_cookie_manager_1 = require("../utils/global-cookie-manager");
const login_state_utils_1 = require("../utils/login-state-utils");
// 统一日志初始化（利用 Node.js 模块缓存确保只执行一次）
require('./logger-init');

// 原有的 logger 引用保留（如果其他代码需要直接调用）
const logger = require("../utils/logger");

// 旧的 console 重定向代码已移除，现在由 logger-init.js 统一管理

class ADXLoginNode {
    constructor() {
        this.cookieFileName = 'adx_cookie.json';
        this.browserManager = new browser_manager_1.BrowserManager();
        this.cookieManager = global_cookie_manager_1.GlobalCookieManager.getInstance();
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.browser = null;
        this.context = null;
        this.page = null;
    }
    async ADXlogin() {
        this.browser = await this.browserManager.createBrowser();
        let cookies = null;
        try {
            cookies = await file_cookie_store_1.loadCookies(this.cookieFileName);
        }
        catch (e) {
            cookies = null;
            console.log('读取本地 cookie 失败，进入手动登录流程:', e);
        }
        if (cookies && cookies.length > 0) {
            this.context = await this.browserManager.createContextWithCookies(cookies, this.userAgent);
            this.page = await this.context.newPage();
            await this.page.goto('https://adxray-app.dataeye.com', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
        }
        else {
            this.context = await this.browserManager.createContext(this.userAgent);
            this.page = await this.context.newPage();
            await this.page.goto('https://adxray-app.dataeye.com', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
        }
        let loginResult;
        try {
            loginResult = await login_state_utils_1.LoginStateUtils.waitForLogin(this.page);
            console.log('登录结果', loginResult);
        }
        catch (error) {
            console.error('登录失败', error);
            await file_cookie_store_1.deleteCookies(this.cookieFileName);
            loginResult = { success: false, message: error.message };
        }
        if (loginResult && loginResult.success) {
            console.log('登录成功！正在保存cookies...');
            await this.saveCookiesToMemory();
            await file_cookie_store_1.saveCookies(this.cookieFileName, this.cookieManager.getCookies('adx'));
            console.log('等待3秒后关闭浏览器...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
            await this.safeCloseContext();
            return { success: true, message: '登录成功，cookies已保存' };
        }
        else {
            console.log('登录失败或取消:', loginResult?.message || '未知原因');
            await file_cookie_store_1.deleteCookies(this.cookieFileName);
            await this.safeCloseContext();
            return { success: false, message: loginResult?.message || '登录失败' };
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
            this.cookieManager.saveCookies('adx', cookies);
            console.log(`成功保存 ${cookies.length} 个cookies`);
        }
        catch (error) {
            console.error('保存cookies到内存时发生错误:', error);
            throw error;
        }
    }
    async safeCloseContext() {
        if (this.page) {
            try {
                await this.page.close();
            }
            catch { }
            this.page = null;
        }
        if (this.context) {
            try {
                await this.context.close();
            }
            catch { }
            this.context = null;
        }
        await this.browserManager.disposeBrowser();
    }
}
exports.ADXLoginNode = ADXLoginNode;
