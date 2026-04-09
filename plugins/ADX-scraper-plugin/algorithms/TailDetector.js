/**
 * TailDetector - 尾帧检测类
 * 使用纯JavaScript替代OpenCV实现
 */

const Jimp = require('jimp');
const MathUtils = require('../utils/MathUtils');
const ImageDiffUtils = require('../utils/ImageDiffUtils');
const ndarray = require('ndarray');

class TailDetector {
  constructor() {
    this.windowSize = 10; // 滑动窗口大小
    this.threshold = 0.8; // 相似度阈值
    this.minTailLength = 5; // 最小尾帧长度
  }

  /**
   * 改进的尾帧检测算法 - 严格对应Python版本
   * 1. 从视频最后8秒开始，每秒10帧采样检测绝对变化率
   * 2. 每一帧与平均图计算掩码内的绝对变化率平均值
   * 4. 检测连续10帧均大于阈值的点，用来检测尾帧
   * @param {Array} frames - 帧数据数组（已经是最后8秒，每秒10帧的采样帧）
   * @param {Object} stabilityMask - 稳定性掩码对象，包含maskAbsoluteAverage属性
   * @param {Object} options - 检测选项
   * @returns {Object} 检测结果
   */
  async detectTailFrameImproved(frames, stabilityMask, options = {}) {
    const { fps = 10, videoDuration = 0, videoTotalFrames = 0, tailDuration = 8, originalFps = 25 } = options;
    
    if (frames.length < 2) {
      return {
        hasTail: false,
        tailStartTime: null,
        tailStartFrame: -1
      };
    }
    
    console.log("开始尾帧检测（每秒10帧采样）...");
    console.log(`基准值X (基于10%-80%正片内容绝对变化率): ${(stabilityMask.maskAbsoluteAverage || 0).toFixed(6)}`);
    
    // 计算实际的时间范围 - 这些帧来自视频的最后8秒
    const startTime = Math.max(0, videoDuration - tailDuration);
    const endTime = videoDuration;
    // 使用原始fps计算视频中的实际帧号
    const startFrameInVideo = Math.floor(startTime * originalFps);
    
    console.log(`分析视频最后${tailDuration}秒的 ${frames.length} 帧（每秒${fps}帧采样）`);
    console.log(`时间范围: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
    console.log(`对应视频帧范围: ${startFrameInVideo} - ${videoTotalFrames} (基于原始fps ${originalFps})`);
    
    // 对于传入的frames数组，索引0对应视频的startFrameInVideo帧
    let startFrameIdx = 0;
    let endFrameIdx = frames.length;
    
    // 获取掩码区域
    const mask = stabilityMask.stabilityMask;
    let maskPixelCount = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) maskPixelCount++;
    }
    
    if (maskPixelCount === 0) {
      console.log("警告: 掩码区域为空，无法进行尾帧检测");
      return {
        hasTail: false,
        tailStartTime: null,
        tailStartFrame: -1
      };
    }
    
    console.log(`掩码内像素数: ${maskPixelCount}`);
    
    // 使用传入的平均图像（基于10%-80%正片内容的前50帧计算），如果没有传入则重新计算
    let avgImage;
    if (options.averageImage && options.averageImage.length > 0) {
      console.log('✅ 使用传入的平均图像（基于10%-80%正片内容的前50帧）');
      console.log(`   平均图像数据长度: ${options.averageImage.length} 字节`);
      avgImage = options.averageImage;
    } else {
      console.log('⚠️  警告：未传入平均图像，将使用尾帧重新计算（可能不准确）');
      avgImage = this.computeMaskedAverageImage(frames, mask);
    }
    
    // 使用智能动态阈值计算
    const maskAbsoluteAverage = stabilityMask.maskAbsoluteAverage || 0;
    const deviationThreshold = this.computeSmartThreshold(maskAbsoluteAverage, stabilityMask);

    
    // 逐帧提取并计算绝对变化率，边计算边判断连续10帧
    const frameDeviations = [];
    const consecutiveFrames = 10; // 连续10帧
    let tailStartIdx = null;
    let tailDetected = false;
    
    console.log("开始处理采样帧（边计算边检测连续10帧）...");
    console.log(`尾帧检测参数:`);
    console.log(`  - 连续帧数要求: ${consecutiveFrames} 帧`);
    console.log(`  - 检测阈值: ${deviationThreshold.toFixed(3)}`);
    
    for (let frameIdx = startFrameIdx; frameIdx < endFrameIdx; frameIdx++) {
      if (frameIdx >= frames.length) {
        console.log(`警告: 无法读取第 ${frameIdx} 帧`);
        continue;
      }
      
      const frame = frames[frameIdx];
      
      // 计算绝对变化率：|帧值-平均值|/256
      const maskDeviationAvg = this.computeAbsoluteChangeRate(frame, avgImage, mask);
      
      frameDeviations.push(maskDeviationAvg);
      
      console.log(`帧 ${frameIdx}: 变化率=${maskDeviationAvg.toFixed(6)}, 阈值=${deviationThreshold.toFixed(6)}, 超过=${maskDeviationAvg > deviationThreshold ? '是' : '否'}`);
      
      // 实时检测连续10帧：当有足够的帧数时开始检测
      if (frameDeviations.length >= consecutiveFrames) {
        // 检查最近的连续10帧是否都超过阈值
        const recentFrames = frameDeviations.slice(-consecutiveFrames);
        const allAboveThreshold = recentFrames.every(deviation => deviation > deviationThreshold);
        
        if (allAboveThreshold && !tailDetected) {
          // 找到连续10帧超过阈值，向前查找第一个超过阈值的帧
          let firstOverThresholdIdx = frameIdx - consecutiveFrames + 1;
          for (let k = firstOverThresholdIdx - 1; k >= 0; k--) {
            if (frameDeviations[k] > deviationThreshold) {
              firstOverThresholdIdx = k;
            } else {
              break; // 遇到不超过阈值的帧就停止
            }
          }
          
          tailStartIdx = firstOverThresholdIdx;
          tailDetected = true;
          
          const consecutiveValues = recentFrames.map(v => v.toFixed(3));
          console.log(`🎯 检测到尾帧: 连续${consecutiveFrames}帧都超过阈值 ${deviationThreshold.toFixed(3)}`);
          console.log(`  连续帧偏差值: [${consecutiveValues.join(', ')}]`);
          console.log(`  第一个超过阈值的帧索引: ${firstOverThresholdIdx} (向前查找到的真正尾帧开始点)`);
          
          // 生成并保存当前帧的变化率图，并标记为尾帧检测点
          await this.saveFrameDeviationMap(frame, avgImage, mask, frameIdx, options.outputDir, {
            isTailDetectionFrame: true,
            consecutiveFrameCount: consecutiveFrames,
            tailStartIdx: firstOverThresholdIdx
          });
          
          console.log(`✅ 尾帧检测完成，提前结束处理（已处理 ${frameIdx + 1}/${frames.length} 帧）`);
          break; // 立即结束循环
        }
      }
      
      // 如果还没检测到尾帧，正常生成变化率图
      if (!tailDetected) {
        await this.saveFrameDeviationMap(frame, avgImage, mask, frameIdx, options.outputDir);
      }
    }
    
    console.log(`成功处理 ${frameDeviations.length} 帧`);
    
    // 统计绝对变化率
    if (frameDeviations.length > 0) {
      console.log(`掩码内绝对变化率统计:`);
      console.log(`  - 绝对变化率范围: ${Math.min(...frameDeviations).toFixed(6)} - ${Math.max(...frameDeviations).toFixed(6)}`);
      console.log(`  - 平均绝对变化率: ${(frameDeviations.reduce((sum, v) => sum + v, 0) / frameDeviations.length).toFixed(6)}`);
      const mean = frameDeviations.reduce((sum, v) => sum + v, 0) / frameDeviations.length;
      const variance = frameDeviations.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / frameDeviations.length;
      console.log(`  - 标准差: ${Math.sqrt(variance).toFixed(6)}`);
    }
    

    
    console.log(`尾帧检测阈值设置:`);
    console.log(`  - 基准值(50帧平均): ${maskAbsoluteAverage.toFixed(6)} (基于前50帧掩码内绝对变化率)`);
    console.log(`  - 智能检测阈值: ${deviationThreshold.toFixed(6)} (使用智能算法计算)`);
    
    
    // 如果没有在实时检测中找到尾帧，进行最终检查（这种情况很少发生）
    if (!tailDetected && frameDeviations.length >= consecutiveFrames) {
      console.log("实时检测未找到尾帧，进行最终检查...");
      
      // 连续帧检测：找到连续10帧都超过阈值的情况，然后找到第一个超过阈值的帧
      for (let i = 0; i <= frameDeviations.length - consecutiveFrames; i++) {
        // 检查连续10帧是否都超过阈值
        let consecutiveOverThreshold = true;
        for (let j = 0; j < consecutiveFrames; j++) {
          if (frameDeviations[i + j] <= deviationThreshold) {
            consecutiveOverThreshold = false;
            break;
          }
        }
        
        if (consecutiveOverThreshold) {
          // 找到连续10帧超过阈值后，向前查找第一个超过阈值的帧
          let firstOverThresholdIdx = i;
          for (let k = i - 1; k >= 0; k--) {
            if (frameDeviations[k] > deviationThreshold) {
              firstOverThresholdIdx = k;
            } else {
              break; // 遇到不超过阈值的帧就停止
            }
          }
          
          tailStartIdx = firstOverThresholdIdx;
          tailDetected = true;
          const consecutiveValues = [];
          for (let j = 0; j < consecutiveFrames; j++) {
            consecutiveValues.push(frameDeviations[i + j].toFixed(3));
          }
          console.log(`最终检查发现尾帧: 连续${consecutiveFrames}帧都超过阈值 ${deviationThreshold.toFixed(3)}`);
          console.log(`  连续帧偏差百分比值: [${consecutiveValues.join(', ')}]`);
          console.log(`  第一个超过阈值的帧索引: ${firstOverThresholdIdx} (向前查找到的真正尾帧开始点)`);
          
          // 由于现在是每秒10帧采样，需要将检测到的帧索引转换为原始视频帧索引
          // 采样帧索引 * (原始fps / 采样fps) = 原始视频帧索引
          const samplingFps = 10; // 采样fps为10
          const frameConversionFactor = originalFps / samplingFps;
          console.log(`  帧索引转换因子: ${frameConversionFactor} (原始fps ${originalFps} / 采样fps ${samplingFps})`);
          
          break;
        }
      }
    }
    
    let hasTail = false;
    let tailStartTime = null;
    let tailStartFrame = -1;
    let confidence = 0;
    
    if (tailStartIdx !== null) {
      // 重新计算tailStartTime和tailStartFrame
      const frameInterval = originalFps / fps;
      const actualFrameIndex = startFrameInVideo + Math.floor(tailStartIdx * frameInterval);
      const frameTimestamp = actualFrameIndex / originalFps;
      
      tailStartTime = frameTimestamp;
      tailStartFrame = actualFrameIndex;
      hasTail = true;
      console.log(`检测到尾帧开始点: 第 ${tailStartFrame} 帧, 时间 ${tailStartTime.toFixed(2)}s`);
    } else {
      console.log(`未检测到连续${consecutiveFrames}帧都超过阈值的情况`);
    }
    
    // 简化返回结果，只保留核心字段
    return {
      hasTail,
      tailStartTime,
      tailStartFrame
    };
  }

  /**
   * 计算掩码区域内的平均图像 - 使用ndarray优化
   */
  computeMaskedAverageImage(frames, mask) {
    if (!frames || frames.length === 0) {
      throw new Error('Frames array is empty or undefined');
    }
    
    const { width, height } = frames[0];
    console.log(`计算 ${frames.length} 帧的平均图像 (${width}x${height})`);
    
    // 初始化累加数组
    const avgImage = new Array(width * height * 4).fill(0);
    
    // 使用ndarray进行高效累加
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const frameData = ndarray(frame.data, [height, width, 4]);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const pixelIdx = idx * 4;
          
          avgImage[pixelIdx] += frameData.get(y, x, 0);     // R
          avgImage[pixelIdx + 1] += frameData.get(y, x, 1); // G
          avgImage[pixelIdx + 2] += frameData.get(y, x, 2); // B
          avgImage[pixelIdx + 3] += frameData.get(y, x, 3); // A
        }
      }
    }
    
    // 计算平均值
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelIdx = idx * 4;
        
        avgImage[pixelIdx] = Math.round(avgImage[pixelIdx] / frames.length);
        avgImage[pixelIdx + 1] = Math.round(avgImage[pixelIdx + 1] / frames.length);
        avgImage[pixelIdx + 2] = Math.round(avgImage[pixelIdx + 2] / frames.length);
        avgImage[pixelIdx + 3] = Math.round(avgImage[pixelIdx + 3] / frames.length);
      }
    }
    
    // 转换为Uint8ClampedArray以确保与saveFrameDeviationMap方法兼容
    return new Uint8ClampedArray(avgImage);
  }

  /**
   * 转换为灰度 - 使用ndarray优化
   */
  convertToGrayscale(frame) {
    const { width, height } = frame;
    const gray = new Array(width * height);
    const frameData = ndarray(frame.data, [height, width, 4]);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const r = frameData.get(y, x, 0);
        const g = frameData.get(y, x, 1);
        const b = frameData.get(y, x, 2);
        gray[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
    
    return gray;
  }

  /**
   * 计算直方图 - 使用ndarray优化
   */
  computeHistogram(frame) {
    const { width, height } = frame;
    const histogram = new Array(256).fill(0);
    const frameData = ndarray(frame.data, [height, width, 4]);
    
    // 计算灰度直方图
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = frameData.get(y, x, 0);
        const g = frameData.get(y, x, 1);
        const b = frameData.get(y, x, 2);
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        histogram[gray]++;
      }
    }
    
    // 归一化
    const totalPixels = width * height;
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] /= totalPixels;
    }
    
    return histogram;
  }

  /**
   * 计算帧与平均图在掩码区域内的绝对变化率
   * 使用统一的图像差异计算工具
   */
  computeAbsoluteChangeRate(frame, avgImage, mask) {
    return ImageDiffUtils.computeAbsoluteChangeRate(frame, avgImage, mask);
  }

  /**
   * 简化阈值计算 - 固定使用3.5倍平均值
   * @param {number} baselineValue - 基准值（平均绝对变化率）
   * @param {Object} stabilityMask - 稳定性掩码信息（保留参数兼容性）
   * @returns {number} 计算出的阈值
   */
  computeSmartThreshold(baselineValue, stabilityMask) {
    // 固定使用3.5倍平均值作为阈值
    const multiplier = 3.5;
    const finalThreshold = baselineValue * multiplier;
    
    console.log(`阈值计算:`);
    console.log(`  - 基准值: ${baselineValue.toFixed(6)}`);
    console.log(`  - 固定倍数: ${multiplier}`);
    console.log(`  - 最终阈值: ${finalThreshold.toFixed(6)}`);
    
    return finalThreshold;
  }

  /**
   * 保存帧变化率图
   * @param {Object} frame - 当前帧
   * @param {Uint8ClampedArray} avgImage - 平均图像
   * @param {Float32Array} mask - 稳定性掩码
   * @param {number} frameIdx - 帧索引
   * @param {string} outputDir - 输出目录
   */
  async saveFrameDeviationMap(frame, avgImage, mask, frameIdx, outputDir, tailDetectionInfo = null) {
    if (!outputDir) return;
    
    const { width, height } = frame;
    
    // 使用统一的工具方法计算所有掩码区域内像素的变化率
    const deviationValues = ImageDiffUtils.diffImage(frame, avgImage, mask, {
      ignoreAlpha: true,
      normalize: true,
      returnAverage: false
    });
    
    const totalAbsoluteDiff = deviationValues.reduce((sum, val) => sum + val, 0);
    const maskPixelCount = deviationValues.length;
    
    // 计算统计信息
    const meanDeviation = maskPixelCount > 0 ? totalAbsoluteDiff / maskPixelCount : 0;
    const maxDeviation = deviationValues.length > 0 ? Math.max(...deviationValues) : 0.001;
    const minDeviation = deviationValues.length > 0 ? Math.min(...deviationValues) : 0;
    
    // 计算标准差
    let stdDeviation = 0;
    if (deviationValues.length > 1) {
      const variance = deviationValues.reduce((sum, val) => sum + Math.pow(val - meanDeviation, 2), 0) / deviationValues.length;
      stdDeviation = Math.sqrt(variance);
    }
    
    // 创建三栏布局的组合图像：左边平均图，中间变化率图，右边当前帧
    const combinedWidth = width * 3;
    const combinedHeight = height;
    const combinedImageData = new Uint8ClampedArray(combinedWidth * combinedHeight * 4);
    
    // 填充组合图像 - 使用统一的坐标系统确保像素对齐
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const originalIdx = y * width + x;
        const originalPixelIdx = originalIdx * 4;
        
        // 左栏：平均图
        const leftIdx = y * combinedWidth + x;
        const leftPixelIdx = leftIdx * 4;
        combinedImageData[leftPixelIdx] = avgImage[originalPixelIdx];
        combinedImageData[leftPixelIdx + 1] = avgImage[originalPixelIdx + 1];
        combinedImageData[leftPixelIdx + 2] = avgImage[originalPixelIdx + 2];
        combinedImageData[leftPixelIdx + 3] = 255;
        
        // 中栏：变化率图
        const middleIdx = y * combinedWidth + (x + width);
        const middlePixelIdx = middleIdx * 4;
        
        if (mask[originalIdx] === 1) {
          // 在掩码区域内，使用工具类计算单像素变化率
          let accDiff = 0;
          for (let i = 0; i < 3; i++) {
            accDiff += Math.abs(frame.data[originalPixelIdx + i] - avgImage[originalPixelIdx + i]);
          }
          const absoluteDiff = accDiff / (256.0 * 3); // 归一化到RGB三通道
          
          // 使用更好的归一化方法：基于统计分布而非简单的最大值
          // 将变化率映射到0-1范围，使用平均值+2*标准差作为上限
          // 确保upperBound至少为0.001以避免除零错误
          const upperBound = Math.max(0.001, Math.max(maxDeviation, meanDeviation + 2 * stdDeviation));
          const normalizedValue = Math.min(absoluteDiff / upperBound, 1.0);
          
          // 使用改进的热力图颜色：绿色(低) -> 黄色(中) -> 红色(高)
          let r, g, b;
          if (normalizedValue < 0.5) {
            // 绿色到黄色 (0-0.5)
            const t = normalizedValue * 2; // 0-1
            r = Math.floor(255 * t);
            g = 255;
            b = 0;
          } else {
            // 黄色到红色 (0.5-1.0)
            const t = (normalizedValue - 0.5) * 2; // 0-1
            r = 255;
            g = Math.floor(255 * (1 - t));
            b = 0;
          }
          
          combinedImageData[middlePixelIdx] = r;
          combinedImageData[middlePixelIdx + 1] = g;
          combinedImageData[middlePixelIdx + 2] = b;
          combinedImageData[middlePixelIdx + 3] = 255;
        } else {
          // 掩码外区域显示为深灰色
          combinedImageData[middlePixelIdx] = 64;
          combinedImageData[middlePixelIdx + 1] = 64;
          combinedImageData[middlePixelIdx + 2] = 64;
          combinedImageData[middlePixelIdx + 3] = 255;
        }
        
        // 右栏：当前帧
        const rightIdx = y * combinedWidth + (x + width * 2);
        const rightPixelIdx = rightIdx * 4;
        combinedImageData[rightPixelIdx] = frame.data[originalPixelIdx];
        combinedImageData[rightPixelIdx + 1] = frame.data[originalPixelIdx + 1];
        combinedImageData[rightPixelIdx + 2] = frame.data[originalPixelIdx + 2];
        combinedImageData[rightPixelIdx + 3] = 255;
      }
    }
    
    try {
      // 使用Jimp保存组合图像
      const image = new Jimp({ data: combinedImageData, width: combinedWidth, height: combinedHeight });
      
      // 如果这是尾帧检测点，添加特殊标记
      if (tailDetectionInfo && tailDetectionInfo.isTailDetectionFrame) {
        // 在图像顶部添加红色标记条
        const markerHeight = 20;
        const markerColor = 0xFF0000FF; // 红色
        
        // 绘制顶部红色标记条
        for (let y = 0; y < markerHeight; y++) {
          for (let x = 0; x < combinedWidth; x++) {
            image.setPixelColor(markerColor, x, y);
          }
        }
        
        // 在标记条上添加文字信息（使用白色像素简单绘制）
        const textColor = 0xFFFFFFFF; // 白色
        const textY = 5;
        
        // 简单的文字标记：在左侧写"TAIL DETECTED"
        const textMessage = `🎯 TAIL DETECTED - Frame ${frameIdx} (Consecutive ${tailDetectionInfo.consecutiveFrameCount})`;
        
        // 在图像底部添加文字信息（简化版本，使用像素绘制）
        const bottomTextY = height - 15;
        for (let x = 10; x < Math.min(combinedWidth - 10, textMessage.length * 8); x += 8) {
          for (let dy = 0; dy < 10; dy++) {
            image.setPixelColor(textColor, x, bottomTextY + dy);
          }
        }
        
        // 在中间栏（变化率图）的四周添加红色边框
        const borderWidth = 3;
        const borderColor = 0xFF0000FF;
        
        // 绘制中间栏的红色边框
        for (let y = 0; y < height; y++) {
          for (let x = width; x < width * 2; x++) {
            // 左边框
            if (x < width + borderWidth) {
              image.setPixelColor(borderColor, x, y);
            }
            // 右边框
            if (x >= width * 2 - borderWidth) {
              image.setPixelColor(borderColor, x, y);
            }
          }
        }
        
        // 绘制中间栏的上下边框
        for (let x = width; x < width * 2; x++) {
          // 上边框
          for (let y = 0; y < borderWidth; y++) {
            image.setPixelColor(borderColor, x, y);
          }
          // 下边框
          for (let y = height - borderWidth; y < height; y++) {
            image.setPixelColor(borderColor, x, y);
          }
        }
      }
      
      // 确定输出文件名，如果是尾帧检测点则添加特殊标记
      const filePrefix = tailDetectionInfo && tailDetectionInfo.isTailDetectionFrame ? 'TAIL_DETECTED_frame_deviation' : 'frame_deviation';
      const outputPath = `${outputDir}/${filePrefix}_${frameIdx.toString().padStart(5, '0')}.png`;
      // await image.writeAsync(outputPath);
      
      if (tailDetectionInfo && tailDetectionInfo.isTailDetectionFrame) {
        console.log(`🎯 保存尾帧检测标记图: ${outputPath}`);
        console.log(`  检测信息: 连续${tailDetectionInfo.consecutiveFrameCount}帧超过阈值`);
        console.log(`  尾帧开始索引: ${tailDetectionInfo.tailStartIdx}`);
      } else if (frameIdx % 30 === 0) { // 每30帧输出一次日志
        console.log(`保存三栏变化率图: ${outputPath}`);
      }
      
      if (frameIdx % 30 === 0 || (tailDetectionInfo && tailDetectionInfo.isTailDetectionFrame)) {
        console.log(`  掩码内像素统计 (${maskPixelCount} 像素):`);
        console.log(`    平均绝对变化率: ${meanDeviation.toFixed(6)}`);
        console.log(`    最大绝对变化率: ${maxDeviation.toFixed(6)}`);
        console.log(`    最小绝对变化率: ${minDeviation.toFixed(6)}`);
        console.log(`    标准差: ${stdDeviation.toFixed(6)}`);
        console.log(`    归一化上限: ${Math.max(maxDeviation, meanDeviation + 2 * stdDeviation).toFixed(6)}`);
      }
    } catch (error) {
      console.error(`保存三栏变化率图失败 (帧${frameIdx}):`, error.message);
    }
  }

  /**
   * 计算帧间相似度
   * @param {Array} frames - 帧数据数组
   * @param {Object} options - 计算选项
   * @returns {Promise<Array>} 相似度数组
   */
  async computeFrameSimilarities(frames, options = {}) {
    const {
      useStructuralSimilarity = true,
      useHistogramComparison = true,
      useEdgeDetection = false
    } = options;

    const similarities = [];
    
    for (let i = 0; i < frames.length - 1; i++) {
      const frame1 = frames[i];
      const frame2 = frames[i + 1];
      
      let similarity = 0;
      let methodCount = 0;

      // 结构相似性
      if (useStructuralSimilarity) {
        similarity += this.computeStructuralSimilarity(frame1, frame2);
        methodCount++;
      }

      // 直方图比较
      if (useHistogramComparison) {
        similarity += this.computeHistogramSimilarity(frame1, frame2);
        methodCount++;
      }

      // 边缘检测比较
      if (useEdgeDetection) {
        similarity += this.computeEdgeSimilarity(frame1, frame2);
        methodCount++;
      }

      // 平均相似度
      if (methodCount > 0) {
        similarity /= methodCount;
      }

      similarities.push(similarity);

      if ((i + 1) % 50 === 0) {
        console.log(`Computed similarity for ${i + 1}/${frames.length - 1} frame pairs`);
      }
    }

    return similarities;
  }

  /**
   * 计算结构相似性
   * @param {Object} frame1 - 第一帧
   * @param {Object} frame2 - 第二帧
   * @returns {number} 结构相似性值
   */
  computeStructuralSimilarity(frame1, frame2) {
    // 使用统一的工具类计算结构相似性
    const result = ImageDiffUtils.computeStructuralDifference(frame1, frame2);
    return result.similarity;
  }



  /**
   * 计算方差
   * @param {Array} image - 图像数据
   * @param {number} mean - 均值
   * @returns {number} 方差
   */
  computeVariance(image, mean) {
    let variance = 0;
    for (let i = 0; i < image.length; i++) {
      const diff = image[i] - mean;
      variance += diff * diff;
    }
    return variance / image.length;
  }

  /**
   * 计算协方差
   * @param {Array} image1 - 第一个图像
   * @param {Array} image2 - 第二个图像
   * @param {number} mean1 - 第一个图像的均值
   * @param {number} mean2 - 第二个图像的均值
   * @returns {number} 协方差
   */
  computeCovariance(image1, image2, mean1, mean2) {
    let covariance = 0;
    for (let i = 0; i < image1.length; i++) {
      covariance += (image1[i] - mean1) * (image2[i] - mean2);
    }
    return covariance / image1.length;
  }

  /**
   * 计算直方图相似性
   * @param {Object} frame1 - 第一帧
   * @param {Object} frame2 - 第二帧
   * @returns {number} 直方图相似性
   */
  computeHistogramSimilarity(frame1, frame2) {
    const hist1 = this.computeHistogram(frame1);
    const hist2 = this.computeHistogram(frame2);
    
    // 使用巴氏距离计算相似性
    let bhattacharyya = 0;
    for (let i = 0; i < hist1.length; i++) {
      bhattacharyya += Math.sqrt(hist1[i] * hist2[i]);
    }
    
    return bhattacharyya;
  }

  /**
   * 计算直方图
   * @param {Object} frame - 帧数据
   * @returns {Array} 直方图
   */


  /**
   * 计算边缘相似性
   * @param {Object} frame1 - 第一帧
   * @param {Object} frame2 - 第二帧
   * @returns {number} 边缘相似性
   */
  computeEdgeSimilarity(frame1, frame2) {
    const edges1 = this.detectEdges(frame1);
    const edges2 = this.detectEdges(frame2);
    
    // 计算边缘图像的相关性
    let correlation = 0;
    for (let i = 0; i < edges1.length; i++) {
      correlation += edges1[i] * edges2[i];
    }
    
    return correlation / edges1.length;
  }

  /**
   * 简单的边缘检测（Sobel算子）
   * @param {Object} frame - 帧数据
   * @returns {Array} 边缘强度数组
   */
  detectEdges(frame) {
    const { width, height } = frame;
    const gray = this.convertToGrayscale(frame);
    const edges = new Array(width * height).fill(0);
    
    // Sobel算子
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += gray[idx] * sobelX[kernelIdx];
            gy += gray[idx] * sobelY[kernelIdx];
          }
        }
        
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return edges;
  }

  /**
   * 检测稳定区域
   * @param {Array} similarities - 相似度数组
   * @param {number} windowSize - 窗口大小
   * @param {number} threshold - 阈值
   * @returns {Array} 稳定区域数组
   */
  detectStableRegions(similarities, windowSize, threshold) {
    const regions = [];
    
    for (let i = 0; i <= similarities.length - windowSize; i++) {
      const window = similarities.slice(i, i + windowSize);
      const avgSimilarity = MathUtils.mean(window);
      const minSimilarity = Math.min(...window);
      
      if (avgSimilarity >= threshold && minSimilarity >= threshold * 0.8) {
        regions.push({
          startIndex: i,
          endIndex: i + windowSize - 1,
          length: windowSize,
          avgSimilarity: avgSimilarity,
          minSimilarity: minSimilarity,
          stability: avgSimilarity * (1 - MathUtils.std(window))
        });
      }
    }
    
    // 合并重叠区域
    return this.mergeOverlappingRegions(regions);
  }

  /**
   * 合并重叠区域
   * @param {Array} regions - 区域数组
   * @returns {Array} 合并后的区域数组
   */
  mergeOverlappingRegions(regions) {
    if (regions.length === 0) return [];
    
    // 按起始索引排序
    regions.sort((a, b) => a.startIndex - b.startIndex);
    
    const merged = [regions[0]];
    
    for (let i = 1; i < regions.length; i++) {
      const current = regions[i];
      const last = merged[merged.length - 1];
      
      // 检查是否重叠
      if (current.startIndex <= last.endIndex + 1) {
        // 合并区域
        last.endIndex = Math.max(last.endIndex, current.endIndex);
        last.length = last.endIndex - last.startIndex + 1;
        last.avgSimilarity = (last.avgSimilarity + current.avgSimilarity) / 2;
        last.minSimilarity = Math.min(last.minSimilarity, current.minSimilarity);
        last.stability = (last.stability + current.stability) / 2;
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }

  /**
   * 分析尾帧候选
   * @param {Array} stableRegions - 稳定区域数组
   * @param {Array} similarities - 相似度数组
   * @param {number} minTailLength - 最小尾帧长度
   * @returns {Object} 尾帧分析结果
   */
  analyzeTailCandidate(stableRegions, similarities, minTailLength) {
    if (stableRegions.length === 0) {
      return {
        index: -1,
        confidence: 0,
        reason: 'No stable regions found'
      };
    }
    
    // 过滤长度足够的区域
    const validRegions = stableRegions.filter(region => region.length >= minTailLength);
    
    if (validRegions.length === 0) {
      return {
        index: -1,
        confidence: 0,
        reason: 'No regions meet minimum tail length requirement'
      };
    }
    
    // 选择最后的稳定区域作为尾帧候选
    const tailRegion = validRegions[validRegions.length - 1];
    
    // 计算置信度
    const confidence = this.computeTailConfidence(tailRegion, similarities, validRegions);
    
    return {
      index: tailRegion.startIndex,
      confidence: confidence,
      region: tailRegion,
      reason: 'Tail frame detected based on stability analysis'
    };
  }

  /**
   * 计算尾帧置信度
   * @param {Object} tailRegion - 尾帧区域
   * @param {Array} similarities - 相似度数组
   * @param {Array} allRegions - 所有区域
   * @returns {number} 置信度
   */
  computeTailConfidence(tailRegion, similarities, allRegions) {
    let confidence = 0;
    
    // 基于稳定性的置信度
    const stabilityScore = tailRegion.stability;
    confidence += stabilityScore * 0.4;
    
    // 基于位置的置信度（越靠后越可能是尾帧）
    const positionScore = tailRegion.startIndex / similarities.length;
    confidence += positionScore * 0.3;
    
    // 基于长度的置信度
    const maxLength = Math.max(...allRegions.map(r => r.length));
    const lengthScore = tailRegion.length / maxLength;
    confidence += lengthScore * 0.2;
    
    // 基于相对稳定性的置信度
    const avgStability = MathUtils.mean(allRegions.map(r => r.stability));
    const relativeStability = tailRegion.stability / avgStability;
    confidence += Math.min(relativeStability, 1.0) * 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 生成检测曲线
   * @param {Array} similarities - 相似度数组
   * @param {Array} stableRegions - 稳定区域数组
   * @param {Object} tailResult - 尾帧结果
   * @returns {Object} 检测曲线数据
   */
  generateDetectionCurve(similarities, stableRegions, tailResult) {
    const curve = {
      frameIndices: [],
      similarities: similarities,
      stableRegionMask: new Array(similarities.length).fill(0),
      tailFrameMask: new Array(similarities.length).fill(0),
      smoothedSimilarities: []
    };
    
    // 生成帧索引
    for (let i = 0; i < similarities.length; i++) {
      curve.frameIndices.push(i);
    }
    
    // 标记稳定区域
    for (const region of stableRegions) {
      for (let i = region.startIndex; i <= region.endIndex; i++) {
        if (i < curve.stableRegionMask.length) {
          curve.stableRegionMask[i] = 1;
        }
      }
    }
    
    // 标记尾帧
    if (tailResult.index >= 0 && tailResult.region) {
      for (let i = tailResult.region.startIndex; i <= tailResult.region.endIndex; i++) {
        if (i < curve.tailFrameMask.length) {
          curve.tailFrameMask[i] = 1;
        }
      }
    }
    
    // 平滑相似度曲线
    const windowSize = 5;
    for (let i = 0; i < similarities.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(similarities.length, i + Math.floor(windowSize / 2) + 1);
      const window = similarities.slice(start, end);
      curve.smoothedSimilarities.push(MathUtils.mean(window));
    }
    
    return curve;
  }

  /**
   * 计算检测统计信息
   * @param {Array} similarities - 相似度数组
   * @param {Object} tailResult - 尾帧结果
   * @returns {Object} 统计信息
   */
  computeDetectionStats(similarities, tailResult) {
    const stats = {
      totalFrames: similarities.length + 1,
      avgSimilarity: MathUtils.mean(similarities),
      minSimilarity: Math.min(...similarities),
      maxSimilarity: Math.max(...similarities),
      stdSimilarity: MathUtils.std(similarities),
      tailDetected: tailResult.index >= 0,
      tailFrameIndex: tailResult.index,
      tailConfidence: tailResult.confidence
    };
    
    if (tailResult.index >= 0) {
      stats.tailFrameRatio = tailResult.index / similarities.length;
      stats.tailRegionLength = tailResult.region ? tailResult.region.length : 0;
    }
    
    return stats;
  }

  /**
   * 提取尾帧条带
   * @param {Array} frames - 帧数组
   * @param {number} tailIndex - 尾帧索引
   * @param {number} stripCount - 条带数量
   * @returns {Promise<Jimp>} 尾帧条带图像
   */
  async extractTailFramesStrip(frames, tailIndex, stripCount = 10) {
    if (tailIndex < 0 || tailIndex >= frames.length) {
      throw new Error('Invalid tail frame index');
    }
    
    const startIndex = Math.max(0, tailIndex - Math.floor(stripCount / 2));
    const endIndex = Math.min(frames.length - 1, startIndex + stripCount - 1);
    const actualCount = endIndex - startIndex + 1;
    
    const frameWidth = frames[0].width;
    const frameHeight = frames[0].height;
    const stripWidth = frameWidth * actualCount;
    
    // 创建条带图像
    const stripImage = new Jimp(stripWidth, frameHeight);
    
    for (let i = 0; i < actualCount; i++) {
      const frameIndex = startIndex + i;
      const frame = frames[frameIndex];
      const x = i * frameWidth;
      
      // 复制帧到条带
      for (let y = 0; y < frameHeight; y++) {
        for (let fx = 0; fx < frameWidth; fx++) {
          const pixelIdx = (y * frameWidth + fx) * 4;
          const color = Jimp.rgbaToInt(
            frame.data[pixelIdx],
            frame.data[pixelIdx + 1],
            frame.data[pixelIdx + 2],
            frame.data[pixelIdx + 3]
          );
          stripImage.setPixelColor(color, x + fx, y);
        }
      }
    }
    
    return stripImage;
  }
}

module.exports = TailDetector;