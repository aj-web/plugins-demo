/**
 * 图像差异计算工具类
 * 提供统一的图像比对和差异计算方法
 */
class ImageDiffUtils {
  /**
   * 计算两个图像之间的绝对差异
   * @param {Object} frame1 - 第一个图像帧 (包含 data, width, height)
   * @param {Object|Uint8ClampedArray} frame2 - 第二个图像帧或图像数据
   * @param {Float32Array|null} mask - 可选的掩码，如果提供则只计算掩码区域内的差异
   * @param {Object} options - 选项
   * @param {boolean} options.ignoreAlpha - 是否忽略alpha通道，默认true
   * @param {boolean} options.normalize - 是否归一化到[0,1]范围，默认true
   * @param {boolean} options.returnAverage - 是否返回平均值，默认true
   * @returns {number|Array} 返回平均绝对差异值或所有像素的差异值数组
   */
  static diffImage(frame1, frame2, mask = null, options = {}) {
    const {
      ignoreAlpha = true,
      normalize = true,
      returnAverage = true
    } = options;

    const { width, height } = frame1;
    const frame1Data = frame1.data;
    const frame2Data = frame2.data || frame2;

    let totalDiff = 0;
    let pixelCount = 0;
    const diffValues = returnAverage ? null : [];

    // 确定通道数量
    const channelCount = ignoreAlpha ? 3 : 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        const maskIdx = y * width + x;

        // 检查是否在掩码区域内
        if (mask && mask[maskIdx] <= 0) {
          continue;
        }

        let accDiff = 0;
        
        // 计算RGB通道的绝对差异
        for (let i = 0; i < channelCount; i++) {
          accDiff += Math.abs(frame1Data[pixelIdx + i] - frame2Data[pixelIdx + i]);
        }

        // 归一化处理
        let pixelDiff = normalize ? accDiff / (256.0 * channelCount) : accDiff;

        if (returnAverage) {
          totalDiff += pixelDiff;
          pixelCount++;
        } else {
          diffValues.push(pixelDiff);
        }
      }
    }

    return returnAverage ? (pixelCount > 0 ? totalDiff / pixelCount : 0) : diffValues;
  }

  /**
   * 计算图像与平均图像的绝对变化率（用于尾帧检测）
   * @param {Object} frame - 当前帧
   * @param {Uint8ClampedArray} avgImage - 平均图像数据
   * @param {Float32Array} mask - 稳定性掩码
   * @returns {number} 平均绝对变化率
   */
  static computeAbsoluteChangeRate(frame, avgImage, mask) {
    return this.diffImage(frame, avgImage, mask, {
      ignoreAlpha: true,
      normalize: true,
      returnAverage: true
    });
  }

  /**
   * 计算两个图像的结构相似性差异
   * @param {Object} frame1 - 第一个图像帧
   * @param {Object} frame2 - 第二个图像帧
   * @param {Float32Array|null} mask - 可选掩码
   * @returns {Object} 包含均值、方差、协方差等统计信息
   */
  static computeStructuralDifference(frame1, frame2, mask = null) {
    const { width, height } = frame1;
    const frame1Data = frame1.data;
    const frame2Data = frame2.data;

    let sum1 = 0, sum2 = 0;
    let sumSq1 = 0, sumSq2 = 0;
    let sumProduct = 0;
    let pixelCount = 0;

    // 计算均值
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        const maskIdx = y * width + x;

        if (mask && mask[maskIdx] <= 0) {
          continue;
        }

        // 转换为灰度值
        const gray1 = (frame1Data[pixelIdx] + frame1Data[pixelIdx + 1] + frame1Data[pixelIdx + 2]) / 3;
        const gray2 = (frame2Data[pixelIdx] + frame2Data[pixelIdx + 1] + frame2Data[pixelIdx + 2]) / 3;

        sum1 += gray1;
        sum2 += gray2;
        sumSq1 += gray1 * gray1;
        sumSq2 += gray2 * gray2;
        sumProduct += gray1 * gray2;
        pixelCount++;
      }
    }

    if (pixelCount === 0) {
      return { mean1: 0, mean2: 0, variance1: 0, variance2: 0, covariance: 0, similarity: 0 };
    }

    const mean1 = sum1 / pixelCount;
    const mean2 = sum2 / pixelCount;
    const variance1 = (sumSq1 / pixelCount) - (mean1 * mean1);
    const variance2 = (sumSq2 / pixelCount) - (mean2 * mean2);
    const covariance = (sumProduct / pixelCount) - (mean1 * mean2);

    // 计算结构相似性指数 (SSIM)
    const c1 = 6.5025; // (0.01 * 255)^2
    const c2 = 58.5225; // (0.03 * 255)^2
    
    const numerator = (2 * mean1 * mean2 + c1) * (2 * covariance + c2);
    const denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (variance1 + variance2 + c2);
    
    const similarity = denominator > 0 ? numerator / denominator : 0;

    return {
      mean1,
      mean2,
      variance1,
      variance2,
      covariance,
      similarity
    };
  }

  /**
   * 移除图像的alpha通道
   * @param {Uint8ClampedArray} imageData - 原始图像数据
   * @param {number} width - 图像宽度
   * @param {number} height - 图像高度
   * @returns {Uint8ClampedArray} 移除alpha通道后的RGB数据
   */
  static removeAlphaChannel(imageData, width, height) {
    const rgbData = new Uint8ClampedArray(width * height * 3);
    
    for (let i = 0, j = 0; i < imageData.length; i += 4, j += 3) {
      rgbData[j] = imageData[i];     // R
      rgbData[j + 1] = imageData[i + 1]; // G
      rgbData[j + 2] = imageData[i + 2]; // B
      // 跳过alpha通道 imageData[i + 3]
    }
    
    return rgbData;
  }

  /**
   * 检查图像是否包含alpha通道
   * @param {Object} frame - 图像帧对象
   * @returns {boolean} 是否包含alpha通道
   */
  static hasAlphaChannel(frame) {
    // 检查数据长度是否符合RGBA格式
    const expectedLength = frame.width * frame.height * 4;
    return frame.data.length === expectedLength;
  }

  /**
   * 计算图像的统计信息
   * @param {Object} frame - 图像帧
   * @param {Float32Array|null} mask - 可选掩码
   * @returns {Object} 统计信息 {mean, std, min, max, pixelCount}
   */
  static computeImageStats(frame, mask = null) {
    const { width, height, data } = frame;
    let sum = 0;
    let sumSq = 0;
    let min = 255;
    let max = 0;
    let pixelCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        const maskIdx = y * width + x;

        if (mask && mask[maskIdx] <= 0) {
          continue;
        }

        // 计算灰度值
        const gray = (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;
        
        sum += gray;
        sumSq += gray * gray;
        min = Math.min(min, gray);
        max = Math.max(max, gray);
        pixelCount++;
      }
    }

    if (pixelCount === 0) {
      return { mean: 0, std: 0, min: 0, max: 0, pixelCount: 0 };
    }

    const mean = sum / pixelCount;
    const variance = (sumSq / pixelCount) - (mean * mean);
    const std = Math.sqrt(Math.max(0, variance));

    return { mean, std, min, max, pixelCount };
  }
}

module.exports = ImageDiffUtils;