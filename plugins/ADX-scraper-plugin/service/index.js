#!/usr/bin/env node

/**
 * Video Analyzer Node.js - 主入口文件
 * 提供命令行接口和API
 */

const path = require('path');
const fs = require('fs');
const VideoAnalyzer = require('./VideoAnalyzer');

// 命令行参数解析
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    videoPath: null,
    outputDir: null,
    maxFrames: null,
    heatmapThreshold: 30,
    skipPrecheck: false,
    help: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-o':
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--max-frames':
        options.maxFrames = parseInt(args[++i]);
        break;
      case '--heatmap-threshold':
        options.heatmapThreshold = parseInt(args[++i]);
        break;
      case '--skip-precheck':
        options.skipPrecheck = true;
        break;
      default:
        if (!options.videoPath && !arg.startsWith('-')) {
          options.videoPath = arg;
        }
        break;
    }
  }

  return options;
}

// 显示帮助信息
function showHelp() {
  console.log(`
Video Analyzer Node.js - Video Analysis Tool

Usage: node src/index.js [options] [video_path]

Arguments:
  video_path              Path to the video file to analyze (default: ../videos/1.mp4)

Options:
  -h, --help             Show this help message
  -v, --verbose          Enable verbose output
  -o, --output DIR       Output directory for results (default: video_dir/analysis_results)
  --max-frames N         Maximum number of frames to process (default: all)
  --heatmap-threshold N  Threshold for stability heatmap (default: 30)
  --skip-precheck        Skip video integrity precheck

Examples:
  node src/index.js                                    # Use default video
  node src/index.js ../videos/1.mp4                    # Specify video file
  node src/index.js -o ./results --max-frames 1000     # Use default video with options
  node src/index.js --verbose --heatmap-threshold 25 ../videos/1.mp4
`);
}

// 验证输入
function validateInput(options) {
  if (!options.videoPath) {
    // 使用默认视频路径
    options.videoPath = '../videos/1.mp4';
    console.log(`Using default video: ${options.videoPath}`);
  }

  if (!fs.existsSync(options.videoPath)) {
    console.error(`Error: Video file not found: ${options.videoPath}`);
    return false;
  }

  // 检查文件扩展名
  const ext = path.extname(options.videoPath).toLowerCase();
  const supportedFormats = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];
  
  if (!supportedFormats.includes(ext)) {
    console.warn(`Warning: File format ${ext} may not be supported`);
  }

  return true;
}

// 格式化时间
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// 主函数
async function main() {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  if (!validateInput(options)) {
    process.exit(1);
  }

  console.log('Video Analyzer Node.js - Starting Analysis');
  console.log('=' .repeat(50));
  console.log(`Video: ${options.videoPath}`);
  
  if (options.outputDir) {
    console.log(`Output: ${options.outputDir}`);
  }
  
  if (options.maxFrames) {
    console.log(`Max frames: ${options.maxFrames}`);
  }
  
  console.log(`Heatmap threshold: ${options.heatmapThreshold}`);
  console.log(`Skip precheck: ${options.skipPrecheck}`);
  console.log('');

  try {
    // 创建分析器实例
    const analyzer = new VideoAnalyzer(options.videoPath, options.outputDir);
    
    // 执行分析
    const startTime = Date.now();
    const results = await analyzer.analyzeVideo({
      maxFrames: options.maxFrames,
      heatmapThreshold: options.heatmapThreshold,
      skipPrecheck: options.skipPrecheck
    });
    const totalTime = Date.now() - startTime;

    // 显示结果摘要
    console.log('\n' + '='.repeat(50));
    console.log('ANALYSIS SUMMARY');
    console.log('='.repeat(50));
    
    const summary = analyzer.getAnalysisSummary();
    
    console.log(`Video File: ${summary.videoFile}`);
    console.log(`Resolution: ${summary.resolution}`);
    console.log(`Duration: ${summary.duration}`);
    console.log(`Total Frames: ${summary.totalFrames}`);
    console.log(`Frame Rate: ${summary.fps} fps`);
    console.log(`File Size: ${formatFileSize(results.videoInfo.fileSize)}`);
    
    if (summary.stabilityAnalysis) {
      console.log('\nStability Analysis:');
      console.log(`  Stability Ratio: ${summary.stabilityAnalysis.stabilityRatio}`);
      console.log(`  Change Intensity: ${summary.stabilityAnalysis.changeIntensity}`);
      console.log(`  Recommendation: ${summary.stabilityAnalysis.recommendation}`);
    }
    
    if (summary.tailFrameDetection) {
      console.log('\nTail Frame Detection:');
      console.log(`  Detected: ${summary.tailFrameDetection.detected ? 'Yes' : 'No'}`);
      if (summary.tailFrameDetection.detected) {
        console.log(`  Frame Index: ${summary.tailFrameDetection.frameIndex}`);
        console.log(`  Confidence: ${summary.tailFrameDetection.confidence}`);
      }
      console.log(`  Recommendation: ${summary.tailFrameDetection.recommendation}`);
    }
    
    console.log(`\nOverall Health: ${summary.overallHealth}`);
    console.log(`Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    
    // 显示输出文件位置
    console.log('\nOutput Files:');
    console.log(`  Results Directory: ${analyzer.outputDir}`);
    console.log('  Generated files: average image, heatmap, stability mask, analysis JSON');
    
    if (results.tailDetectionResult && results.tailDetectionResult.tailFrameIndex >= 0) {
      console.log('  Additional: tail frame strip');
    }

    // 详细信息（如果启用verbose）
    if (options.verbose) {
      console.log('\n' + '='.repeat(50));
      console.log('DETAILED RESULTS');
      console.log('='.repeat(50));
      
      if (results.precheckResult) {
        console.log('\nPrecheck Result:');
        console.log(`  Success: ${results.precheckResult.success}`);
        console.log(`  Has NAL Error: ${results.precheckResult.hasNALError}`);
        console.log(`  Recommendation: ${results.precheckResult.recommendation}`);
      }
      
      if (results.heatmapResult) {
        console.log('\nHeatmap Statistics:');
        console.log(`  Min Value: ${results.heatmapResult.stats.minValue.toFixed(2)}`);
        console.log(`  Max Value: ${results.heatmapResult.stats.maxValue.toFixed(2)}`);
        console.log(`  Mean Value: ${results.heatmapResult.stats.meanValue.toFixed(2)}`);
        console.log(`  Std Value: ${results.heatmapResult.stats.stdValue.toFixed(2)}`);
        console.log(`  Stable Pixels: ${results.heatmapResult.stats.stablePixels}`);
        console.log(`  Total Pixels: ${results.heatmapResult.stats.totalPixels}`);
      }
      
      if (results.tailDetectionResult) {
        console.log('\nTail Detection Statistics:');
        console.log(`  Method: ${results.tailDetectionResult.method}`);
        console.log(`  Total Frames: ${results.tailDetectionResult.stats.totalFrames}`);
        console.log(`  Mean Similarity: ${results.tailDetectionResult.stats.meanSimilarity.toFixed(3)}`);
        console.log(`  Std Similarity: ${results.tailDetectionResult.stats.stdSimilarity.toFixed(3)}`);
        console.log(`  Detection Success: ${results.tailDetectionResult.stats.detectionSuccess}`);
      }
    }

    // 清理资源
    analyzer.cleanup();
    
    console.log('\nAnalysis completed successfully!');

  } catch (error) {
    console.error('\nAnalysis failed:');
    console.error(`Error: ${error.message}`);
    
    if (options.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 如果直接运行此文件，执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  VideoAnalyzer,
  main
};