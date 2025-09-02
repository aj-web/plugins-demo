"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalCookieManager = void 0;

/**
 * 全局Cookie管理器 - 单例模式
 * 用于在不同节点之间共享Cookie，支持多平台
 */
class GlobalCookieManager {
    constructor() {
        if (GlobalCookieManager.instance) {
            return GlobalCookieManager.instance;
        }
        
        this.cookiesByPlatform = new Map(); // 按平台存储cookies
        this.isInitialized = false;
        GlobalCookieManager.instance = this;
    }

    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!GlobalCookieManager.instance) {
            GlobalCookieManager.instance = new GlobalCookieManager();
        }
        return GlobalCookieManager.instance;
    }

    /**
     * 保存cookie到全局存储
     * @param {string} platform - 平台名称 (如 'taobao', '1688')
     * @param {Array} cookies - cookie数组
     */
    saveCookies(platform, cookies) {
        this.cookiesByPlatform.set(platform, cookies);
        this.isInitialized = true;
        console.log(`[GlobalCookieManager] 保存了 ${cookies.length} 个${platform} cookies`);
    }

    /**
     * 获取指定平台的cookies
     * @param {string} platform - 平台名称
     * @returns {Array} cookie数组
     */
    getCookies(platform) {
        return this.cookiesByPlatform.get(platform) || [];
    }



    /**
     * 检查指定平台是否有可用的cookies
     * @param {string} platform - 平台名称
     * @returns {boolean}
     */
    hasCookies(platform) {
        const cookies = this.cookiesByPlatform.get(platform);
        return cookies && cookies.length > 0;
    }



    /**
     * 清除指定平台的cookies
     * @param {string} platform - 平台名称
     */
    clearCookies(platform) {
        this.cookiesByPlatform.delete(platform);
        console.log(`[GlobalCookieManager] 已清除${platform}的cookies`);
    }

    /**
     * 清除所有cookies
     */
    clearAllCookies() {
        this.cookiesByPlatform.clear();
        this.isInitialized = false;
        console.log('[GlobalCookieManager] 已清除所有cookies');
    }

    
}

exports.GlobalCookieManager = GlobalCookieManager; 