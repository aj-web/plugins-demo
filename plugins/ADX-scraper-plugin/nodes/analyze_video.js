const VideoAnalyzer = require('../service/VideoAnalyzer');
const path = require('path');
const fs = require('fs');

async function analyzeVideo() {
    // 从命令行参数获取视频路径，如果没有则使用默认路径
    const videoPath = process.argv[2] || '../videos/1.mp4';
    const outputDir = './analysis_output';
    
    try {
        console.log('🎬 开始分析视频:', videoPath);
        
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 创建视频分析器实例并运行完整分析
        const analyzer = new VideoAnalyzer(videoPath, outputDir, {
            enableONNXDetection: true,
            onnxModelPath: '../models/best.onnx'
        });
        const result = await analyzer.analyze(videoPath, {
            maxFrames: 50,
            heatmapThreshold: 0.5,
            tailDuration: 10,
            multiplier: 3.0
        });
        
        console.log('\n✅ 分析完成!');
        console.log('结果:', {
            videoInfo: result.videoInfo,
            frameCount: result.videoInfo?.totalFrames,
            stabilityStats: result.stabilityMask?.stats,
            elementPositionAnalysis: result.elementPositionAnalysis,
            tailDetection: {
                hasTail: result.tailDetection?.hasTail,
                confidence: result.tailDetection?.confidence,
                tailStartTime: result.tailDetection?.tailStartTime
            },
            onnxDetection: result.onnxDetection,
            outputFiles: result.outputFiles
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ 分析过程中出现错误:', error);
        throw error;
    }
}

// 运行分析
if (require.main === module) {
    analyzeVideo()
        .then(result => {
            console.log('\n🎉 分析成功完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 分析失败:', error.message);
            process.exit(1);
        });
}

module.exports = analyzeVideo;