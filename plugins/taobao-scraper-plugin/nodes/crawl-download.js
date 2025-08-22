"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlDownloadNode = void 0;
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { GlobalCookieManager } = require('../utils/global-cookie-manager');

class CrawlDownloadNode {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cookieManager = GlobalCookieManager.getInstance();
    }

    /**
     * 爬取商品详情页的好评图片
     */
    async crawlGoodReviews(productUrl, outputDir) {
        try {
            console.log('开始爬取商品好评图片:', productUrl);

            // 检查输出目录
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 启动浏览器（如果还没有启动）
            if (!this.browser) {
                await this.initBrowser();
            }

            // 导航到商品详情页
            console.log('导航到商品详情页...');
            await this.page.goto(productUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // 等待页面加载完成
            await this.page.waitForSelector('.tb-detail-hd', { timeout: 10000 });

            // 获取商品标题
            const productTitle = await this.page.evaluate(() => {
                const titleElement = document.querySelector('.tb-detail-hd h1, .tb-main-title');
                return titleElement ? titleElement.textContent.trim() : '未知商品';
            });

            console.log('商品标题:', productTitle);

            // 查找并点击评价标签
            console.log('查找评价标签...');
            const reviewTab = await this.page.$('a[href*="rate"], .rate-tab, .comment-tab');
            if (reviewTab) {
                await reviewTab.click();
                console.log('点击评价标签');
                await this.page.waitForTimeout(3000);
            }

            // 等待评价内容加载
            await this.page.waitForSelector('.rate-list, .comment-list', { timeout: 10000 });

            // 查找好评标签
            console.log('查找好评标签...');
            const goodReviewTab = await this.page.$('a[data-value="good"], .good-review, .positive-review');
            if (goodReviewTab) {
                await goodReviewTab.click();
                console.log('点击好评标签');
                await this.page.waitForTimeout(3000);
            }

            // 提取好评图片
            const reviewImages = await this.extractReviewImages();

            console.log(`找到 ${reviewImages.length} 张好评图片`);

            // 下载图片
            const downloadResults = await this.downloadImages(reviewImages, outputDir, productTitle);

            return {
                success: true,
                productTitle,
                totalImages: reviewImages.length,
                downloadedImages: downloadResults.downloaded,
                failedImages: downloadResults.failed,
                outputDir
            };

        } catch (error) {
            console.error('爬取好评图片失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * 初始化浏览器
     */
    async initBrowser() {
        
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

        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        this.page = await this.context.newPage();
    }

    /**
     * 提取评价图片
     */
    async extractReviewImages() {
        const images = await this.page.evaluate(() => {
            const imageElements = document.querySelectorAll('.rate-list img, .comment-list img, .review-img img');
        const imageUrls = [];

            imageElements.forEach((img, index) => {
                const src = img.src || img.getAttribute('data-src');
                if (src && src.includes('http')) {
                    // 处理图片URL，确保是高清版本
                    let processedUrl = src;
                    if (src.includes('_50x50') || src.includes('_100x100')) {
                        processedUrl = src.replace(/_\d+x\d+/, '_800x800');
                    }
                    imageUrls.push({
                        index: index + 1,
                        originalUrl: src,
                        processedUrl: processedUrl
                    });
                }
            });

        return imageUrls;
        });

        return images;
    }

    /**
     * 下载图片
     */
    async downloadImages(images, outputDir, productTitle) {
        const downloaded = [];
        const failed = [];

        for (const image of images) {
            try {
                const fileName = `${productTitle}_好评图_${image.index}.jpg`;
                const filePath = path.join(outputDir, fileName);

                // 下载图片
                await this.downloadFile(image.processedUrl, filePath);
                downloaded.push({
                    index: image.index,
                    fileName,
                    filePath
                });

                console.log(`✅ 下载成功: ${fileName}`);

                // 添加延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ 下载失败 (第${image.index}张):`, error.message);
                failed.push({
                    index: image.index,
                    url: image.processedUrl,
                    error: error.message
                });
            }
        }

        return { downloaded, failed };
    }

    /**
     * 下载单个文件
     */
    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            
            const protocol = url.startsWith('https:') ? https : http;
            
            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const fileStream = fs.createWriteStream(filePath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (error) => {
                    fs.unlink(filePath, () => {}); // 删除不完整的文件
                    reject(error);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('下载超时'));
            });
        });
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
}

exports.CrawlDownloadNode = CrawlDownloadNode;
