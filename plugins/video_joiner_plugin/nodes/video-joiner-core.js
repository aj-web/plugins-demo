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
        if (mod != null) for (var k of ownKeys(mod)) if (k !== "default") __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoJoinerCoreNode = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const { findLocalFfmpeg } = require('../utils/ffmpeg-locator');

// 配置 FFmpeg 路径
const ffmpeg = (0, fluent_ffmpeg_1.default)();
// 尝试设置 FFmpeg 路径（如果主框架提供了的话）
try {
    // 检查是否有主框架提供的 FFmpeg 路径
    if (process.env.FFMPEG_PATH) {
        ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    // 在打包环境中，FFmpeg 可能在 resources 目录下
    const possibleFfmpegPath = path.join(process.resourcesPath || '', 'ffmpeg.exe');
    if (fs.existsSync(possibleFfmpegPath)) {
        ffmpeg.setFfmpegPath(possibleFfmpegPath);
    }
} catch (error) {
    console.warn('FFmpeg path configuration failed:', error.message);
}

class VideoJoinerCoreNode {
    /**
     * 批量处理任务
     */
    async processTasks(tasks) {
        console.log('=== VideoJoinerCoreNode.processTasks 开始 ===');
        console.log('当前工作目录:', process.cwd());
        console.log('任务数量:', tasks.length);
        console.log('第一个任务示例:', JSON.stringify(tasks[0], null, 2));
        
        const results = [];
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            console.log(`\n--- 处理任务 ${i + 1}/${tasks.length} ---`);
            console.log('任务信息:', {
                v1Path: task.v1Path,
                v2Path: task.v2Path,
                outputPath: task.outputPath,
                taskInfo: task.taskInfo
            });
            
            // 检查文件是否存在
            const fs = require('fs');
            console.log('v1Path 存在:', fs.existsSync(task.v1Path));
            console.log('v2Path 存在:', fs.existsSync(task.v2Path));
            console.log('outputPath 存在:', fs.existsSync(task.outputPath));
            
            try {
                const result = await this.joinTwoVideos(task.v1Path, task.v2Path, task.outputPath, task.taskInfo, i + 1, tasks.length);
                results.push(result);
                console.log(`任务 ${i + 1} 完成:`, result);
            }
            catch (e) {
                console.error(`任务 ${i + 1} 失败:`, e.message);
                results.push({
                    filename: path.basename(task.v2Path),
                    status: 'error',
                    message: `任务执行异常: ${e.message}`,
                    processTime: 0,
                    taskInfo: task.taskInfo
                });
            }
        }
        console.log('=== VideoJoinerCoreNode.processTasks 结束 ===');
        console.log('最终结果:', results);
        return results;
    }
    /**
     * 拼接两个视频
     */
    async joinTwoVideos(v1Path, v2Path, outputPath, taskInfo, taskNumber, totalTasks) {
        const startTime = Date.now();
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        const mainName = path.basename(v2Path, path.extname(v2Path));
        const mainExt = path.extname(v2Path);
        const newFilename = `${mainName}${mainExt}`;
        const resultPath = path.join(outputPath, newFilename);
        
        return new Promise((resolve, reject) => {
            // 每次调用都创建新的 FFmpeg 实例，避免输入文件累积
            const ffmpeg = require('fluent-ffmpeg')();
            
            // 配置 FFmpeg 路径
            try {
                if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
                    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
                } else {
                    const localFfmpeg = findLocalFfmpeg();
                    if (localFfmpeg) {
                        ffmpeg.setFfmpegPath(localFfmpeg);
                    }
                }
                const possibleFfmpegPath = path.join(process.resourcesPath || '', 'ffmpeg.exe');
                if (fs.existsSync(possibleFfmpegPath)) {
                    ffmpeg.setFfmpegPath(possibleFfmpegPath);
                }
            } catch (error) {
                console.warn('FFmpeg path configuration failed:', error.message);
            }
            
            ffmpeg
                .input(v1Path)
                .input(v2Path)
                .complexFilter('[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]')
                .outputOptions(['-map [v]', '-map [a]'])
                .output(resultPath)
                .on('start', (cmd) => {
                console.log(`开始处理任务 [${taskNumber}/${totalTasks}]: ${mainName}`);
                console.log('FFmpeg 命令:', cmd);
            })
                .on('error', (err) => {
                console.error(`FFmpeg 错误 [${taskNumber}/${totalTasks}]:`, err.message);
                reject({
                    filename: newFilename,
                    status: 'error',
                    message: `错误 [${taskNumber}/${totalTasks}] 处理 ${mainName} 时出错: ${err.message}`,
                    processTime: (Date.now() - startTime) / 1000,
                    taskInfo
                });
            })
                .on('end', () => {
                console.log(`任务完成 [${taskNumber}/${totalTasks}]: ${mainName}`);
                resolve({
                    filename: newFilename,
                    status: 'success',
                    message: `成功 [${taskNumber}/${totalTasks}] 处理 ${mainName}`,
                    processTime: (Date.now() - startTime) / 1000,
                    taskInfo
                });
            })
                .run();
        });
    }
}
exports.VideoJoinerCoreNode = VideoJoinerCoreNode;
