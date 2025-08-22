"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaobaoLoginNode = void 0;
const { chromium } = require('playwright');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class TaobaoLoginNode {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookieManager = GlobalCookieManager.getInstance();
    }

    /**
     * 启动浏览器并打开淘宝登录页面
     */
    async startLogin() {
        try {
            console.log('启动Playwright浏览器...');
            
            // 启动浏览器
            this.browser = await chromium.launch({
                headless: false,
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

            // 创建上下文
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            // 创建页面
            this.page = await this.context.newPage();

            // 导航到淘宝登录页面
            console.log('导航到淘宝登录页面...');
            await this.page.goto('https://login.taobao.com/member/login.jhtml', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // 等待页面加载完成
            await this.page.waitForSelector('.login-box', { timeout: 10000 });

            console.log('淘宝登录页面已打开，等待用户扫码登录...');

            // 等待登录成功
            let isLoggedIn = false;
            try{
                isLoggedIn = await this.waitForLogin();
                console.log('登录结果', isLoggedIn);
            }catch(error){
                console.error('登录失败', error);
            }

            if (isLoggedIn) {
                console.log('登录成功！正在保存cookies...');
                
                // 保存cookies到内存
                await this.saveCookiesToMemory();
                
                // 等待3秒
                console.log('等待3秒后关闭浏览器...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 关闭浏览器
                await this.closeBrowser();
                
                return { success: true, message: '登录成功，cookies已保存' };
            } else {
                console.log('登录超时或失败');
                await this.closeBrowser();
                return { success: false, message: '登录超时或失败' };
            }

        } catch (error) {
            console.error('登录过程中发生错误:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 等待用户登录
     */
    async waitForLogin() {
        try {
            // 等待登录成功后的重定向或特定元素
            await this.page.waitForFunction(() => {
                // 检查是否已登录（URL变化或特定元素出现）
                return window.location.href.includes('taobao.com') && 
                       !window.location.href.includes('login');
            }, { timeout: 300000 }); // 5分钟超时

            return true;
        } catch (error) {
            console.error('等待登录超时:', error);
            return false;
        }
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        try {
            console.log('开始检查登录状态...');
            
            // 检查是否存在用户昵称（已登录状态的特征）
            const userNick = await this.page.$('.J_UserMemberNick');
            if (userNick) {
                const nickText = await userNick.textContent();
                if (nickText && nickText.trim()) {
                    console.log(`发现用户昵称: ${nickText.trim()}`);
                    return true;
                }
            }
            
            // 检查是否存在购物车数量（已登录状态的特征）
            const cartElement = await this.page.$('.member-cart strong');
            if (cartElement) {
                const cartText = await cartElement.textContent();
                if (cartText && cartText.trim()) {
                    console.log(`发现购物车数量: ${cartText.trim()}`);
                    return true;
                }
            }
            
            // 检查是否存在待收货等订单信息（已登录状态的特征）
            const orderElements = await this.page.$$('.member-awaiting strong, .member-delivery strong, .member-nonpayment strong, .member-comment strong');
            if (orderElements.length > 0) {
                for (const element of orderElements) {
                    const text = await element.textContent();
                    if (text && text.trim() !== '') {
                        console.log(`发现订单信息: ${text.trim()}`);
                        return true;
                    }
                }
            }
            
            // 检查是否存在用户头像区域（已登录状态的特征）
            const avatarElement = await this.page.$('.J_UserMemberAvatar');
            if (avatarElement) {
                console.log('发现用户头像区域');
                return true;
            }
            
            // 检查是否存在"我的淘宝"链接（已登录状态的特征）
            const myTaobaoLink = await this.page.$('a[href*="i.taobao.com"]');
            if (myTaobaoLink) {
                console.log('发现"我的淘宝"链接');
                return true;
            }
            
            // 检查是否存在"收藏夹"链接（已登录状态的特征）
            const favoriteLink = await this.page.$('a[href*="favorite.taobao.com"]');
            if (favoriteLink) {
                console.log('发现"收藏夹"链接');
                return true;
            }
            
            // 检查是否存在"已买到"链接（已登录状态的特征）
            const boughtLink = await this.page.$('a[href*="buyertrade.taobao.com"]');
            if (boughtLink) {
                console.log('发现"已买到"链接');
                return true;
            }
            
            // 检查是否存在"足迹"链接（已登录状态的特征）
            const footprintLink = await this.page.$('a[href*="footMark"]');
            if (footprintLink) {
                console.log('发现"足迹"链接');
                return true;
            }
            
            console.log('未找到明确的登录状态标识，默认为未登录');
            return false;
        } catch (error) {
            console.error('检查登录状态时出错:', error);
            return false;
        }
    }

    /**
     * 关闭浏览器
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
            console.log('浏览器已关闭');
        } catch (error) {
            console.error('关闭浏览器时发生错误:', error);
        }
    }

    /**
     * 保存cookies到内存
     */
    async saveCookiesToMemory() {
        try {
            if (!this.page) {
                console.error('页面未初始化，无法获取cookies');
                return;
            }

            const cookies = await this.context.cookies();
            this.cookieManager.saveCookies(cookies);
            console.log(`成功保存 ${cookies.length} 个cookies`);

        } catch (error) {
            console.error('保存cookies到内存时发生错误:', error);
            throw error;
        }
    }

    /**
     * 获取CookieManager实例
     */
    getCookieManager() {
        return this.cookieManager;
        }
    }

exports.TaobaoLoginNode = TaobaoLoginNode;
