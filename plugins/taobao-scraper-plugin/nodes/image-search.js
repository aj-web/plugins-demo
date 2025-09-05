"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSearchNode = void 0;

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 导入全局Cookie管理器
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class ImageSearchNode {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.playwright = null;
        this.cookieManager = GlobalCookieManager.getInstance();
        this.searchResults = [];
    }

    /**
     * 启动浏览器
     */
    async startBrowser() {
        try {
            console.log('启动浏览器...');
            
            // 启动Chrome浏览器
            const browserArgs = [
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-dev-shm-usage",
                "--disable-gpu"
            ];

            this.browser = await chromium.launch({
                headless: false,
                args: browserArgs
            });

            // 创建浏览器上下文
            this.context = await this.browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            });

            this.page = await this.context.newPage();
            console.log('浏览器启动成功');
        } catch (error) {
            console.error('启动浏览器失败:', error);
            throw error;
        }
    }

    /**
     * 关闭浏览器
     */
    async closeBrowser() {
        try {
            console.log('正在关闭浏览器...');
            
            // 关闭页面
            if (this.page) {
                await this.page.close();
                this.page = null;
                console.log('页面已关闭');
            }
            
            // 关闭浏览器上下文
            if (this.context) {
                await this.context.close();
                this.context = null;
                console.log('浏览器上下文已关闭');
            }
            
            // 关闭浏览器
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                console.log('浏览器已关闭');
            }
            
            console.log('浏览器关闭完成');
        } catch (error) {
            console.error('关闭浏览器时出错:', error);
            // 即使出错也要清理引用
            this.page = null;
            this.context = null;
            this.browser = null;
        }
    }

    /**
     * 基于Cookie进行登录
     */
    async loginWithCookies() {
        try {
            const cookies = this.cookieManager.getCookies('taobao');
            if (cookies.length > 0) {
                await this.context.addCookies(cookies);
                console.log(`已添加 ${cookies.length} 个cookies`);
                return { success: true };
            } else {
                return { success: false, message: '没有可用的cookies' };
            }
        } catch (error) {
            console.error('Cookie登录失败:', error);
            return { success: false, message: error.message };
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
     * 刷新页面避免弹窗
     */
    async refreshPage() {
        try {
            console.log(' 刷新页面避免弹窗...');
            await this.page.reload();
            await this.page.waitForTimeout(10000);

            // 关闭可能的弹窗
            try {
                const closeButtons = await this.page.$$('.close, .modal-close, .dialog-close');
                for (const button of closeButtons) {
                    try {
                        await button.click({ timeout: 1000 });
                    } catch (e) {
                        // 忽略点击失败
                    }
                }
            } catch (e) {
                // 忽略弹窗关闭失败
            }
        } catch (error) {
            console.error('刷新页面失败:', error);
        }
    }

    /**
     * 从本地路径加载图片文件并返回FilePayload对象
     */
    async loadLocalImage(imagePath) {
        try {
            console.log(`加载本地图片: ${imagePath}`);
            
            // 检查文件是否存在
            if (!fs.existsSync(imagePath)) {
                console.error(`图片文件不存在: ${imagePath}`);
                return null;
            }

            // 读取文件内容
            const fileContent = fs.readFileSync(imagePath);
            
            // 获取文件扩展名
            const ext = path.extname(imagePath).toLowerCase();
            let mimeType = 'image/jpeg'; // 默认MIME类型
            
            // 根据扩展名设置正确的MIME类型
            switch (ext) {
                case '.jpg':
                case '.jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case '.png':
                    mimeType = 'image/png';
                    break;
                case '.gif':
                    mimeType = 'image/gif';
                    break;
                case '.webp':
                    mimeType = 'image/webp';
                    break;
                case '.bmp':
                    mimeType = 'image/bmp';
                    break;
                default:
                    console.warn(`未知的图片格式: ${ext}，使用默认MIME类型`);
            }
            
            // 获取文件名
            const fileName = path.basename(imagePath);
            
            return {
                name: fileName,
                mimeType: mimeType,
                buffer: fileContent
            };
        } catch (error) {
            console.error('加载本地图片失败:', error);
            return null;
        }
    }

    /**
     * 智能加载本地图片文件
     */
    async loadImageByPath(filePath) {
        // 如果filePath是完整路径，直接使用
        if (path.isAbsolute(filePath) || filePath.includes(path.sep)) {
            return await this.loadLocalImage(filePath);
        }
        
        // 如果是相对路径或文件名，尝试在常见目录中查找
        const possiblePaths = [
            filePath, // 直接作为路径
            path.join(__dirname, filePath), // 相对于当前脚本目录
            path.join(__dirname, '../uploads', filePath), // uploads目录
            path.join(__dirname, '../../uploads', filePath), // 上级uploads目录
            path.join(__dirname, '../temp', filePath), // temp目录
            path.join(__dirname, '../../temp', filePath), // 上级temp目录
            path.join(process.cwd(), 'uploads', filePath), // 项目根目录下的uploads
            path.join(process.cwd(), 'temp', filePath), // 项目根目录下的temp
        ];
        
        for (const imagePath of possiblePaths) {
            if (fs.existsSync(imagePath)) {
                console.log(`找到图片文件: ${imagePath}`);
                return await this.loadLocalImage(imagePath);
            }
        }
        
        console.error(`未找到图片文件: ${filePath}`);
        console.log('尝试过的路径:', possiblePaths);
        return null;
    }

    /**
     * 执行图片搜索
     */
    async uploadImageSearch(filePath) {
        console.log('uploadImageSearch', filePath);
        try {
            console.log(` 开始图片搜索: ${filePath}`);

            // 加载本地图片文件
            const filePayload = await this.loadImageByPath(filePath);
            if (!filePayload) {
                console.log(`本地图片加载失败: ${filePath}`);
                return false;
            }

            // 1. 直接寻找搜同款按钮（不需要点击搜索框）
            console.log('寻找搜同款按钮...');

            // 添加页面调试信息
            try {
                const pageTitle = await this.page.title();
                const currentUrl = this.page.url();
                console.log(`页面标题: ${pageTitle}`);
                console.log(`当前URL: ${currentUrl}`);
                
                // 获取页面内容并检查是否包含"搜同款"
                const pageContent = await this.page.content();
                if (pageContent.includes('搜同款')) {
                    console.log('页面中包含"搜同款"文本');
                } else {
                    console.log('页面中未找到"搜同款"文本');
                }
            } catch (e) {
                console.log(`获取页面信息失败: ${e}`);
            }

            const searchSameSelectors = [
                '.image-search-icon-outerMode',
                '[data-spm="image_search_icon"]',
                'text="搜同款"',
                '[title="搜同款"]',
                '.search-camera',
                '[data-spm*="camera"]',
                '[class*="camera"]',
                '.image-icon-text'
            ];

            let clicked = false;
            for (const selector of searchSameSelectors) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        console.log(`找到元素: ${selector}`);

                        // 尝试移除拦截元素
                        try {
                            await this.page.evaluate(`
                                const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                                interceptors.forEach(el => {
                                    if (el.style) {
                                        el.style.pointerEvents = 'none';
                                        el.style.display = 'none';
                                    }
                                });
                            `);
                            console.log('已移除拦截元素');
                        } catch (e) {
                            // 忽略移除失败
                        }

                        // 使用JavaScript点击
                        try {
                            await this.page.evaluate(`
                                (selector) => {
                                    const element = document.querySelector(selector);
                                    if (element) {
                                        element.click();
                                        return true;
                                    }
                                    return false;
                                }
                            `, selector);
                            console.log(`已通过JavaScript点击搜同款按钮: ${selector}`);
                            clicked = true;
                            break;
                        } catch (jsError) {
                            console.log(`JavaScript点击失败: ${jsError}`);
                            // 回退到普通点击
                            await element.click({ timeout: 3000 });
                            console.log(`已点击搜同款按钮: ${selector}`);
                            clicked = true;
                            break;
                        }
                    } else {
                        console.log(`未找到元素: ${selector}`);
                    }
                } catch (e) {
                    console.log(`点击 ${selector} 失败: ${e}`);
                    continue;
                }
            }

            if (!clicked) {
                console.log('未找到搜同款按钮，尝试直接访问图片搜索页面');
                try {
                    await this.page.goto('https://s.taobao.com/search?q=&tab=all&search_type=img', {
                        waitUntil: 'domcontentloaded'
                    });
                    await this.page.waitForTimeout(3000);
                    console.log('已直接访问图片搜索页面');
                    clicked = true;
                } catch (e) {
                    console.log(`直接访问图片搜索页面失败: ${e}`);
                    return false;
                }
            }

            // 等待页面跳转和加载
            console.log(' 等待图片搜索页面加载...');
            await this.page.waitForTimeout(5000);

            // 检查是否成功跳转到图片搜索页面（可选检查，不影响功能）
            const newUrl = this.page.url();
            console.log(`当前页面URL: ${newUrl}`);
            
            // 2. 上传图片
            console.log(' 上传图片...');
            try {
                // 等待上传按钮出现
                console.log('等待上传按钮出现...');
                const uploadButtonSelectors = [
                    '#image-search-upload-button',
                    '.upload-button',
                    '[data-spm="image_search_button"]',
                    'text="上传图片"',
                    'text="选择图片"',
                    '[class*="upload"]',
                    '.upload-btn',
                    '[class*="camera"]'
                ];

                let uploadButton = null;
                let uploadButtonSelector = null;

                // 优化：先快速检查一次，如果找不到可见按钮就直接强制显示
                for (const selector of uploadButtonSelectors) {
                    try {
                        const element = await this.page.$(selector);
                        if (element) {
                            const isVisible = await element.isVisible();
                            if (isVisible) {
                                uploadButton = element;
                                uploadButtonSelector = selector;
                                console.log(`找到可见的上传按钮: ${selector}`);
                                break;
                            } else {
                                console.log(`上传按钮存在但不可见: ${selector}`);
                            }
                        }
                    } catch (e) {
                        // 忽略错误
                    }
                }

                // 如果没有找到可见的上传按钮，直接尝试强制显示
                if (!uploadButton) {
                    console.log('未找到可见的上传按钮，尝试强制显示...');
                    try {
                        await this.page.evaluate(`
                            const uploadButtons = document.querySelectorAll('[class*="upload"], [id*="upload"], [data-spm*="upload"]');
                            uploadButtons.forEach(btn => {
                                if (btn.style) {
                                    btn.style.display = 'block';
                                    btn.style.visibility = 'visible';
                                    btn.style.opacity = '1';
                                    btn.style.position = 'static';
                                    btn.style.zIndex = '9999';
                                }
                            });
                        `);
                        console.log('已尝试强制显示上传按钮');
                        
                        // 等待一下让样式生效
                        await this.page.waitForTimeout(2000);
                        
                        // 再次检查
                        for (const selector of uploadButtonSelectors) {
                            try {
                                const element = await this.page.$(selector);
                                if (element && await element.isVisible()) {
                                    uploadButton = element;
                                    uploadButtonSelector = selector;
                                    console.log(`强制显示后找到上传按钮: ${selector}`);
                                    break;
                                }
                            } catch (e) {
                                // 忽略错误
                            }
                        }
                    } catch (e) {
                        console.log(`强制显示上传按钮失败: ${e}`);
                    }
                }

                // 如果仍然没有找到，尝试直接访问上传页面
                if (!uploadButton) {
                    console.log(' 仍然未找到上传按钮，尝试直接访问上传页面');
                    try {
                        await this.page.goto('https://s.taobao.com/search?q=&tab=all&search_type=img&upload=true', {
                            waitUntil: 'domcontentloaded'
                        });
                        await this.page.waitForTimeout(5000);
                        
                        // 再次尝试查找上传按钮
                        for (const selector of uploadButtonSelectors) {
                            try {
                                const element = await this.page.$(selector);
                                if (element && await element.isVisible()) {
                                    uploadButton = element;
                                    uploadButtonSelector = selector;
                                    console.log(`直接访问后找到上传按钮: ${selector}`);
                                    break;
                                }
                            } catch (e) {
                                // 忽略错误
                            }
                        }
                    } catch (e) {
                        console.log(`直接访问上传页面失败: ${e}`);
                    }
                }

                if (!uploadButton) {
                    console.log(' 无法找到上传按钮，图片搜索失败');
                    return false;
                }

                // 点击上传按钮并处理文件选择
                console.log(`点击上传按钮: ${uploadButtonSelector}`);
                let fileChooser = null;

                try {
                    // 方法1：使用Promise.all等待文件选择器
                    const [chooser] = await Promise.all([
                        this.page.waitForEvent('filechooser', { timeout: 10000 }),
                        uploadButton.click({ timeout: 5000 })
                    ]);
                    fileChooser = chooser;
                    console.log('文件选择器已打开');
                } catch (e1) {
                    console.log(`方法1失败: ${e1}`);
                    
                    try {
                        // 方法2：使用JavaScript点击
                        await this.page.evaluate(`
                            (selector) => {
                                const element = document.querySelector(selector);
                                if (element) {
                                    element.click();
                                    return true;
                                }
                                return false;
                            }
                        `, uploadButtonSelector);
                        
                        // 等待文件选择器
                        fileChooser = await this.page.waitForEvent('filechooser', { timeout: 10000 });
                        console.log('通过JavaScript点击后文件选择器已打开');
                    } catch (e2) {
                        console.log(`方法2也失败: ${e2}`);
                        throw e2;
                    }
                }

                // 上传文件
                try {
                    // 方法1：直接使用FilePayload对象
                    await fileChooser.setFiles(filePayload);
                    console.log('图片上传成功（方法1）');
                } catch (e1) {
                    console.log(`方法1失败: ${e1}`);
                    try {
                        // 方法2：创建临时文件
                        const os = require('os');
                        const path = require('path');

                        // 获取文件内容
                        const fileContent = filePayload.buffer;

                        // 创建临时文件
                        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.jpg`);
                        require('fs').writeFileSync(tempFilePath, fileContent);

                        // 使用临时文件路径上传
                        await fileChooser.setFiles(tempFilePath);
                        console.log('图片上传成功（方法2：临时文件）');

                        // 删除临时文件
                        try {
                            require('fs').unlinkSync(tempFilePath);
                        } catch (e) {
                            // 忽略删除失败
                        }
                    } catch (e2) {
                        console.log(`方法2也失败: ${e2}`);
                        throw e2;
                    }
                }
            } catch (e) {
                console.log(`图片上传失败: ${e}`);
                return false;
            }

            // 等待图片上传完成
            console.log(' 等待图片上传完成...');
            await this.page.waitForTimeout(5000);

            // 3. 点击搜索按钮并等待新窗口
            console.log('执行搜索...');
            const searchButtonSelectors = [
                '#image-search-upload-button',
                'button[type="submit"]',
                'text="搜索"',
                'text="开始搜索"',
                '[class*="search"][class*="btn"]',
                '[class*="submit"]'
            ];

            let searchButtonClicked = false;
            let newPage = null;

            for (const selector of searchButtonSelectors) {
                try {
                    const [page] = await Promise.all([
                        this.context.waitForEvent('page'),
                        this.page.click(selector, { timeout: 3000 })
                    ]);
                    console.log(`已点击搜索按钮: ${selector}`);
                    searchButtonClicked = true;
                    newPage = page;
                    break;
                } catch (e) {
                    console.log(`搜索按钮点击失败: ${e}`);
                    continue;
                }
            }

            if (!searchButtonClicked) {
                console.log('未找到搜索按钮，尝试按回车键');
                try {
                    const [page] = await Promise.all([
                        this.context.waitForEvent('page'),
                        this.page.keyboard.press('Enter')
                    ]);
                    newPage = page;
                } catch (e) {
                    // 忽略回车键失败
                }
            }

            // 等待新窗口打开
            try {
                console.log(' 等待搜索结果页面打开...');
                if (newPage) {
                    console.log(`新窗口已打开: ${newPage.url()}`);
                    this.page = newPage;
                    await this.page.waitForTimeout(5000);
                } else {
                    console.log('没有新窗口，可能是在当前页面显示结果');
                    await this.page.waitForTimeout(5000);
                }
                return true;
            } catch (e) {
                console.log(`等待新窗口超时: ${e}`);
                await this.page.waitForTimeout(5000);
                return true;
            }
        } catch (error) {
            console.error('图片搜索过程出错:', error);
            return false;
        }
    }

    /**
     * 提取搜索结果
     */
    async extractSearchResults() {
        try {
            console.log('提取搜索结果...');
            console.log(`当前页面URL: ${this.page.url()}`);

            const results = [];
            let taobaoCount = 0;
            let tmallCount = 0;

            // 等待搜索结果页面加载
            console.log(' 等待搜索结果页面加载...');

            // 尝试多种可能的商品容器选择器
            const containerSelectors = [
                '.tbpc-col.search-content-col',
                '#content_items_wrapper',
                '.content-items-wrapper',
                '.search-result-container',
                '.items-container',
                '.product-list'
            ];

            let containerFound = false;
            for (const selector of containerSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 10000 });
                    console.log(`找到商品容器: ${selector}`);
                    containerFound = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!containerFound) {
                console.log('未找到商品容器');
                return results;
            }

            await this.page.waitForTimeout(5000);

            // 获取所有商品元素
            const itemSelectors = [
                '.tbpc-col.search-content-col',
                '.item-card',
                '.product-item',
                '.search-item',
                '[data-spm*="item"]'
            ];

            let items = [];
            for (const selector of itemSelectors) {
                items = await this.page.$$(selector);
                if (items.length > 0) {
                    console.log(`使用商品选择器: ${selector}`);
                    break;
                }
            }

            if (items.length === 0) {
                console.log('未找到商品元素');
                return results;
            }

            console.log(`找到 ${items.length} 个商品元素`);

            // 提取商品，只保留淘宝商品
            for (let i = 0; i < items.length; i++) {
                try {
                    console.log(`正在提取第 ${i + 1} 个商品...`);

                    // 提取商品链接
                    const linkSelectors = [
                        'a[href*="item.taobao.com"]',
                        'a[href*="detail.tmall.com"]',
                        'a[href*="product"]',
                        'a[href*="item"]'
                    ];

                    let link = '';
                    for (const selector of linkSelectors) {
                        try {
                            const linkElement = await items[i].$(selector);
                            if (linkElement) {
                                link = await linkElement.getAttribute('href');
                                if (link && (link.includes('item.taobao.com') || link.includes('detail.tmall.com'))) {
                    // 处理链接格式
                    if (link.startsWith('//')) {
                        link = 'https:' + link;
                                    } else if (link.startsWith('/')) {
                                        link = 'https://item.taobao.com' + link;
                                    } else if (!link.startsWith('http')) {
                                        link = 'https://' + link;
                                    }
                                    console.log(`找到商品链接: ${link}`);
                                    break;
                                }
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // 检查商品来源
                    let productSource = '';
                    if (link) {
                        if (link.includes('item.taobao.com') && !link.includes('tmall.com')) {
                            productSource = '淘宝';
                            taobaoCount++;
                        } else if (link.includes('tmall.com')) {
                            productSource = '天猫';
                            tmallCount++;
                            console.log(` 过滤掉天猫商品: ${link}`);
                            continue; // 跳过天猫商品
                        } else {
                            productSource = '其他';
                            console.log(` 未知来源商品: ${link}`);
                            continue; // 跳过未知来源商品
                        }
                    } else {
                        console.log(`第${i + 1}个商品没有有效链接，跳过`);
                        continue;
                    }

                    // 提取商品标题
                    const titleSelectors = [
                        '.title--qJ7Xg_90 span',
                        '.title',
                        '.product-title',
                        '.item-title',
                        'h3',
                        'h4',
                        '[class*="title"]'
                    ];

                    let title = '';
                    for (const selector of titleSelectors) {
                        try {
                            const titleElement = await items[i].$(selector);
                            if (titleElement) {
                                const titleText = await titleElement.innerText();
                                if (titleText && titleText.trim()) {
                                    title = titleText.trim();
                                    console.log(`提取到标题: ${title.substring(0, 50)}...`);
                                    break;
                                }
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // 构建结果 - 只保存淘宝商品
                    const result = {
                        rank: results.length + 1, // 重新计算排名
                        title: title || `淘宝商品${results.length + 1}`,
                        link: link,
                        source: productSource
                    };

                    results.push(result);
                    console.log(` 第${results.length}个淘宝商品提取成功:`);
                    console.log(`   标题: ${title.substring(0, 50)}...`);
                    console.log(`   链接: ${link}`);
                    console.log(`   来源: ${productSource}`);

                    // 如果已经收集到15个淘宝商品，就停止
                    if (results.length >= 15) {
                        console.log(` 已收集到 ${results.length} 个淘宝商品，停止提取`);
                        break;
                }
                } catch (e) {
                    console.log(`提取第${i + 1}个商品失败: ${e}`);
                    continue;
                }
            }

            console.log(` 提取结果统计:`);
            console.log(`   淘宝商品: ${results.length} 个`);
            console.log(`   过滤天猫: ${tmallCount} 个`);
            console.log(`   总处理: ${taobaoCount + tmallCount} 个`);

            return results;
        } catch (error) {
            console.error('提取搜索结果失败:', error);
            return [];
        }
    }

    /**
     * 执行完整的图片搜索流程
     */
    async runSearch(filePath, skuId = null) {
        try {
            console.log('开始执行搜索流程...');
            console.log('filePath', filePath);
            console.log('skuId', skuId);
            
            // 启动浏览器
            await this.startBrowser();

            // 基于Cookie进行登录
            const loginResult = await this.loginWithCookies();
            if (!loginResult.success) {
                console.log('Cookie登录失败:', loginResult.message);
                return { success: false, message: loginResult.message };
            }

            // 访问淘宝首页
            console.log('访问淘宝首页...');
            await this.page.goto('https://www.taobao.com/');
            await this.page.waitForTimeout(5000);

            // 检查登录状态
            const isLoggedIn = await this.checkLoginStatus();
            if (!isLoggedIn) {
                console.log('登录状态检查失败');
                return { success: false, message: '登录状态失效，需要重新登录' };
            }

            // 刷新页面
            await this.refreshPage();

            let results = [];
            
            if (skuId) {
                // 如果提供了sku_id，直接构造商品详情页URL
                console.log(`使用SKU ID: ${skuId} 构造商品详情页`);
                const productUrl = `https://item.taobao.com/item.htm?id=${skuId}`;
                
                // 构造搜索结果
                results = [{
                    rank: 1,
                    title: `商品ID: ${skuId}`,
                    link: productUrl,
                    source: '淘宝'
                }];
                
                console.log(`SKU ID模式：构造商品URL: ${productUrl}`);
            } else if (filePath) {
                // 原有的图片搜索流程
                console.log('执行图片搜索...');
                const searchSuccess = await this.uploadImageSearch(filePath);
                if (!searchSuccess) {
                    return { success: false, message: '图片搜索失败' };
                }

                // 等待结果页面加载
                console.log(' 等待搜索结果加载...');
                await this.page.waitForTimeout(5000);
                
                // 提取搜索结果
                results = await this.extractSearchResults();
            } else {
                return { success: false, message: '请提供图片路径或SKU ID' };
            }

            // 保存搜索结果到实例变量
            this.searchResults = results;

            console.log(`搜索完成，找到 ${results.length} 个淘宝商品`);
            
            // 直接调用爬取评价图片
            console.log('开始爬取评价图片...');
            const crawlResults = await this.crawlReviewImages(results, 0, 15, 60);
            
            // 将爬取结果合并到搜索结果中
            const enhancedResults = results.map((product, index) => {
                const crawlResult = crawlResults.find(r => r.productIndex === index);
                return {
                    ...product,
                    img_urls: crawlResult ? crawlResult.links : []
                };
            });
            
            // 将结果转换为JSON格式返回
            const jsonResult = JSON.stringify({
                success: true,
                data: enhancedResults,
                total: enhancedResults.length,
                timestamp: new Date().toISOString()
            }, null, 2);
            console.log('搜索和爬取完成', jsonResult);
            
            // 关闭浏览器
            await this.closeBrowser();
            
            return jsonResult;

        } catch (error) {
            console.error('图片搜索流程出错:', error);
            
            // 即使出错也要关闭浏览器
            await this.closeBrowser();
            
            return JSON.stringify({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            }, null, 2);
        }
    }

    

        /**
     * 爬取评价图片 - 优化版本
     * @param {Array} searchResults - 搜索结果数组
     * @param {number} index - 开始爬取的索引
     * @param {number} judgeNum - 单个商品图片数量门槛，默认20张
     * @param {number} totalNum - 目标图片总数，默认60张
     */
    async crawlReviewImages(searchResults, index = 0, judgeNum = 20, totalNum = 60) {
        console.log(`开始爬取评价图片，起始索引: ${index}，单品门槛: ${judgeNum}张，总目标: ${totalNum}张`);

        // 基础检查
        if (!searchResults || searchResults.length === 0) {
            console.log('没有搜索结果，无法爬取评价图片');
            return [];
        }

        if (!this.page) {
            console.log('浏览器未启动，请先执行搜索');
            return [];
        }
        this.searchResults = searchResults;
        
        const results = [];
        const imagesPerProduct = 20; // 每个商品爬取20张图片
        let validImagesCollected = 0; // 有效图片总数（只计算>=judgeNum的商品）
        let currentIndex = index; // 当前处理的商品索引
        
        console.log(`策略：每个商品爬取 ${imagesPerProduct} 张图片，>=  ${judgeNum} 张才计入总数`);

        // 持续爬取直到达到总目标或用完所有商品
        while (currentIndex < searchResults.length && validImagesCollected < totalNum) {
            const product = searchResults[currentIndex];
            
            if (!product || !product.link) {
                console.log(`第 ${currentIndex + 1} 个商品没有有效链接，跳过`);
                currentIndex++;
                continue;
            }

            console.log(`\n正在处理第 ${currentIndex + 1} 个商品: ${product.title || '未知商品'}`);
            console.log(`当前有效图片: ${validImagesCollected}/${totalNum}`);

            try {
                // 访问商品详情页
                await this.page.goto(product.link, { waitUntil: 'domcontentloaded' });
                await this.page.waitForTimeout(3000);

                // 检查登录状态
                const isLoggedIn = await this.checkLoginStatus();
                if (!isLoggedIn) {
                    console.log('登录状态异常，跳过此商品');
                    currentIndex++;
                    continue;
                }

                // 爬取此商品的评价图片
                const imageUrls = await this.crawlProductReviewImages(currentIndex + 1, imagesPerProduct);
                const imagesCount = imageUrls.length;
                
                if (imagesCount > 0) {
                    // 保存结果（所有有图片的商品都保存）
                    results.push({
                        productIndex: currentIndex,
                        title: product.title || `商品${currentIndex + 1}`,
                        links: imageUrls,
                        imagesCount: imagesCount,
                        isValid: imagesCount >= judgeNum // 标记是否达到门槛
                    });

                    // 只有达到门槛的商品才计入总目标
                    if (imagesCount >= judgeNum) {
                        validImagesCollected += imagesCount;
                        console.log(`第 ${currentIndex + 1} 个商品完成，获得 ${imagesCount} 张图片（达到门槛），累计有效 ${validImagesCollected} 张`);
                    } else {
                        console.log(`第 ${currentIndex + 1} 个商品完成，获得 ${imagesCount} 张图片（未达门槛 ${judgeNum}），不计入总数`);
                    }
                } else {
                    console.log(`第 ${currentIndex + 1} 个商品没有找到图片，跳过`);
                }

            } catch (error) {
                console.log(`处理第 ${currentIndex + 1} 个商品时出错: ${error.message}`);
            }

            currentIndex++;
        }

        // 统计结果
        const validProducts = results.filter(r => r.isValid).length;
        const invalidProducts = results.filter(r => !r.isValid).length;

        console.log(`\n爬取完成统计:`);
        console.log(`  处理商品总数: ${results.length} 个`);
        console.log(`  达到门槛商品: ${validProducts} 个`);
        console.log(`  未达门槛商品: ${invalidProducts} 个`);
        console.log(`  有效图片总数: ${validImagesCollected} 张`);
        console.log(`  目标完成度: ${validImagesCollected}/${totalNum} (${((validImagesCollected/totalNum)*100).toFixed(1)}%)`);
        
        if (currentIndex >= searchResults.length) {
            console.log(`  已用完所有 ${searchResults.length} 个商品`);
        }
        
        if (validImagesCollected >= totalNum) {
            console.log(`  已达到目标图片数量`);
        }

        return results;
    }

    /**
     * 爬取单个商品的评价图片URL列表
     */
    async crawlProductReviewImages(productIndex, maxImages) {
        const imageUrls = [];

        try {
            // 获取商品链接
            const productLink = this.searchResults[productIndex - 1].link;
            if (!productLink) {
                console.log(`商品${productIndex}没有链接`);
                return [];
            }

            console.log(`打开商品链接...`);
            await this.page.goto(productLink, { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(3000);

            // 1. 点击"用户评价"标签
            try {
                // 先移除拦截元素
                await this.page.evaluate(`
                    // 移除J_MIDDLEWARE_FRAME_WIDGET拦截元素
                    const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                    interceptors.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });

                    // 移除弹窗遮罩层
                    const dialogMasks = document.querySelectorAll('.baxia-dialog-mask, .dialog-mask, .modal-mask');
                    dialogMasks.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });

                    // 移除弹窗本身
                    const dialogs = document.querySelectorAll('.baxia-dialog, .dialog, .modal');
                    dialogs.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });
                `);
                console.log('已移除拦截元素和弹窗');

                // 尝试多种方式点击用户评价标签
                let clicked = false;
                const selectors = [
                    "#titleTabs .tabTitle--BHerXaZ2",
                    "text=\"用户评价\"",
                    "[data-spm*=\"comment\"]",
                    ".tabTitle"
                ];

                for (const selector of selectors) {
                    try {
                        if (selector.startsWith("text=")) {
                            await this.page.getByText("用户评价").first().click({ timeout: 5000 });
                        } else {
                            await this.page.click(selector, { timeout: 5000 });
                        }
                        console.log(`点击用户评价标签成功: ${selector}`);
                        clicked = true;
                        break;
                    } catch (clickError) {
                        console.log(`点击失败 ${selector}: ${clickError}`);
                        continue;
                    }
                }

                if (!clicked) {
                    // 使用JavaScript点击
                    try {
                        await this.page.evaluate(`
                            (text) => {
                                const elements = Array.from(document.querySelectorAll('*'));
                                const targetElement = elements.find(el => 
                                    el.textContent && el.textContent.includes(text)
                                );
                                if (targetElement) {
                                    targetElement.click();
                                    return true;
                                }
                                return false;
                            }
                        `, "用户评价");
                        console.log('通过JavaScript点击用户评价标签');
                        clicked = true;
                    } catch (jsError) {
                        console.log(`JavaScript点击失败: ${jsError}`);
                    }
                }

                if (!clicked) {
                    throw new Error("所有点击方式都失败了");
                }

            } catch (error) {
                console.log(`点击用户评价标签失败: ${error}`);
                return imageUrls;
            }

            await this.page.waitForTimeout(3000);

            // 2. 点击"查看全部评价"按钮
            try {
                // 再次移除可能重新出现的拦截元素
                await this.page.evaluate(`
                    // 移除J_MIDDLEWARE_FRAME_WIDGET拦截元素
                    const interceptors = document.querySelectorAll('.J_MIDDLEWARE_FRAME_WIDGET');
                    interceptors.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });

                    // 移除弹窗遮罩层
                    const dialogMasks = document.querySelectorAll('.baxia-dialog-mask, .dialog-mask, .modal-mask');
                    dialogMasks.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });

                    // 移除弹窗本身
                    const dialogs = document.querySelectorAll('.baxia-dialog, .dialog, .modal');
                    dialogs.forEach(el => {
                        if (el.style) {
                            el.style.pointerEvents = 'none';
                            el.style.display = 'none';
                        }
                    });
                `);

                // 尝试多种方式点击查看全部评价按钮
                let clicked = false;
                const selectors = [
                    "text=\"查看全部评价\"",
                    "[data-spm*=\"comment\"]",
                    ".view-all-comments",
                    ".comment-link"
                ];

                for (const selector of selectors) {
                    try {
                        if (selector.startsWith("text=")) {
                            await this.page.getByText("查看全部评价").first().click({ timeout: 5000 });
                        } else {
                            await this.page.click(selector, { timeout: 5000 });
                        }
                        console.log(`点击查看全部评价按钮成功: ${selector}`);
                        clicked = true;
                        break;
                    } catch (clickError) {
                        console.log(`点击失败 ${selector}: ${clickError}`);
                        continue;
                    }
                }

                if (!clicked) {
                    // 使用JavaScript点击
                    try {
                        await this.page.evaluate(`
                            (text) => {
                                const elements = Array.from(document.querySelectorAll('*'));
                                const targetElement = elements.find(el => 
                                    el.textContent && el.textContent.includes(text)
                                );
                                if (targetElement) {
                                    targetElement.click();
                                    return true;
                                }
                                return false;
                            }
                        `, "查看全部评价");
                        console.log('通过JavaScript点击查看全部评价按钮');
                        clicked = true;
                    } catch (jsError) {
                        console.log(`JavaScript点击失败: ${jsError}`);
                    }
                }

                if (!clicked) {
                    console.log('查看全部评价按钮点击失败，尝试继续执行');
                }

            } catch (error) {
                console.log(`点击查看全部评价按钮失败: ${error}`);
                // 不直接返回，尝试继续执行
            }

            await this.page.waitForTimeout(3000);

            // 3. 等待弹窗出现
            try {
                await this.page.waitForSelector('.leftDrawer--4H_p9fnt', { timeout: 10000 });
                console.log('评价弹窗已加载');
            } catch (error) {
                console.log('评价弹窗未出现');
                return imageUrls;
            }

            // 4. 点击"有图/视频"筛选按钮
            try {
                const filterButton = this.page.locator('.leftDrawer--4H_p9fnt .tagItem--hEWnKy1n').filter({ hasText: "有图/视频" }).first();
                await filterButton.click();
                console.log('点击有图/视频筛选按钮');
            } catch (error) {
                try {
                    await this.page.locator('.leftDrawer--4H_p9fnt').getByText("有图/视频").click();
                    console.log('使用备用方法点击有图/视频筛选按钮');
                } catch (error2) {
                    console.log('筛选按钮点击失败');
                }
            }

            await this.page.waitForTimeout(3000);

            // 滚动触发占位图片加载 - 复用脚本中成功的滚动逻辑
            console.log('开始滚动加载评价图片...');

            // 获取滚动容器 - 完全复用脚本逻辑
            let scrollContainer = await this.page.$('.leftDrawer--4H_p9fnt .comments--a9Uyym1a');
            if (!scrollContainer) {
                console.log('未找到主滚动容器，尝试备用选择器...');
                // 尝试备用选择器
                scrollContainer = await this.page.$('.leftDrawer--4H_p9fnt');
                if (!scrollContainer) {
                    console.log('未找到任何滚动容器');
                    return imageUrls;
                }
                console.log('使用备用滚动容器');
            } else {
                console.log('找到主滚动容器');
            }

            // 检查滚动容器状态
            try {
                const containerInfo = await scrollContainer.evaluate(element => ({
                    scrollHeight: element.scrollHeight,
                    clientHeight: element.clientHeight,
                    scrollTop: element.scrollTop,
                    canScroll: element.scrollHeight > element.clientHeight
                }));
                console.log('滚动容器状态:', containerInfo);
                
                if (!containerInfo.canScroll) {
                    console.log(' 容器内容不足以滚动，可能评价还未加载完成');
                }
            } catch (error) {
                console.log('检查滚动容器状态失败:', error);
            }

            // 向下滚动5次，每次滚动等待1秒 - 完全复用脚本逻辑
            console.log('向下滚动5次...');
            for (let i = 0; i < 5; i++) {
                try {
                    // 获取滚动前的位置
                    const beforeScroll = await scrollContainer.evaluate(element => element.scrollTop);
                    
                    // 执行滚动 - 完全复用脚本逻辑
                    await scrollContainer.evaluate(element => element.scrollTop = element.scrollHeight);
                    
                    // 等待滚动完成 - 完全复用脚本逻辑  
                    await this.page.waitForTimeout(1000);
                    
                    // 验证滚动是否成功
                    const afterScroll = await scrollContainer.evaluate(element => element.scrollTop);
                    console.log(`向下滚动第${i + 1}次: ${beforeScroll} -> ${afterScroll}`);
                } catch (error) {
                    console.log(`向下滚动第${i + 1}次失败: ${error}`);
                    continue;
                }
            }

            // 向上滚动10次，回到顶部 - 完全复用脚本逻辑
            console.log('向上滚动10次，回到顶部...');
            for (let i = 0; i < 10; i++) {
                try {
                    // 获取滚动前的位置
                    const beforeScroll = await scrollContainer.evaluate(element => element.scrollTop);
                    
                    // 执行滚动 - 完全复用脚本逻辑
                    await scrollContainer.evaluate(element => element.scrollTop = 0);
                    
                    // 等待滚动完成 - 完全复用脚本逻辑
                    await this.page.waitForTimeout(1000);
                    
                    // 验证滚动是否成功
                    const afterScroll = await scrollContainer.evaluate(element => element.scrollTop);
                    console.log(`向上滚动第${i + 1}次: ${beforeScroll} -> ${afterScroll}`);
                    
                    // 如果已经回到顶部，提前结束
                    if (afterScroll === 0) {
                        console.log('已回到顶部，提前结束滚动');
                        break;
                    }
                } catch (error) {
                    console.log(`向上滚动第${i + 1}次失败: ${error}`);
                    continue;
                }
            }

            // 等待图片完全加载
            await this.page.waitForTimeout(3000);

            // 5. 重要：确保我们在弹窗内查找评价
            console.log('开始解析评价图片...');

            // 获取弹窗内的所有评价
            let comments = [];
            try {
                comments = await this.page.$$('.leftDrawer--4H_p9fnt .Comment--qLX9Lbvs');
                if (comments.length === 0) {
                    comments = await this.page.$$('.leftDrawer--4H_p9fnt .comments--a9Uyym1a .Comment--qLX9Lbvs');
                }
                console.log(`找到 ${comments.length} 条评价`);
            } catch (error) {
                console.log(`获取评价失败: ${error}`);
                return imageUrls;
            }

            // 6. 遍历每条评价，提取图片URL
            console.log(` 开始提取图片URL (目标: ${maxImages}张)`);

            for (let commentIndex = 0; commentIndex < comments.length; commentIndex++) {
                if (imageUrls.length >= maxImages) {
                    break;
                }

                const comment = comments[commentIndex];
                try {
                    // 在每条评价内查找图片容器
                    const album = await comment.$('.album--WpqL2WVM');
                    if (!album) {
                        continue;
                    }

                    // 获取该评价内的所有图片
                    let imgElements = await album.$$('.photo--RYALVcv5.cover--kVd_0rd5 img');
                    if (imgElements.length === 0) {
                        imgElements = await album.$$('img');
                    }

                    for (const imgElement of imgElements) {
                        if (imageUrls.length >= maxImages) {
                            break;
                        }

                        try {
                            const imgSrc = await imgElement.getAttribute('src');

                            // 处理图片URL
                            let processedImgSrc = imgSrc;
                            if (imgSrc && imgSrc.startsWith('//')) {
                                processedImgSrc = 'https:' + imgSrc;
                            } else if (imgSrc && !imgSrc.startsWith('http')) {
                                processedImgSrc = 'https://' + imgSrc;
                            }

                            // 过滤占位图 - 更严格的过滤条件
                            const placeholderUrls = [
                                'https://img.alicdn.com/imgextra/i2/O1CN01Dqo1gd1wMhnobvRco_!!6000000006294-2-tps-145-145.png',
                                '//img.alicdn.com/imgextra/i2/O1CN01Dqo1gd1wMhnobvRco_!!6000000006294-2-tps-145-145.png'
                            ];

                            // 检查是否为有效图片（不是占位图且包含评价图片特征）
                            const isValidImage = (
                                processedImgSrc &&
                                !placeholderUrls.includes(processedImgSrc) &&
                                !processedImgSrc.endsWith('2-tps-145-145.png') && // 过滤占位图尺寸
                                (
                                    processedImgSrc.includes('rate.jpg') ||
                                    processedImgSrc.includes('tbbala.jpg') ||
                                    processedImgSrc.includes('rate.jpg_960x960.jpg_.webp')
                                )
                            );

                            if (isValidImage) {
                                // 检查是否已经添加过
                                if (!imageUrls.includes(processedImgSrc)) {
                                    imageUrls.push(processedImgSrc);
                                    console.log(`添加图片URL: ${processedImgSrc.substring(0, 50)}...`);
                                }
                            }
                        } catch (error) {
                            continue;
                        }
                    }

                } catch (error) {
                    continue;
                }
            }

            console.log(`解析完成，找到 ${imageUrls.length} 张有效图片URL`);

        } catch (error) {
            console.log(`爬取商品评价图片失败: ${error}`);
        }

        return imageUrls;
    }
}

exports.ImageSearchNode = ImageSearchNode;
