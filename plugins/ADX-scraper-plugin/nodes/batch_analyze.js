/**
 * 改进的批量视频分析脚本
 * 支持并行处理、ONNX检测和安全的文件管理
 */

const VideoAnalyzer = require('../service/VideoAnalyzer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class BatchVideoAnalyzer {
    constructor(options = {}) {
        this.videosDir = options.videosDir || '../videos';
        this.outputDir = options.outputDir || './batch_analysis_output';
        this.supportedFormats = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'];
        this.maxConcurrency = options.maxConcurrency || 2; // 限制并发数量
        this.enableONNX = options.enableONNX !== false; // 默认启用ONNX
        this.onnxModelPath = options.onnxModelPath || './models/best.onnx';
        this.results = [];
        this.errors = [];
        this.runningTasks = new Set();
    }

    /**
     * 生成唯一的输出目录名，避免冲突
     */
    generateUniqueOutputDir(videoName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hash = crypto.createHash('md5').update(videoName + timestamp).digest('hex').substring(0, 8);
        return path.join(this.outputDir, `${videoName}_${timestamp}_${hash}`);
    }

    /**
     * 扫描videos目录，找到所有支持的视频文件
     */
    scanVideoFiles() {
        const videosPath = path.resolve(__dirname, this.videosDir);
        
        if (!fs.existsSync(videosPath)) {
            console.log(`📁 videos目录不存在: ${videosPath}`);
            console.log('请创建videos目录并放入需要分析的视频文件');
            return [];
        }

        const files = fs.readdirSync(videosPath);
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return this.supportedFormats.includes(ext);
        });

        console.log(`🔍 在${videosPath}中找到${videoFiles.length}个视频文件:`);
        videoFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });

        return videoFiles.map(file => ({
            filename: file,
            fullPath: path.join(videosPath, file),
            name: path.parse(file).name
        }));
    }

    /**
     * 分析单个视频文件（线程安全版本）
     */
    async analyzeVideo(videoInfo) {
        const { filename, fullPath, name } = videoInfo;
        const videoOutputDir = this.generateUniqueOutputDir(name);
        const taskId = crypto.randomUUID();

        console.log(`\n🎬 [${taskId.substring(0, 8)}] 开始分析视频: ${filename}`);
        console.log(`📂 输出目录: ${videoOutputDir}`);

        this.runningTasks.add(taskId);

        try {
            // 确保输出目录存在
            if (!fs.existsSync(videoOutputDir)) {
                fs.mkdirSync(videoOutputDir, { recursive: true });
            }

            const startTime = Date.now();

            // 创建视频分析器实例，启用ONNX检测
            const analyzer = new VideoAnalyzer(fullPath, videoOutputDir, {
                enableONNXDetection: this.enableONNX,
                onnxModelPath: this.onnxModelPath
            });

            // 运行完整分析
            const result = await analyzer.analyze(fullPath, {
                maxFrames: 50,
                heatmapThreshold: 0.5,
                tailDuration: 10,
                multiplier: 3.0
            });

            const processingTime = (Date.now() - startTime) / 1000;
            
            console.log(`✅ [${taskId.substring(0, 8)}] 视频分析完成! 耗时: ${processingTime.toFixed(2)}秒`);
            console.log(`📄 结果已保存到: ${videoOutputDir}`);

            // 创建精简的分析结果摘要（不包含大数据）
            const detailedResult = {
                taskId: taskId,
                videoInfo: {
                    filename: filename,
                    path: fullPath,
                    ...result.videoInfo
                },
                frameAnalysis: result.frameAnalysis,
                stabilityMask: result.stabilityMask ? {
                    stats: result.stabilityMask.stats,
                    // 移除巨大的heatmap数据，只保留统计信息
                    heatmapStats: {
                        totalPixels: Object.keys(result.stabilityMask.heatmap || {}).length,
                        hasHeatmap: !!result.stabilityMask.heatmap
                    }
                } : null,
                contentArea: result.contentArea,
                tailDetection: result.tailDetection,
                onnxDetection: result.onnxDetection,
                outputFiles: result.outputFiles,
                processing: {
                    processingTime: processingTime,
                    timestamp: new Date().toISOString(),
                    outputDir: videoOutputDir
                }
            };

            // 注意：详细的分析结果已由VideoAnalyzer.saveResults()保存为analysis_results.json
            // 这里不再重复保存，避免文件重复和大小问题

            return {
                success: true,
                taskId: taskId,
                filename: filename,
                result: detailedResult,
                processingTime: processingTime,
                outputDir: videoOutputDir
            };

        } catch (error) {
            console.error(`❌ [${taskId.substring(0, 8)}] 分析视频 ${filename} 时出错:`, error.message);
            
            // 保存错误信息
            const errorResult = {
                success: false,
                taskId: taskId,
                filename: filename,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                outputDir: videoOutputDir
            };

            const errorPath = path.join(videoOutputDir, 'error.json');
            if (fs.existsSync(videoOutputDir)) {
                fs.writeFileSync(errorPath, JSON.stringify(errorResult, null, 2));
            }

            return errorResult;
        } finally {
            this.runningTasks.delete(taskId);
        }
    }

    /**
     * 并行批量分析所有视频
     */
    async analyzeAllVideos() {
        console.log(`🚀 开始批量分析视频目录: ${this.videosDir}`);
        console.log(`🔧 配置: 最大并发数=${this.maxConcurrency}, ONNX检测=${this.enableONNX ? '启用' : '禁用'}`);
        
        const videoFiles = this.scanVideoFiles();
        
        if (videoFiles.length === 0) {
            console.log('❌ 未找到任何视频文件');
            return { success: false, message: '未找到任何视频文件' };
        }

        // 确保批量分析输出目录存在
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const totalStartTime = Date.now();
        
        // 使用Promise.allSettled进行并发控制
        const chunks = [];
        for (let i = 0; i < videoFiles.length; i += this.maxConcurrency) {
            chunks.push(videoFiles.slice(i, i + this.maxConcurrency));
        }

        console.log(`📊 将处理 ${videoFiles.length} 个视频文件，分 ${chunks.length} 批次`);

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            console.log(`\n🔄 处理第 ${chunkIndex + 1}/${chunks.length} 批次 (${chunk.length} 个文件)`);
            
            const promises = chunk.map(videoInfo => this.analyzeVideo(videoInfo));
            const results = await Promise.allSettled(promises);
            
            // 处理结果
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        this.results.push(result.value);
                    } else {
                        this.errors.push(result.value);
                    }
                } else {
                    console.error(`❌ 处理视频时发生未捕获的错误:`, result.reason);
                    this.errors.push({
                        success: false,
                        filename: chunk[index].filename,
                        error: result.reason.message || '未知错误',
                        timestamp: new Date().toISOString()
                    });
                }
            });
        }

        const totalDuration = (Date.now() - totalStartTime) / 1000;

        // 生成批量分析报告
        const batchReport = await this.generateBatchReport(totalDuration);
        
        console.log(`\n🎉 批量分析完成！`);
        console.log(`✅ 成功: ${this.results.length} 个`);
        console.log(`❌ 失败: ${this.errors.length} 个`);
        console.log(`⏱️  总耗时: ${totalDuration.toFixed(2)}秒`);
        console.log(`📋 批量报告: ${batchReport.reportPath}`);

        return {
            success: true,
            summary: {
                totalVideos: videoFiles.length,
                successCount: this.results.length,
                errorCount: this.errors.length,
                totalDuration: totalDuration
            },
            results: this.results,
            errors: this.errors,
            reportPath: batchReport.reportPath
        };
    }

    /**
     * 生成批量分析报告
     */
    async generateBatchReport(totalDuration) {
        const timestamp = new Date().toISOString();
        const report = {
            timestamp: timestamp,
            configuration: {
                videosDir: this.videosDir,
                outputDir: this.outputDir,
                maxConcurrency: this.maxConcurrency,
                enableONNX: this.enableONNX,
                onnxModelPath: this.onnxModelPath
            },
            summary: {
                totalVideos: this.results.length + this.errors.length,
                successCount: this.results.length,
                errorCount: this.errors.length,
                totalDuration: totalDuration,
                averageProcessingTime: this.results.length > 0 ? 
                    this.results.reduce((sum, r) => sum + r.processingTime, 0) / this.results.length : 0
            },
            successfulAnalyses: this.results.map(r => ({
                filename: r.filename,
                taskId: r.taskId,
                processingTime: r.processingTime,
                outputDir: r.outputDir,
                videoInfo: r.result.videoInfo,
                contentArea: r.result.contentArea,
                tailDetection: r.result.tailDetection,
                onnxDetection: r.result.onnxDetection
            })),
            errors: this.errors.map(e => ({
                filename: e.filename,
                taskId: e.taskId,
                error: e.error,
                timestamp: e.timestamp,
                outputDir: e.outputDir
            }))
        };

        // 确保输出目录存在
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const reportPath = path.join(this.outputDir, `batch_analysis_report_${timestamp.replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // 生成简化的文本报告
        const textReport = this.generateTextReport(report);
        const textReportPath = path.join(this.outputDir, `batch_analysis_summary_${timestamp.replace(/[:.]/g, '-')}.txt`);
        fs.writeFileSync(textReportPath, textReport);
        
        console.log(`📋 详细报告已保存: ${reportPath}`);
        console.log(`📄 文本报告已保存: ${textReportPath}`);

        return { reportPath, textReportPath };
    }

    /**
     * 生成文本格式的报告
     */
    generateTextReport(report) {
        let text = `视频批量分析报告\n`;
        text += `==================\n\n`;
        text += `分析时间: ${new Date(report.timestamp).toLocaleString()}\n`;
        text += `配置信息:\n`;
        text += `  - 视频目录: ${report.configuration.videosDir}\n`;
        text += `  - 输出目录: ${report.configuration.outputDir}\n`;
        text += `  - 最大并发数: ${report.configuration.maxConcurrency}\n`;
        text += `  - ONNX检测: ${report.configuration.enableONNX ? '启用' : '禁用'}\n`;
        text += `  - ONNX模型: ${report.configuration.onnxModelPath}\n\n`;
        text += `统计信息:\n`;
        text += `  - 总视频数: ${report.summary.totalVideos}\n`;
        text += `  - 成功分析: ${report.summary.successCount}\n`;
        text += `  - 分析失败: ${report.summary.errorCount}\n`;
        text += `  - 总耗时: ${report.summary.totalDuration.toFixed(2)}秒\n`;
        text += `  - 平均处理时间: ${report.summary.averageProcessingTime.toFixed(2)}秒\n\n`;

        if (report.successfulAnalyses.length > 0) {
            text += `成功分析的视频:\n`;
            text += `================\n`;
            report.successfulAnalyses.forEach((analysis, index) => {
                text += `${index + 1}. ${analysis.filename}\n`;
                text += `   - 任务ID: ${analysis.taskId}\n`;
                text += `   - 处理时间: ${analysis.processingTime.toFixed(2)}秒\n`;
                text += `   - 输出目录: ${analysis.outputDir}\n`;
                text += `   - 视频信息: ${analysis.videoInfo.width}x${analysis.videoInfo.height}, ${analysis.videoInfo.duration}秒\n`;
                text += `   - 内容区域: ${JSON.stringify(analysis.contentArea)}\n`;
                text += `   - 尾帧检测: ${analysis.tailDetection.hasTail ? '检测到' : '未检测到'}\n`;
                if (analysis.onnxDetection) {
                    text += `   - ONNX检测: ${analysis.onnxDetection.detectionCount || 0} 个目标\n`;
                }
                text += `\n`;
            });
        }

        if (report.errors.length > 0) {
            text += `分析失败的视频:\n`;
            text += `================\n`;
            report.errors.forEach((error, index) => {
                text += `${index + 1}. ${error.filename}\n`;
                text += `   - 任务ID: ${error.taskId || 'N/A'}\n`;
                text += `   - 错误: ${error.error}\n`;
                text += `   - 时间: ${new Date(error.timestamp).toLocaleString()}\n\n`;
            });
        }

        return text;
    }
}

// 主函数
async function main() {
    const options = {
        videosDir: '../videos',
        outputDir: './batch_analysis_output',
        maxConcurrency: 2, // 可以根据系统性能调整
        enableONNX: true,
        onnxModelPath: './models/best.onnx'
    };

    const batchAnalyzer = new BatchVideoAnalyzer(options);
    
    try {
        const result = await batchAnalyzer.analyzeAllVideos();
        
        if (result.success) {
            console.log('\n🎊 批量分析成功完成！');
            console.log(`📊 处理了 ${result.summary.totalVideos} 个视频文件`);
            console.log(`✅ 成功: ${result.summary.successCount} 个`);
            console.log(`❌ 失败: ${result.summary.errorCount} 个`);
        } else {
            console.log('\n❌ 批量分析失败:', result.message);
        }
        
        return result;
    } catch (error) {
        console.error('❌ 批量分析过程中发生错误:', error);
        return { success: false, error: error.message };
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(result => {
            if (result.success) {
                console.log('\n✨ 程序执行完成');
                process.exit(0);
            } else {
                console.log('\n💥 程序执行失败');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 程序执行过程中发生未捕获的错误:', error);
            process.exit(1);
        });
}

module.exports = BatchVideoAnalyzer;