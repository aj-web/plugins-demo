"use strict";
/**
 * 文件操作工具类
 */
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
exports.FileUtils = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileUtils {
    /**
     * 根据文件内容推断文件类型和扩展名
     */
    static inferFileType(content) {
        // 检查文件魔数来判断文件类型
        if (content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
            return {
                contentType: "image/jpeg",
                fileExtension: "jpg",
                mimeType: "image/jpeg"
            };
        }
        else if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
            return {
                contentType: "image/png",
                fileExtension: "png",
                mimeType: "image/png"
            };
        }
        else if (content.subarray(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) ||
            content.subarray(0, 6).equals(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) {
            return {
                contentType: "image/gif",
                fileExtension: "gif",
                mimeType: "image/gif"
            };
        }
        else if (content.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
            content.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) {
            return {
                contentType: "image/webp",
                fileExtension: "webp",
                mimeType: "image/webp"
            };
        }
        else if (content.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
            return {
                contentType: "application/pdf",
                fileExtension: "pdf",
                mimeType: "application/pdf"
            };
        }
        else {
            // 默认返回JPEG类型
            return {
                contentType: "image/jpeg",
                fileExtension: "jpg",
                mimeType: "image/jpeg"
            };
        }
    }
    /**
     * 确保目录存在，如果不存在则创建
     */
    static ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    /**
     * 保存JSON数据到文件
     */
    static saveJsonToFile(data, filePath) {
        const dir = path.dirname(filePath);
        this.ensureDirectoryExists(dir);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    /**
     * 从文件加载JSON数据
     */
    static loadJsonFromFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            console.error(`Error loading JSON from ${filePath}:`, error);
        }
        return null;
    }
    /**
     * 读取文件内容
     */
    static readFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath);
            }
        }
        catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
        return null;
    }
    /**
     * 写入文件内容
     */
    static writeFile(filePath, content) {
        const dir = path.dirname(filePath);
        this.ensureDirectoryExists(dir);
        fs.writeFileSync(filePath, content);
    }
    /**
     * 检查文件是否存在
     */
    static fileExists(filePath) {
        return fs.existsSync(filePath);
    }
    /**
     * 获取文件大小
     */
    static getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * 获取文件扩展名
     */
    static getFileExtension(filePath) {
        return path.extname(filePath).toLowerCase();
    }
    /**
     * 生成唯一文件名
     */
    static generateUniqueFileName(originalName, suffix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const uniqueSuffix = suffix ? `_${suffix}` : '';
        return `${name}_${timestamp}_${random}${uniqueSuffix}${ext}`;
    }
    /**
     * 清理临时文件
     */
    static cleanupTempFiles(tempDir, maxAge = 24 * 60 * 60 * 1000) {
        try {
            if (!fs.existsSync(tempDir))
                return;
            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
    }
}
exports.FileUtils = FileUtils;
