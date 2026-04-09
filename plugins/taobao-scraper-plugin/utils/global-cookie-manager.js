"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalCookieManager = void 0;
class GlobalCookieManager {
    constructor() {
        this.cookiesByPlatform = new Map();
        if (GlobalCookieManager.instance) {
            return GlobalCookieManager.instance;
        }
        GlobalCookieManager.instance = this;
    }
    static getInstance() {
        if (!GlobalCookieManager.instance) {
            GlobalCookieManager.instance = new GlobalCookieManager();
        }
        return GlobalCookieManager.instance;
    }
    saveCookies(platform, cookies) {
        this.cookiesByPlatform.set(platform, cookies);
        console.log(`[GlobalCookieManager] 保存了 ${cookies.length} 个${platform} cookies`);
    }
    getCookies(platform) {
        return this.cookiesByPlatform.get(platform) || [];
    }
    hasCookies(platform) {
        const cookies = this.cookiesByPlatform.get(platform);
        return Boolean(cookies && cookies.length > 0);
    }
    clearCookies(platform) {
        this.cookiesByPlatform.delete(platform);
        console.log(`[GlobalCookieManager] 已清除${platform}的cookies`);
    }
    clearAllCookies() {
        this.cookiesByPlatform.clear();
        console.log('[GlobalCookieManager] 已清除所有cookies');
    }
}
exports.GlobalCookieManager = GlobalCookieManager;
