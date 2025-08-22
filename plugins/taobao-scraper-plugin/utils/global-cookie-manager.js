"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalCookieManager = void 0;

/**
 * 全局Cookie管理器 - 单例模式
 * 用于在不同节点之间共享Cookie
 */
class GlobalCookieManager {
    constructor() {
        if (GlobalCookieManager.instance) {
            return GlobalCookieManager.instance;
        }
        
        this.cookies = [];
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
     * @param {Array} cookies - cookie数组
     */
    saveCookies(cookies) {
        this.cookies = cookies;
        this.isInitialized = true;
        console.log(`[GlobalCookieManager] 保存了 ${cookies.length} 个cookies`);
    }

    /**
     * 获取所有cookies
     * @returns {Array} cookie数组
     */
    getCookies() {
        return this.cookies;
    }

    /**
     * 检查是否有可用的cookies
     * @returns {boolean}
     */
    hasCookies() {
        return this.isInitialized && this.cookies.length > 0;
    }

    /**
     * 清除所有cookies
     */
    clearCookies() {
        this.cookies = [];
        this.isInitialized = false;
        console.log('[GlobalCookieManager] 已清除所有cookies');
    }

    /**
     * 获取cookies数量
     * @returns {number}
     */
    getCookiesCount() {
        return this.cookies.length;
    }
}

exports.GlobalCookieManager = GlobalCookieManager; 