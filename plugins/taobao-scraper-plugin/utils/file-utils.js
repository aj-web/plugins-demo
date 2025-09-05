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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class FileUtils {
    static ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    static getFileInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                name: path.basename(filePath),
                path: filePath,
                size: stats.size,
                extension: path.extname(filePath),
                isDirectory: stats.isDirectory(),
                modifiedTime: stats.mtime
            };
        }
        catch (error) {
            return null;
        }
    }
    static readFile(filePath, encoding = 'utf8') {
        try {
            return fs.readFileSync(filePath, encoding);
        }
        catch (error) {
            console.error(`读取文件失败: ${filePath}`, error);
            return null;
        }
    }
    static writeFile(filePath, content, encoding = 'utf8') {
        try {
            this.ensureDirectory(path.dirname(filePath));
            fs.writeFileSync(filePath, content, encoding);
            return true;
        }
        catch (error) {
            console.error(`写入文件失败: ${filePath}`, error);
            return false;
        }
    }
    static copyFile(sourcePath, targetPath) {
        try {
            this.ensureDirectory(path.dirname(targetPath));
            fs.copyFileSync(sourcePath, targetPath);
            return true;
        }
        catch (error) {
            console.error(`复制文件失败: ${sourcePath} -> ${targetPath}`, error);
            return false;
        }
    }
    static deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                }
                else {
                    fs.unlinkSync(filePath);
                }
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`删除文件失败: ${filePath}`, error);
            return false;
        }
    }
    static listDirectory(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                return [];
            }
            const files = fs.readdirSync(dirPath);
            return files.map(file => {
                const fullPath = path.join(dirPath, file);
                return this.getFileInfo(fullPath);
            }).filter((info) => info !== null);
        }
        catch (error) {
            console.error(`列出目录失败: ${dirPath}`, error);
            return [];
        }
    }
    static getFileHash(filePath, algorithm = 'md5') {
        try {
            const content = fs.readFileSync(filePath);
            const hash = crypto.createHash(algorithm);
            hash.update(content);
            return hash.digest('hex');
        }
        catch (error) {
            console.error(`计算文件哈希失败: ${filePath}`, error);
            return null;
        }
    }
    static exists(filePath) {
        return fs.existsSync(filePath);
    }
    static getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        }
        catch (error) {
            return 0;
        }
    }
    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    static getTempDir() {
        return path.join(require('os').tmpdir(), 'taobao-crawler');
    }
    static cleanupTempFiles() {
        try {
            const tempDir = this.getTempDir();
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
        catch (error) {
            console.error('清理临时文件失败:', error);
        }
    }
}
exports.FileUtils = FileUtils;
