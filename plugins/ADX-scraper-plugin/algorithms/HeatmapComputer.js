/**
 * HeatmapComputer - 热力图计算类
 * 严格对应Python版本的compute_stability_heatmap算法
 * 使用严格阈值+扩散的稳定区域检测算法
 */

const ndarray = require('ndarray');

class HeatmapComputer {
    constructor() {
        // 算法参数
        this.maskAbsoluteAverage = 0.0; // 掩码内绝对变化率平均值(X)，用于尾帧检测
    }

    /**
     * 计算稳定性热力图 - 严格对应Python版本
     * 1. 计算正片帧（10%-80%）每个点的绝对变化率（绝对偏差/256）
     * 2. 使用严格阈值找到真正稳定的核心区域（如不变的文字）
     * 3. 对核心稳定区域进行扩散/膨胀操作，扩展到周边相对稳定的区域
     * 4. 记录掩码内所有点绝对变化率的平均值（X），用于后续尾帧检测
     * @param {Array} frames - 帧数据数组
     * @param {Object} contentArea - 播放区域信息，如果提供则只在该区域内计算
     * @returns {Object} 热力图计算结果
     */
    async computeStabilityHeatmap(frames, mask, options = {}) {
        console.log('计算稳定性热力图...');
        
        const { width, height } = frames[0];
        const totalPixels = width * height;
        const numFrames = frames.length;
        
        console.log(`  - 帧数: ${numFrames}`);
        console.log(`  - 图像尺寸: ${width}x${height}`);
        console.log(`  - 总像素数: ${totalPixels}`);
        
        // 1. 将所有帧转换为灰度图
        console.log('  - 转换帧为灰度图...');
        const grayFrames = [];
        
        for (let i = 0; i < numFrames; i++) {
            const grayData = this.convertToGrayscale(frames[i]);
            grayFrames.push(ndarray(grayData, [height, width]));
        }
        
        // 2. 计算像素平均值
        console.log('  - 计算像素平均值...');
        const pixelMeans = new Float64Array(totalPixels);
        
        for (let i = 0; i < totalPixels; i++) {
            let sum = 0;
            for (let j = 0; j < numFrames; j++) {
                const h = Math.floor(i / width);
                const w = i % width;
                sum += grayFrames[j].get(h, w);
            }
            pixelMeans[i] = sum / numFrames;
        }
        
        // 3. 计算绝对变化率 (MAD)
        console.log('  - 计算绝对变化率...');
        const madAbsoluteMap = new Float64Array(totalPixels);
        
        for (let i = 0; i < totalPixels; i++) {
            let sum = 0;
            for (let j = 0; j < numFrames; j++) {
                const h = Math.floor(i / width);
                const w = i % width;
                sum += Math.abs(grayFrames[j].get(h, w) - pixelMeans[i]) / 256.0; // 添加归一化
            }
            madAbsoluteMap[i] = sum / numFrames;
        }
        
        // 3. 第一步：使用严格阈值找到核心稳定区域
            console.log('=== 第一步：使用严格阈值找到核心稳定区域 ===');
            const nonZeroIndices = [];
            const nonZeroValues = [];
            
            for (let i = 0; i < totalPixels; i++) {
                if (madAbsoluteMap[i] > 0) {
                    nonZeroIndices.push(i);
                    nonZeroValues.push(madAbsoluteMap[i]);
                }
            }
            
            let coreMask = new Float32Array(totalPixels);
            let finalStrictThreshold = 0.0; // 初始化变量
            
            if (nonZeroValues.length === 0) {
                // 如果所有值都是0，创建中心区域掩码
                console.log('警告: 所有绝对变化率都为0，使用中心区域作为核心稳定区域');
                const centerH = Math.floor(height / 2);
                const centerW = Math.floor(width / 2);
                for (let h = Math.max(0, centerH - 10); h < Math.min(height, centerH + 10); h++) {
                    for (let w = Math.max(0, centerW - 10); w < Math.min(width, centerW + 10); w++) {
                        coreMask[h * width + w] = 1.0;
                    }
                }
                finalStrictThreshold = 0.0; // 设置默认值
            } else {
                // 计算统计特征
                const meanDeviation = this.mean(nonZeroValues);
                const stdDeviation = this.std(nonZeroValues, meanDeviation);
                
                // 对数组进行排序以计算分位数（与Python的np.percentile行为一致）
                const sortedNonZeroValues = [...nonZeroValues].sort((a, b) => a - b);
                const q1 = this.percentile(sortedNonZeroValues, 1);
                const q2 = this.percentile(sortedNonZeroValues, 2);
                const q3 = this.percentile(sortedNonZeroValues, 3);
                const q5 = this.percentile(sortedNonZeroValues, 5);
                
                console.log('绝对变化率统计分析:');
                console.log(`  - 均值: ${meanDeviation.toFixed(6)}`);
                console.log(`  - 标准差: ${stdDeviation.toFixed(6)}`);
                console.log(`  - 1%分位数: ${q1.toFixed(6)}`);
                console.log(`  - 2%分位数: ${q2.toFixed(6)}`);
                console.log(`  - 3%分位数: ${q3.toFixed(6)}`);
                console.log(`  - 5%分位数: ${q5.toFixed(6)}`);
                
                // 使用严格阈值策略找到核心稳定区域
                const cv = meanDeviation > 0 ? stdDeviation / meanDeviation : 1.0;
                let strictThreshold, strategy;
                
                if (cv < 0.2) {
                    strictThreshold = q1;
                    strategy = "极集中分布-1%分位数";
                } else if (cv < 0.4) {
                    strictThreshold = q2;
                    strategy = "集中分布-2%分位数";
                } else if (cv < 0.6) {
                    strictThreshold = q3;
                    strategy = "中等分布-3%分位数";
                } else {
                    strictThreshold = q5;
                    strategy = "分散分布-5%分位数";
                }
                
                // 确保至少选择0.5%的像素作为核心区域
                const minCorePixels = Math.max(1, Math.floor(nonZeroValues.length * 0.005));
                const sortedValues = [...nonZeroValues].sort((a, b) => a - b);
                const minThreshold = sortedValues[Math.min(minCorePixels - 1, sortedValues.length - 1)];
                
                finalStrictThreshold = Math.max(strictThreshold, minThreshold);
                
                // 应用严格阈值选择核心稳定像素
                const coreSelectedIndices = [];
                for (let i = 0; i < nonZeroValues.length; i++) {
                    if (nonZeroValues[i] <= finalStrictThreshold) {
                        coreSelectedIndices.push(nonZeroIndices[i]);
                    }
                }
                
                const corePercentage = (coreSelectedIndices.length / nonZeroValues.length) * 100;
                
                console.log('严格阈值核心区域选择:');
                console.log(`  - 使用策略: ${strategy}`);
                console.log(`  - 变异系数: ${cv.toFixed(3)}`);
                console.log(`  - 严格阈值: ${finalStrictThreshold.toFixed(6)}`);
                console.log(`  - 核心像素数: ${coreSelectedIndices.length} / ${nonZeroValues.length} (${corePercentage.toFixed(2)}%)`);
                
                // 创建核心稳定区域掩码
                for (const idx of coreSelectedIndices) {
                    coreMask[idx] = 1.0;
                }
            }
            
            // 4. 直接使用核心稳定区域掩码，不进行扩散操作
            console.log('=== 跳过扩散操作，直接使用核心稳定区域 ===');
            const finalMask = coreMask;
            
            // 5. 计算掩码内所有点绝对变化率的平均值（X）
            let maskAbsoluteSum = 0;
            let maskPixelCount = 0;
            
            for (let i = 0; i < totalPixels; i++) {
                if (finalMask[i] === 1) {
                    maskAbsoluteSum += madAbsoluteMap[i];
                    maskPixelCount++;
                }
            }
            
            this.maskAbsoluteAverage = maskPixelCount > 0 ? maskAbsoluteSum / maskPixelCount : 0.0;
            
            const finalPixels = maskPixelCount;
            const finalPercentage = (finalPixels / totalPixels) * 100;
            
            console.log('严格阈值+扩散稳定性掩码计算完成:');
            
            // 安全地计算最小值和最大值，避免栈溢出
            let minValue = madAbsoluteMap[0];
            let maxValue = madAbsoluteMap[0];
            for (let i = 1; i < madAbsoluteMap.length; i++) {
                if (madAbsoluteMap[i] < minValue) minValue = madAbsoluteMap[i];
                if (madAbsoluteMap[i] > maxValue) maxValue = madAbsoluteMap[i];
            }
            
            console.log(`  - 绝对变化率范围: ${minValue.toFixed(6)} - ${maxValue.toFixed(6)}`);
            console.log(`  - 掩码内绝对变化率平均值(X): ${this.maskAbsoluteAverage.toFixed(6)}`);
            console.log(`  - 最终覆盖率: ${finalPercentage.toFixed(3)}%`);
            
            return {
                heatmap: finalMask,
                stabilityMask: finalMask,
                averageImage: pixelMeans,
                madMap: madAbsoluteMap,
                maskAbsoluteAverage: this.maskAbsoluteAverage,
                stats: {
                    stablePixels: finalPixels,
                    totalPixels: totalPixels,
                    stabilityRatio: finalPercentage / 100
                }
            };
        }


        


        /**
         * 计算数组均值
         */
        mean(arr) {
            return arr.reduce((sum, val) => sum + val, 0) / arr.length;
        }

        /**
         * 计算数组标准差
         */
        std(arr, mean = null) {
            if (mean === null) mean = this.mean(arr);
            const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
            return Math.sqrt(variance);
        }

        /**
         * 计算百分位数
         */
        percentile(sortedArray, p) {
            if (sortedArray.length === 0) return 0;
            if (sortedArray.length === 1) return sortedArray[0];
            
            const index = (p / 100) * (sortedArray.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            
            if (lower === upper) {
                return sortedArray[lower];
            }
            
            const weight = index - lower;
            return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
        }

        /**
         * 转换帧为灰度图
         */
        convertToGrayscale(frame) {
            const { width, height, data } = frame;
            const totalPixels = width * height;
            const grayData = new Float64Array(totalPixels);
            
            for (let i = 0; i < totalPixels; i++) {
                const pixelIndex = i * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                // 使用标准灰度转换公式
                grayData[i] = 0.299 * r + 0.587 * g + 0.114 * b;
            }
            
            return grayData;
        }

        /**
         * 在指定区域内转换为灰度图
         * @param {Object} frame - 帧数据
         * @param {Object} area - 处理区域 {top, bottom, left, right}
         * @returns {Float64Array} 灰度数据
         */
        convertToGrayscaleInArea(frame, area) {
            const { width, data } = frame;
            const processWidth = area.right - area.left;
            const processHeight = area.bottom - area.top;
            const grayData = new Float64Array(processWidth * processHeight);
            
            let outputIndex = 0;
            for (let h = area.top; h < area.bottom; h++) {
                for (let w = area.left; w < area.right; w++) {
                    const pixelIndex = (h * width + w) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];
                    // 使用标准灰度转换公式
                    grayData[outputIndex] = 0.299 * r + 0.587 * g + 0.114 * b;
                    outputIndex++;
                }
            }
            
            return grayData;
        }


}

module.exports = HeatmapComputer;