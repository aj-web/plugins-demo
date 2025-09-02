"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Login1688Node = void 0;
const { chromium } = require('playwright');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');
const fs = require('fs');
const path = require('path');

class Login1688Node {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookieManager = GlobalCookieManager.getInstance();
    }

    /**
     * 启动浏览器并打开1688登录页面
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

            // 创建上下文
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

            // 创建页面
            this.page = await this.context.newPage();

            // 尝试加载本地cookies
            console.log('尝试加载本地cookies...');
            const cookiesLoaded = await this.loadCookiesFromFile();
            if (cookiesLoaded) {
                console.log('本地cookies加载成功，尝试直接访问1688...');
            }

            // 导航到1688登录页面
            console.log('导航到1688登录页面...');
            await this.page.goto('https://1688.com', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // 等待登录成功
            let isLoggedIn = false;
            try {
                isLoggedIn = await this.waitForLogin();
                console.log('登录结果', isLoggedIn);
            } catch (error) {
                console.error('登录失败', error);
            }

            if (isLoggedIn) {
                console.log('登录成功！正在保存cookies...');
                
                // 保存cookies到内存
                await this.saveCookiesToMemory();
                
                // 保存cookies到本地文件
                await this.saveCookiesToFile();
                
                // 等待3秒
                console.log('等待3秒后关闭浏览器...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 关闭浏览器
                await this.closeBrowser();
                
                return { success: true, message: '登录成功，cookies已保存到内存和本地文件' };
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
            console.log('等待用户登录...');
            
            // 首先等待页面加载完成，确保用户卡片元素出现
            try {
                console.log('等待页面加载完成...');
                await this.page.waitForSelector('.userCard--rUaD9E7Q', { 
                    timeout: 30000,
                    state: 'attached'
                });
                console.log('页面加载完成，用户卡片元素已出现');
            } catch (error) {
                console.log('等待页面加载超时，继续检查登录状态...');
            }
            
            const startTime = Date.now();
            const timeout = 300000; // 5分钟超时
            const checkInterval = 2000; // 每2秒检查一次
            
            while (Date.now() - startTime < timeout) {
                try {
                    const isLoggedIn = await this.checkLoginStatus();
                    
                    if (isLoggedIn) {
                        console.log('检测到用户登录成功！');
                        return true;
                    }
                    
                    // 等待一段时间后再次检查
                    await this.page.waitForTimeout(checkInterval);
                    
                } catch (error) {
                    console.error('等待登录过程中出错:', error);
                    return false;
                }
            }
            
            console.log('登录超时');
            return false;
        } catch (error) {
            console.error('等待登录失败:', error);
            return false;
        }
    }

    /**
     * 保存cookies到内存
     */
    async saveCookiesToMemory() {
        try {
            const cookies = await this.context.cookies();
            console.log('获取到cookies数量:', cookies.length);
            
            // 保存到全局cookie管理器
            this.cookieManager.saveCookies('1688', cookies);
            
            console.log('1688 cookies已保存到内存');
        } catch (error) {
            console.error('保存cookies失败:', error);
        }
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        try {
            const isLoggedIn = await this.page.evaluate(() => {
                // 查找用户卡片元素
                const userCard = document.querySelector('.userCard--rUaD9E7Q');
                if (!userCard) {
                    console.log('未找到用户卡片元素');
                    return false;
                }
                
                // 查找用户名元素
                const nickElement = userCard.querySelector('.nick--rUaD9E7Q') || 
                                  userCard.querySelector('[class*="nick"]') ||
                                  userCard.querySelector('span') ||
                                  userCard;
                
                if (!nickElement) {
                    console.log('未找到用户名元素');
                    return false;
                }

                // 检查用户名文本内容
                const nickText = nickElement.textContent || '';
                console.log('检测到的用户名文本:', nickText);
                
                // 已登录：显示具体用户名（如"泡影"）
                // 未登录：显示"尊贵的1688买家"或其他默认文本
                const isLoggedIn = !nickText.includes('1688买家') && 
                                 !nickText.includes('登录') && 
                                 nickText.length > 0;
                
                console.log('登录状态判断结果:', isLoggedIn);
                return isLoggedIn;
            });

            console.log('1688登录状态检查结果:', isLoggedIn);
            return isLoggedIn;

        } catch (error) {
            console.error('检查1688登录状态失败:', error);
            return false;
        }
    }

    /**
     * 获取随机User-Agent
     */
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

    /**
     * 保存cookies到本地1688-cookie.json文件
     */
    async saveCookiesToFile() {
        try {
            const cookies = await this.context.cookies();
            console.log('获取到cookies数量:', cookies.length);
            
            // 构建文件路径（与1688-login.js同层级）
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            
            // 保存cookies到文件
            await fs.promises.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), 'utf8');
            
            console.log('1688 cookies已保存到本地文件:', cookieFilePath);
            return true;
        } catch (error) {
            console.error('保存cookies到本地文件失败:', error);
            return false;
        }
    }

    /**
     * 检查是否存在1688-cookie.json文件
     */
    checkLocalCookieFileExists() {
        try {
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            const exists = fs.existsSync(cookieFilePath);
            console.log('本地cookie文件检查结果:', exists ? '存在' : '不存在', cookieFilePath);
            return exists;
        } catch (error) {
            console.error('检查本地cookie文件失败:', error);
            return false;
        }
    }

    /**
     * 检查是否存在1688-cookie.json文件并加载本地cookies
     */
    async loadCookiesFromFile() {
        try {
            // 构建文件路径（与1688-login.js同层级）
            const cookieFilePath = path.join(__dirname, '1688-cookie.json');
            
            // 检查文件是否存在
            if (!fs.existsSync(cookieFilePath)) {
                console.log('本地cookie文件不存在:', cookieFilePath);
                return false;
            }
            
            // 读取并解析cookie文件
            const cookieData = await fs.promises.readFile(cookieFilePath, 'utf8');
            const cookies = JSON.parse(cookieData);
            
            if (!Array.isArray(cookies) || cookies.length === 0) {
                console.log('本地cookie文件为空或格式错误');
                return false;
            }
            
            console.log('从本地文件加载到cookies数量:', cookies.length);
            
            // 将cookies添加到浏览器上下文
            if (this.context) {
                await this.context.addCookies(cookies);
                console.log('本地cookies已加载到浏览器上下文');
                
                return true;
            } else {
                console.log('浏览器上下文未初始化，无法加载cookies');
                return false;
            }
            
        } catch (error) {
            console.error('从本地文件加载cookies失败:', error);
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
            console.log('1688浏览器已关闭');
        } catch (error) {
            console.error('关闭1688浏览器失败:', error);
        }
    }
}

exports.Login1688Node = Login1688Node;
