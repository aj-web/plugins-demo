/**
 * VisualizationGenerator - 可视化生成器
 * 用于生成尾帧前后帧的可视化图像
 */

const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

class VisualizationGenerator {
  constructor(outputDir = null) {
    this.outputDir = outputDir || './output';
  }

  /**
   * 生成尾帧前后5帧的横向拼接图
   * @param {Array} frames - 帧数据数组（来自TailDetector的analysisData）
   * @param {number} tailStartIdx - 尾帧在frames数组中的索引
   * @param {string} videoPath - 视频文件路径
   * @param {Object} videoInfo - 视频信息
   * @returns {Promise<string>} 生成的拼接图路径
   */
  async generateTailFramesVisualization(frames, tailStartIdx, videoPath, videoInfo) {
    if (!frames || frames.length === 0) {
      throw new Error('No frames data provided');
    }

    if (tailStartIdx < 0 || tailStartIdx >= frames.length) {
      throw new Error(`Invalid tail frame index: ${tailStartIdx}`);
    }

    console.log(`生成尾帧可视化: 尾帧索引 ${tailStartIdx}, 总帧数 ${frames.length}`);

    // 确定要提取的帧范围：尾帧前后各5帧，总共10帧
    const framesBefore = 5;
    const framesAfter = 5;
    const totalFrames = framesBefore + framesAfter;

    const startIdx = Math.max(0, tailStartIdx - framesBefore);
    const endIdx = Math.min(frames.length - 1, tailStartIdx + framesAfter - 1);
    
    console.log(`提取帧范围: ${startIdx} - ${endIdx} (尾帧在索引 ${tailStartIdx})`);

    // 获取需要提取的帧的时间戳
    const frameTimestamps = [];
    for (let i = startIdx; i <= endIdx; i++) {
      frameTimestamps.push(frames[i].timestamp);
    }

    console.log(`提取 ${frameTimestamps.length} 帧，时间范围: ${frameTimestamps[0].toFixed(2)}s - ${frameTimestamps[frameTimestamps.length-1].toFixed(2)}s`);

    // 从视频中提取这些帧
    const extractedFrames = await this.extractSpecificFrames(videoPath, frameTimestamps, videoInfo);

    if (extractedFrames.length === 0) {
      throw new Error('Failed to extract frames from video');
    }

    // 生成横向拼接图
    const stitchedImage = await this.createHorizontalStitch(extractedFrames, tailStartIdx - startIdx);

    // 保存拼接图
    const outputPath = path.join(this.outputDir, 'tail_frames_visualization.png');
    await stitchedImage.writeAsync(outputPath);

    console.log(`尾帧可视化图已保存: ${outputPath}`);
    return outputPath;
  }

  /**
   * 从视频中提取指定时间戳的帧
   * @param {string} videoPath - 视频文件路径
   * @param {Array} timestamps - 时间戳数组（秒）
   * @param {Object} videoInfo - 视频信息
   * @returns {Promise<Array>} 提取的帧数据数组
   */
  async extractSpecificFrames(videoPath, timestamps, videoInfo) {
    const ffmpeg = require('fluent-ffmpeg');
    const { promisify } = require('util');
    const { spawn } = require('child_process');

    const frames = [];
    const tempDir = path.join(this.outputDir, 'temp_frames');
    
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // 为每个时间戳提取一帧
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const outputPath = path.join(tempDir, `frame_${i.toString().padStart(3, '0')}.png`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .frames(1)
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        // 加载帧数据
        const frameImage = await Jimp.read(outputPath);
        frames.push(frameImage);
      }

      return frames;
    } finally {
      // 清理临时文件
      try {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            fs.unlinkSync(path.join(tempDir, file));
          }
          fs.rmdirSync(tempDir);
        }
      } catch (error) {
        console.warn('清理临时文件失败:', error.message);
      }
    }
  }

  /**
   * 创建横向拼接图
   * @param {Array} frames - Jimp图像对象数组
   * @param {number} tailFrameIndex - 尾帧在数组中的索引
   * @returns {Promise<Jimp>} 拼接后的图像
   */
  async createHorizontalStitch(frames, tailFrameIndex) {
    if (!frames || frames.length === 0) {
      throw new Error('No frames to stitch');
    }

    const frameWidth = frames[0].bitmap.width;
    const frameHeight = frames[0].bitmap.height;
    const totalWidth = frameWidth * frames.length;
    const totalHeight = frameHeight + 50; // 额外空间用于文字标注

    // 创建拼接画布
    const stitchedImage = new Jimp(totalWidth, totalHeight, 0x000000FF);

    // 拼接每一帧
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const x = i * frameWidth;
      
      // 复制帧到拼接图
      stitchedImage.composite(frame, x, 0);

      // 如果是尾帧，添加红色边框
      if (i === tailFrameIndex) {
        const red = 0xFF0000FF;
        const borderWidth = 3;
        
        // 上边框
        for (let bx = x; bx < x + frameWidth; bx++) {
          for (let by = 0; by < borderWidth; by++) {
            stitchedImage.setPixelColor(red, bx, by);
          }
        }
        
        // 下边框
        for (let bx = x; bx < x + frameWidth; bx++) {
          for (let by = frameHeight - borderWidth; by < frameHeight; by++) {
            stitchedImage.setPixelColor(red, bx, by);
          }
        }
        
        // 左边框
        for (let by = 0; by < frameHeight; by++) {
          for (let bx = x; bx < x + borderWidth; bx++) {
            stitchedImage.setPixelColor(red, bx, by);
          }
        }
        
        // 右边框
        for (let by = 0; by < frameHeight; by++) {
          for (let bx = x + frameWidth - borderWidth; bx < x + frameWidth; bx++) {
            stitchedImage.setPixelColor(red, bx, by);
          }
        }

        // 在底部添加"尾帧"标记
        try {
          const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
          const text = 'TAIL';
          const textWidth = Jimp.measureText(font, text);
          const textX = x + (frameWidth - textWidth) / 2;
          const textY = frameHeight + 20;
          stitchedImage.print(font, textX, textY, text);
        } catch (error) {
          // 忽略字体加载错误，继续处理
        }
      }

      // 在底部添加帧序号
      try {
        const font = await Jimp.loadFont(Jimp.FONT_SANS_12_WHITE);
        const frameNumber = `${i + 1}`;
        const textWidth = Jimp.measureText(font, frameNumber);
        const textX = x + (frameWidth - textWidth) / 2;
        const textY = frameHeight + 5;
        stitchedImage.print(font, textX, textY, frameNumber);
      } catch (error) {
        // 忽略字体加载错误，继续处理
      }
    }

    return stitchedImage;
  }

  /**
   * 设置输出目录
   * @param {string} outputDir - 输出目录路径
   */
  setOutputDir(outputDir) {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
}

module.exports = VisualizationGenerator;