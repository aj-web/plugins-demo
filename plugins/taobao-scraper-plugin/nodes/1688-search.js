"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Search1688Node = void 0;

const { chromium } = require('playwright');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class Search1688Node {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookieManager = GlobalCookieManager.getInstance();
    }

    /**
     * 启动浏览器并使用已保存的cookie登录1688
     */
    async startSearch(filePath, skuId = null) {
        try {
            console.log('开始1688搜索流程...');
            console.log('filePath', filePath);
            console.log('skuId', skuId);
            
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
            
            // 加载已保存的1688 cookies
            const cookies = await this.cookieManager.getCookies('1688');
            if (cookies && cookies.length > 0) {
                await this.context.addCookies(cookies);
                console.log('已加载1688 cookies，数量:', cookies.length);
            } else {
                console.log('未找到1688 cookies，需要先登录');
                return { success: false, message: '未找到1688 cookies，请先登录' };
            }

            // 访问1688首页验证登录状态
            console.log('访问1688首页验证登录状态...');
            await this.page.goto('https://www.1688.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // 等待页面加载
            await this.page.waitForTimeout(10000);

            // 检查登录状态
            const isLoggedIn = await this.checkLoginStatus();
            
            if (isLoggedIn) {
                console.log('1688登录成功，开始图片搜索流程...');
                
                // 执行图片搜索
                const searchResult = await this.performImageSearch(filePath, skuId);
                console.log('1688图片搜索结果:', searchResult);
                return searchResult;
            } else {
                console.log('1688登录失败，cookies可能已过期');
                return { success: false, message: '1688登录失败，cookies可能已过期，请重新登录' };
            }

        } catch (error) {
            console.error('启动1688搜索失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
         * 检查登录状态
         */
    async checkLoginStatus() {
        try {
            const isLoggedIn = await this.page.evaluate(() => {
                // 查找用户卡片元素
                console.log('查找用户卡片元素');
                const userCard = document.querySelector('.userCard--rUaD9E7Q');
                if (!userCard) {
                    console.log('未找到用户卡片元素');
                    return false;
                }
                console.log('找到用户卡片元素');
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
     * 执行图片搜索
     */
    async performImageSearch(filePath, skuId) {
        try {
            console.log('开始执行图片搜索...');
            
            const allResults = []; // 存储所有搜索结果
            
            // 1. 处理SKU ID模式
            if (skuId) {
                console.log(`使用SKU ID: ${skuId} 构造商品详情页`);
                const productUrl = `https://detail.1688.com/offer/${skuId}.html`;
                
                // 构造搜索结果
                const results = [{
                    rank: 1,
                    title: `商品ID: ${skuId}`,
                    url: productUrl,  // 改为url字段，与前端期望一致
                    offerId: skuId,
                    source: '1688'
                }];
                
                allResults.push(results[0]);
                console.log(`SKU ID模式：构造商品URL: ${productUrl}`);
            }
            
            // 2. 处理图片搜索模式
            if (filePath) {
                console.log('执行图片搜索...');
                
                // 等待页面完全加载
                await this.page.waitForTimeout(2000);
                
                // 定位并点击"以图搜款"按钮
                console.log('定位以图搜款按钮...');
                const imageSearchButton = await this.page.$('.image-upload-button-container');
                if (!imageSearchButton) {
                    throw new Error('未找到以图搜款按钮');
                }
                
                // 点击以图搜款按钮，并等待文件选择器出现
                console.log('点击以图搜款按钮，等待文件选择器...');
                const [fileChooser] = await Promise.all([
                    this.page.waitForEvent('filechooser'),
                    imageSearchButton.click()
                ]);
                console.log('文件选择器已出现');
                
                // 上传图片文件
                console.log('开始上传图片文件:', filePath);
                await fileChooser.setFiles(filePath);
                console.log('图片文件上传成功');
                
                // 等待图片上传完成
                await this.page.waitForTimeout(3000);
                
                // 查找并点击"搜索图片"按钮
                console.log('查找搜索图片按钮...');
                const searchButton = await this.page.$('.search-btn') || 
                                    await this.page.$('[data-tracker="pasteImagePreview"]') ||
                                    await this.page.$('div.search-btn') ||
                                    await this.page.$('button:has-text("搜索图片")') || 
                                    await this.page.$('button:has-text("搜索")') ||
                                    await this.page.$('[class*="search"] button') ||
                                    await this.page.$('button[type="submit"]');
                
                if (!searchButton) {
                    throw new Error('未找到搜索图片按钮');
                }
                
                // 点击搜索按钮，并等待新窗口打开
                console.log('点击搜索图片按钮，等待新窗口...');
                const [newPage] = await Promise.all([
                    this.context.waitForEvent('page'),
                    searchButton.click()
                ]);
                console.log('已点击搜索图片按钮');
                
                // 等待搜索结果页面加载
                console.log('等待搜索结果页面加载...');
                await this.page.waitForTimeout(10000);
                
                // 等待新窗口打开
                console.log('等待搜索结果页面打开...');
                if (newPage) {
                    console.log(`新窗口已打开: ${newPage.url()}`);
                    // 切换到新窗口
                    this.page = newPage;
                    await this.page.waitForTimeout(5000);
                        
                    // 获取新窗口的URL
                    const searchUrl = this.page.url();
                    console.log('搜索结果页面URL:', searchUrl);
                        
                    // 提取商品URL
                    const extractResult = await this.extractProductUrls(10);
                    
                    // 为图片搜索结果添加标识
                    const imageResults = extractResult.map((item, index) => ({
                        ...item,
                        rank: allResults.length + index + 1 // 重新计算排名
                    }));
                    
                    allResults.push(...imageResults);
                    console.log(`图片搜索完成，找到 ${imageResults.length} 个商品`);
                    
                } else {
                    console.log('没有新窗口，可能是在当前页面显示结果');
                    const currentUrl = this.page.url();
                    console.log('当前页面URL:', currentUrl);
                    
                    if (allResults.length === 0) {
                        return { 
                            success: false, 
                            message: '图片搜索完成，但没有找到任何商品',
                        };
                    }
                }
            }
            
            // 3. 检查是否有搜索结果
            if (allResults.length === 0) {
                return { 
                    success: false, 
                    message: '图片搜索完成，但没有找到任何商品',
                };
            }
            
            // 4. 统一调用爬取评价图片
            console.log(`开始爬取评价图片，总共 ${allResults.length} 个商品...`);
            const crawlResults = await this.crawlReviewImages(allResults, 0, 15);

            // 5. 将爬取结果合并到搜索结果中
            const enhancedResults = allResults.map((product, index) => {
                const crawlResult = crawlResults.find(r => r.productIndex === index);
                return {
                    ...product,
                    img_urls: crawlResult ? crawlResult.links : []
                };
            });
            
            // 6. 将结果转换为JSON格式返回
            const jsonResult = JSON.stringify({
                success: true,
                data: enhancedResults,
                total: enhancedResults.length,
                timestamp: new Date().toISOString()
            }, null, 2);
            
            return jsonResult;
            
        } catch (error) {
            // 即使出错也要关闭浏览器
            await this.closeBrowser();
            
            return JSON.stringify({
                success: false,
                message: error.message,
                timestamp: new Date().toISOString()
            }, null, 2);
        }finally{
            await this.closeBrowser();
        }
    }

    /**
     * 提取搜索结果页面的商品URL（过滤广告）
     * @param {number} count - 需要提取的商品数量,默认10个
     * @returns {Array} 商品URL数组
     */
    async extractProductUrls(count = 10) {
        try {
            console.log(`开始提取商品URL,目标数量: ${count}`);
            
            // 等待页面加载完成
            await this.page.waitForTimeout(3000);
            
            // 提取商品链接
            const results = await this.page.evaluate((targetCount) => {
                const results = [];
                const productCards = document.querySelectorAll('#offer-list a.searchOfferWrapper--lmbrqOXR');
                
                console.log(`找到 ${productCards.length} 个商品卡片`);
                
                let skippedAds = 0; // 统计跳过的广告数量
                
                for (let i = 0; i < productCards.length && results.length < targetCount; i++) {
                    const card = productCards[i];
                    try {
                        const href = card.getAttribute('href') || '';
                        
                        // 广告判断
                        if (href.includes('dj.1688.com/ci_bb')) {
                            skippedAds++;
                            console.log(`跳过广告商品 #${i + 1}`);
                            continue;
                        }
                        
                        // 只保留正常商品
                        if (!href.includes('detail.1688.com/offer/')) {
                            console.log(`商品 #${i + 1} 不是有效商品链接，跳过`);
                            continue;
                        }
                        
                        // 获取标题
                        const titleElement = card.querySelector('.titleText--TB6mnS3m div');
                        const title = titleElement ? titleElement.textContent.trim() : '';
                        
                        const result = {
                            rank: results.length + 1,
                            title: title || `1688商品${results.length + 1}`,
                            url: href
                        };
                        
                        results.push(result);
                        console.log(`提取第 ${result.rank} 个商品: ${result.title}`);
                        
                    } catch (err) {
                        console.error(`处理第 ${i+1} 个商品卡片时出错:`, err);
                    }
                }
                
                console.log(`共跳过 ${skippedAds} 个广告商品`);
                return results;
            }, count);
            
            console.log(`成功提取 ${results.length} 个普通商品URL`);
            return results;
            
        } catch (error) {
            console.error('提取商品URL失败:', error);
            return [];
        }
    }
    

    /**
     * 爬取评价图片
     * @param {Array} searchResults - 搜索结果数组
     * @param {number} index - 开始爬取的索引
     * @param {number} judgeNum - 判断商品是否有效的图片数量阈值，默认20张
     */
    async crawlReviewImages(searchResults, index = 0, judgeNum = 1) {
        console.log(`🖼️ 开始爬取1688评价图片，起始索引: ${index}，判断数量: ${judgeNum}`);

        if (!searchResults || searchResults.length === 0) {
            console.log('没有搜索结果，无法爬取评价图片');
            return [];
        }

        if (!this.page) {
            console.log('浏览器未启动，请先执行搜索');
            return [];
        }

        // 保存搜索结果到实例变量，供内部方法使用
        this.searchResults = searchResults;

        const results = [];
        const imagesPerProduct = 20; // 每个商品固定爬取20张图片
        let totalImagesCollected = 0; // 统计总共收集的图片数量
        let processedProductsCount = 0; // 已处理的商品数量（包括补偿商品）
        const maxProducts = 15; // 最多处理10个商品
        const compensationQueue = []; // 需要补偿的商品队列

        console.log(`爬取策略：每个商品固定 ${imagesPerProduct} 张图片，有效判断数量: ${judgeNum}，最多处理 ${maxProducts} 个商品`);

        // 计算要爬取的商品范围：从index开始，爬取后3个商品
        const startIndex = index;
        const endIndex = Math.min(index + 3, searchResults.length);
        const productsToCrawl = searchResults.slice(startIndex, endIndex);

        console.log(`爬取范围：第 ${startIndex + 1} 到第 ${endIndex} 个1688商品（共 ${productsToCrawl.length} 个）`);

        // 第一轮：爬取计划内的商品
        for (let i = 0; i < productsToCrawl.length && processedProductsCount < maxProducts; i++) {
            const actualIndex = startIndex + i; // 实际的商品索引
            const product = productsToCrawl[i];
            const productUrl = product.url;  // 改为url字段
            
            if (!productUrl) {
                console.log(`第 ${actualIndex + 1} 个商品没有有效链接，跳过`);
                continue;
            }

            console.log(`\n正在处理第 ${actualIndex + 1} 个1688商品: ${product.title || '未知商品'}`);
            console.log(`商品链接: ${productUrl}`);

            try {
                // 访问商品详情页
                console.log('访问商品详情页...');
                await this.page.goto(productUrl, { waitUntil: 'domcontentloaded' });
                
                // 随机等待3-5秒，避免被反爬虫检测
                const randomWaitTime = Math.floor(Math.random() * 3000) + 3000; // 3000-6000ms
                console.log(`随机等待 ${randomWaitTime}ms...`);
                await this.page.waitForTimeout(randomWaitTime);

                // 爬取此商品的评价图片URL（暂时只打印日志）
                const imageUrls = await this.crawlProductReviewImages(actualIndex + 1, imagesPerProduct);

                // 统计图片数量
                const imagesCount = imageUrls.length;
                totalImagesCollected += imagesCount;
                processedProductsCount++;

                // 检查是否需要补偿（不足judgeNum张图片）
                if (imagesCount < judgeNum) {
                    console.log(`⚠️ 第 ${actualIndex + 1} 个商品只获得 ${imagesCount} 张图片（少于${judgeNum}张），需要补偿`);
                    compensationQueue.push({
                        originalIndex: actualIndex,
                        originalProduct: product,
                        collected: imagesCount,
                        needed: judgeNum - imagesCount
                    });
                }

                // 构建结果
                const result = {
                    productIndex: actualIndex,
                    title: product.title || `商品${actualIndex + 1}`,
                    links: imageUrls,
                    imagesCount: imagesCount
                };
                results.push(result);

                console.log(`第 ${actualIndex + 1} 个商品爬取完成，获得 ${imagesCount} 张图片`);

            } catch (error) {
                console.error(`第 ${actualIndex + 1} 个商品爬取失败:`, error);
                continue;
            }
        }

        // 第二轮：补偿爬取（如果有商品需要补偿）
        console.log(`\n=== 补偿逻辑检查 ===`);
        console.log(`compensationQueue长度: ${compensationQueue.length}`);
        console.log(`是否需要补偿: ${compensationQueue.length > 0}`);
        
        if (compensationQueue.length > 0) {
            console.log(`\n第一轮爬取完成，总共获得 ${totalImagesCollected} 张图片，少于 ${judgeNum} 张，开始补偿爬取...`);
            console.log(`已处理商品数量: ${processedProductsCount}, 最大商品数量: ${maxProducts}`);
            console.log(`搜索结果总数: ${searchResults.length}`);
            
            // 记录已处理的商品索引，避免重复
            const processedIndices = new Set();
            results.forEach(r => processedIndices.add(r.productIndex));
            console.log(`已处理的商品索引: [${Array.from(processedIndices).join(', ')}]`);
            
            // 寻找新的商品进行补偿，而不是为每个补偿项都寻找
            let nextIndex = Math.max(...Array.from(processedIndices)) + 1;
            let compensationAttempts = 0;
            const maxCompensationAttempts = 10; // 最多尝试10次补偿
            
            console.log(`开始补偿，下一个商品索引: ${nextIndex}`);
            
            while (compensationQueue.length > 0 && 
                   nextIndex < searchResults.length && 
                   processedProductsCount < maxProducts &&
                   compensationAttempts < maxCompensationAttempts) {
                
                console.log(`补偿尝试 ${compensationAttempts + 1}: 检查商品索引 ${nextIndex}`);
                
                const nextProduct = searchResults[nextIndex];
                if (nextProduct && nextProduct.url && !processedIndices.has(nextIndex)) {
                    console.log(`\n补偿爬取第 ${nextIndex + 1} 个商品: ${nextProduct.title || '未知商品'}`);
                    
                    try {
                        // 访问商品详情页
                        await this.page.goto(nextProduct.url, { waitUntil: 'domcontentloaded' });
                        
                        // 随机等待3-5秒，避免被反爬虫检测
                        const randomWaitTime = Math.floor(Math.random() * 3000) + 3000; // 3000-6000ms
                        console.log(`补偿商品随机等待 ${randomWaitTime}ms...`);
                        await this.page.waitForTimeout(randomWaitTime);

                        // 爬取此商品的评价图片URL
                        const compensationImageUrls = await this.crawlProductReviewImages(nextIndex + 1, imagesPerProduct);
                        
                        const compensationImagesCount = compensationImageUrls.length;
                        totalImagesCollected += compensationImagesCount;
                        processedProductsCount++;
                        processedIndices.add(nextIndex);

                        // 构建补偿结果
                        const compensationResult = {
                            productIndex: nextIndex,
                            title: nextProduct.title || `商品${nextIndex + 1}`,
                            links: compensationImageUrls,
                            imagesCount: compensationImagesCount,
                            isCompensation: true
                        };
                        results.push(compensationResult);

                        console.log(`补偿商品 ${nextIndex + 1} 爬取完成，获得 ${compensationImagesCount} 张图片`);

                        // 如果补偿商品获得了图片，从补偿队列中移除一个项目
                        if (compensationImagesCount > 0) {
                            compensationQueue.shift(); // 移除一个补偿项目
                            console.log(`补偿成功，剩余补偿项目: ${compensationQueue.length}`);
                        }

                    } catch (error) {
                        console.error(`补偿商品 ${nextIndex + 1} 爬取失败:`, error);
                    }
                }
                
                nextIndex++;
                compensationAttempts++;
                
                // 如果已经尝试了足够多的补偿，停止
                if (compensationAttempts >= maxCompensationAttempts) {
                    console.log(`已达到最大补偿尝试次数 ${maxCompensationAttempts}，停止补偿爬取`);
                    break;
                }
                
                // 检查循环退出条件
                if (compensationQueue.length === 0) {
                    console.log(`补偿完成：所有补偿项目已处理完毕`);
                    break;
                }
                if (nextIndex >= searchResults.length) {
                    console.log(`补偿停止：已到达搜索结果末尾 ${nextIndex} >= ${searchResults.length}`);
                    break;
                }
                if (processedProductsCount >= maxProducts) {
                    console.log(`补偿停止：已达到最大商品数量 ${processedProductsCount} >= ${maxProducts}`);
                    break;
                }
            }
        }

        console.log(`爬取结果:`, results);

        return results;
    }

    /**
     * 爬取单个商品的评价图片URL列表
     */
    async crawlProductReviewImages(productIndex, maxImages) {
        console.log(`开始爬取商品 ${productIndex} 的评价图片，目标数量: ${maxImages}`);
        
        try {
            // 第一步：点击"查看全部评价"按钮
            console.log('第一步：查找并点击"查看全部评价"按钮...');
            
            // 等待页面完全加载
            await this.page.waitForTimeout(2000);
            
            // 尝试多种选择器来定位"查看全部评价"按钮
            const selectors = [
                '#productEvaluation > div > div.collapse-body > div.evaluation-list > div.evaluation-more',
                '.evaluation-more',
                'button:has-text("查看全部评价")',
                '[data-spm-anchor-id*="viewAllReviews"]',
                '.ant-btn:has-text("查看全部评价")'
            ];
            
            let buttonClicked = false;
            for (const selector of selectors) {
                try {
                    console.log(`尝试选择器: ${selector}`);
                    const button = await this.page.$(selector);
                    
                    if (button) {
                        console.log(`找到"查看全部评价"按钮，使用选择器: ${selector}`);
                        
                        // 确保按钮可见和可点击
                        await button.scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(1000);
                        
                        // 点击按钮
                        await button.click();
                        console.log('成功点击"查看全部评价"按钮');
                        
                        buttonClicked = true;
                        break;
                    }
                } catch (error) {
                    console.log(`选择器 ${selector} 失败: ${error.message}`);
                    continue;
                }
            }
            
            if (!buttonClicked) {
                console.log('未找到"查看全部评价"按钮，可能页面结构不同或按钮不存在');
                // 继续执行，可能评价内容已经显示
            }
            
            // 等待评价内容加载
            console.log('等待评价内容加载...');
            await this.page.waitForTimeout(3000);
            
            // 第二步：点击"有图"按钮筛选包含图片的评价
            console.log('第二步：点击"有图"按钮筛选包含图片的评价...');
            
            // 等待弹窗加载完成
            await this.page.waitForTimeout(2000);
            
            // 尝试多种选择器来定位"有图"按钮
            const imageFilterSelectors = [
                '.evaluate-panel-categorize button:has-text("有图")',
                '.select-categorize button:has-text("有图")',
                'button:has-text("有图")',
                '.ant-btn:has-text("有图")'
            ];
            
            let imageFilterClicked = false;
            for (const selector of imageFilterSelectors) {
                try {
                    console.log(`尝试选择器: ${selector}`);
                    const imageFilterButton = await this.page.$(selector);
                    
                    if (imageFilterButton) {
                        console.log(`找到"有图"按钮，使用选择器: ${selector}`);
                        
                        // 确保按钮可见和可点击
                        await imageFilterButton.scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(1000);
                        
                        // 点击按钮
                        await imageFilterButton.click();
                        console.log('成功点击"有图"按钮');
                        
                        imageFilterClicked = true;
                        break;
                    }
                } catch (error) {
                    console.log(`选择器 ${selector} 失败: ${error.message}`);
                    continue;
                }
            }
            
            if (!imageFilterClicked) {
                console.log('未找到"有图"按钮，可能页面结构不同或按钮不存在，跳过当前商品');
                return [];
            }
            
            // 等待筛选结果加载
            console.log('等待筛选结果加载...');
            await this.page.waitForTimeout(3000);
            
            // 第三步：提取评价图片URL
            console.log('第三步：开始提取评价图片URL...');
            
            const allImageUrls = [];
            let currentPage = 1;
            const maxPages = 3; // 最多爬取3页，避免过多请求
            
            while (currentPage <= maxPages && allImageUrls.length < maxImages) {
                console.log(`正在处理第 ${currentPage} 页...`);
                
                // 提取当前页面的图片URL
                const pageImageUrls = await this.page.evaluate(() => {
                    const imageUrls = [];
                    
                    // 查找所有评价图片
                    const imageElements = document.querySelectorAll('.evaluate-images .ant-image-img');
                    
                    imageElements.forEach(img => {
                        const src = img.getAttribute('src');
                        if (src && src.startsWith('//')) {
                            // 添加https:前缀
                            imageUrls.push('https:' + src);
                        } else if (src && src.startsWith('http')) {
                            imageUrls.push(src);
                        }
                    });
                    
                    return imageUrls;
                });
                
                console.log(`第 ${currentPage} 页找到 ${pageImageUrls.length} 张图片`);
                allImageUrls.push(...pageImageUrls);
                
                // 如果已经达到目标数量，退出循环
                if (allImageUrls.length >= maxImages) {
                    break;
                }
                
                // 尝试点击下一页
                if (currentPage < maxPages) {
                    try {
                        console.log('尝试点击下一页...');
                        
                        // 等待页面加载完成
                        await this.page.waitForTimeout(2000);
                        
                        // 查找下一页按钮
                        const nextPageSelectors = [
                            'li.ant-pagination-next:not(.ant-pagination-disabled) button',
                            '.ant-pagination-next:not(.ant-pagination-disabled) button',
                            'li[title="下一页"] button',
                            '.ant-pagination-next button[type="button"]',
                            '.ant-pagination-next button:not([disabled])',
                            '.ant-pagination-next .ant-pagination-item-link'
                        ];
                        
                        let nextPageClicked = false;
                        for (const selector of nextPageSelectors) {
                            try {
                                const nextButton = await this.page.$(selector);
                                if (nextButton) {
                                    console.log(`找到下一页按钮，使用选择器: ${selector}`);
                                    
                                    // 检查按钮是否可点击
                                    const isClickable = await this.page.evaluate((button) => {
                                        // 检查按钮是否被禁用
                                        if (button.disabled || button.getAttribute('disabled')) {
                                            return false;
                                        }
                                        
                                        // 检查父元素是否被禁用
                                        const parentLi = button.closest('li');
                                        if (parentLi && parentLi.getAttribute('aria-disabled') === 'true') {
                                            return false;
                                        }
                                        
                                        // 检查按钮是否可见且可交互
                                        const style = window.getComputedStyle(button);
                                        if (style.display === 'none' || style.visibility === 'hidden') {
                                            return false;
                                        }
                                        
                                        return true;
                                    }, nextButton);
                                    
                                    if (!isClickable) {
                                        console.log('下一页按钮不可点击（可能只有一页），跳过当前商品');
                                        nextPageClicked = false;
                                        break;
                                    }
                                    
                                    // 滚动到按钮位置
                                    await nextButton.scrollIntoViewIfNeeded();
                                    await this.page.waitForTimeout(1000);
                                    
                                    // 点击下一页
                                    await nextButton.click();
                                    console.log('成功点击下一页');
                                    
                                    nextPageClicked = true;
                                    
                                    // 等待新页面加载
                                    await this.page.waitForTimeout(3000);
                                    break;
                                }
                            } catch (error) {
                                console.log(`选择器 ${selector} 失败: ${error.message}`);
                                continue;
                            }
                        }
                        
                        if (!nextPageClicked) {
                            console.log('未找到下一页按钮或按钮不可点击，停止翻页');
                            break;
                        }
                        
                    } catch (error) {
                        console.log(`翻页失败: ${error.message}`);
                        break;
                    }
                }
                
                currentPage++;
            }
            
            // 限制返回的图片数量
            const result = allImageUrls.slice(0, maxImages);
            console.log(`总共提取到 ${allImageUrls.length} 张图片，返回 ${result.length} 张`);
            
            return result;
            
        } catch (error) {
            console.error(`爬取商品 ${productIndex} 评价图片失败:`, error);
            return [];
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
            console.log('1688搜索浏览器已关闭');
        } catch (error) {
            console.error('关闭1688搜索浏览器失败:', error);
        }
    }


    getRandomUserAgent() {
        const uaList = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.5112.79 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        ];
        
        return uaList[Math.floor(Math.random() * uaList.length)];
    }
}

exports.Search1688Node = Search1688Node;
