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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageDeduplicator = void 0;
exports.quickDeduplicateImages = quickDeduplicateImages;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const jimp_1 = __importDefault(require("jimp"));
class ImageDeduplicator {
    constructor() {
        this.hashCache = new Map();
        this.downloadTimeout = 10000;
    }
    async fetchImageBuffer(url) {
        if (this.hashCache.has(url)) {
            return null;
        }
        let processedUrl = url;
        if (url.includes('x-oss-process=image/format,webp')) {
            processedUrl = url.replace('x-oss-process=image/format,webp', 'x-oss-process=image/format,png');
        }
        return new Promise((resolve, reject) => {
            const getter = processedUrl.startsWith("https") ? https : http;
            const timeout = setTimeout(() => {
                reject(new Error(`下载超时: ${processedUrl}`));
            }, this.downloadTimeout);
            getter
                .get(processedUrl, (res) => {
                clearTimeout(timeout);
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    this.fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${processedUrl}`));
                    return;
                }
                const contentType = res.headers['content-type'] || '';
                if (!contentType.startsWith('image/')) {
                    reject(new Error(`非图片类型: ${contentType}`));
                    return;
                }
                const chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => {
                    const buffer = Buffer.concat(chunks);
                    if (buffer.length < 100) {
                        reject(new Error('图片数据太小'));
                    }
                    else {
                        resolve(buffer);
                    }
                });
                res.on("error", reject);
            })
                .on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    async computeSimpleHash(imageBuffer) {
        try {
            const image = await jimp_1.default.read(imageBuffer);
            const resized = image.resize(8, 8).greyscale();
            let sum = 0;
            let pixelCount = 0;
            resized.scan(0, 0, 8, 8, (x, y, idx) => {
                const grey = resized.bitmap.data[idx];
                sum += grey;
                pixelCount++;
            });
            const avg = sum / pixelCount;
            let hash = '';
            resized.scan(0, 0, 8, 8, (x, y, idx) => {
                const grey = resized.bitmap.data[idx];
                hash += grey >= avg ? '1' : '0';
            });
            return hash;
        }
        catch (error) {
            throw new Error(`图片处理失败: ${error.message}`);
        }
    }
    hammingDistance(hash1, hash2) {
        if (hash1.length !== hash2.length)
            return 64;
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i])
                distance++;
        }
        return distance;
    }
    similarity(hash1, hash2) {
        const distance = this.hammingDistance(hash1, hash2);
        return 1 - (distance / 64);
    }
    async getHashFromUrl(url) {
        if (this.hashCache.has(url)) {
            return this.hashCache.get(url) || null;
        }
        try {
            const buffer = await this.fetchImageBuffer(url);
            if (!buffer)
                return null;
            const hash = await this.computeSimpleHash(buffer);
            this.hashCache.set(url, hash);
            return hash;
        }
        catch (error) {
            console.warn(`处理图片失败 ${url}: ${error.message}`);
            this.hashCache.set(url, null);
            return null;
        }
    }
    async selectDistinctImages(urls, limit = 15, maxSimilarity = 0.85) {
        console.log(`开始处理 ${urls.length} 张图片，目标选择 ${limit} 张...`);
        const selected = [];
        const selectedHashes = [];
        const rejected = [];
        const stats = {
            total: urls.length,
            processed: 0,
            failed: 0,
            duplicates: 0,
            selected: 0
        };
        const concurrency = 2;
        for (let i = 0; i < urls.length; i += concurrency) {
            if (selected.length >= limit)
                break;
            const batch = urls.slice(i, Math.min(i + concurrency, urls.length));
            const hashPromises = batch.map(url => this.getHashFromUrl(url));
            const hashes = await Promise.all(hashPromises);
            for (let j = 0; j < batch.length && selected.length < limit; j++) {
                const url = batch[j];
                const hash = hashes[j];
                stats.processed++;
                if (!hash) {
                    stats.failed++;
                    rejected.push({ url, reason: '处理失败' });
                    continue;
                }
                let isDuplicate = false;
                let maxSim = 0;
                let similarTo = null;
                for (let k = 0; k < selectedHashes.length; k++) {
                    const sim = this.similarity(hash, selectedHashes[k]);
                    if (sim > maxSim) {
                        maxSim = sim;
                        similarTo = selected[k];
                    }
                    if (sim >= maxSimilarity) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (isDuplicate) {
                    stats.duplicates++;
                    rejected.push({
                        url,
                        reason: '重复',
                        similarity: maxSim,
                        similarTo: similarTo || undefined
                    });
                }
                else {
                    selected.push(url);
                    selectedHashes.push(hash);
                    stats.selected++;
                    console.log(`[${stats.selected}/${limit}] 选择: ${url.substring(0, 80)}...`);
                }
            }
            console.log(`进度: ${stats.processed}/${urls.length}, 已选择: ${stats.selected}, 重复: ${stats.duplicates}, 失败: ${stats.failed}`);
        }
        console.log(`完成！最终选择了 ${stats.selected} 张图片`);
        return { selected, rejected, stats };
    }
    clearCache() {
        this.hashCache.clear();
        console.log('缓存已清理');
    }
    getCacheStats() {
        return {
            size: this.hashCache.size,
            memory: `${Math.round(this.hashCache.size * 100 / 1024)} KB (估算)`
        };
    }
}
exports.ImageDeduplicator = ImageDeduplicator;
async function quickDeduplicateImages(urls, limit = 15, maxSimilarity = 0.85) {
    const deduplicator = new ImageDeduplicator();
    const result = await deduplicator.selectDistinctImages(urls, limit, maxSimilarity);
    return result.selected;
}
