/**
 * 原视频播放区域检测器
 * 基于Python版本的video_area_analyzer.py移植
 * 用于检测原视频中的真实播放区域，排除黑边和静态文字区域
 */

// const cv = require('opencv4nodejs'); // Removed opencv4nodejs dependency

class OriginalVideoAreaDetector {
    constructor() {
        this.blackThreshold = 30;  // 黑色阈值
        this.dynamicRatioThreshold = 0.2;  // 动态像素占比阈值
        this.nonBlackRatioThreshold = 0.3;  // 非黑像素占比阈值
        this.coreMotionMultiplier = 1.5;  // 核心动态区域倍数
    }

    /**
     * 检测原视频的播放区域
     * @param {Array} frames - 视频帧数组 (cv.Mat对象)
     * @param {Object} videoInfo - 视频信息 {width, height, fps, duration}
     * @returns {Object} 播放区域检测结果
     */
    async detectOriginalVideoArea(frames, videoInfo) {
        console.log('\n开始检测原视频播放区域...');
        
        if (!frames || frames.length === 0) {
            throw new Error('没有提供视频帧数据');
        }

        const { width, height } = videoInfo;
        
        // 1. 计算所有帧的平均亮度
        console.log('计算平均亮度...');
        const avgBrightness = await this.calculateAverageBrightness(frames, width, height);
        
        // 2. 计算帧间差异来检测动态区域
        console.log('分析视频动态特性...');
        const avgMotion = await this.calculateAverageMotion(frames, width, height);
        
        // 3. 计算动态阈值
        const motionThreshold = this.calculateMotionThreshold(avgMotion);
        
        console.log(`严格动态检测参数:`);
        console.log(`  动态阈值: ${motionThreshold.toFixed(1)}`);
        console.log(`  黑色阈值: ${this.blackThreshold}`);
        
        // 4. 寻找真正的动态内容边界
        const boundaries = this.findDynamicContentBoundaries(
            avgBrightness, avgMotion, motionThreshold, width, height
        );
        
        // 5. 验证和优化检测到的区域
        const optimizedBoundaries = this.validateAndOptimizeBoundaries(
            boundaries, avgBrightness, avgMotion, motionThreshold, width, height
        );
        
        // 6. 构建结果
        const contentArea = {
            x: optimizedBoundaries.left,
            y: optimizedBoundaries.top,
            width: optimizedBoundaries.right - optimizedBoundaries.left + 1,
            height: optimizedBoundaries.bottom - optimizedBoundaries.top + 1,
            x2: optimizedBoundaries.right,
            y2: optimizedBoundaries.bottom
        };
        
        // 计算播放区域占比
        const totalArea = width * height;
        const contentAreaSize = contentArea.width * contentArea.height;
        const contentRatio = contentAreaSize / totalArea;
        
        console.log(`检测到的原视频播放区域:`);
        console.log(`  位置: (${contentArea.x}, ${contentArea.y})`);
        console.log(`  尺寸: ${contentArea.width}x${contentArea.height}`);
        console.log(`  播放区域占比: ${(contentRatio * 100).toFixed(2)}%`);
        
        // 输出详细的区域分析
        if (contentRatio < 0.95) {
            const blackTop = contentArea.y;
            const blackBottom = height - 1 - contentArea.y2;
            const blackLeft = contentArea.x;
            const blackRight = width - 1 - contentArea.x2;
            console.log(`检测到的非播放区域:`);
            console.log(`  上边区域: ${blackTop}px`);
            console.log(`  下边区域: ${blackBottom}px`);
            console.log(`  左边区域: ${blackLeft}px`);
            console.log(`  右边区域: ${blackRight}px`);
        }
        
        return {
            contentArea,
            contentRatio,
            hasBlackBars: contentRatio < 0.95,
            blackBars: this.calculateBlackBars(contentArea, width, height),
            motionThreshold,
            avgBrightness: this.calculateRegionAverageBrightness(avgBrightness, contentArea, width),
            confidence: this.calculateConfidence(avgMotion, contentArea, motionThreshold)
        };
    }

    /**
     * 计算所有帧的平均亮度
     */
    async calculateAverageBrightness(frames, width, height) {
        const avgBrightness = new Float32Array(width * height).fill(0);
        
        for (const frame of frames) {
            // 处理Jimp格式的帧数据
            const frameData = frame.image || frame; // 支持两种格式
            
            // 累加亮度值 - 直接从Jimp的bitmap.data读取RGBA数据
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    const pixelIdx = idx * 4; // RGBA格式，每个像素4个字节
                    
                    // 计算灰度值 (0.299*R + 0.587*G + 0.114*B)
                    const r = frameData.bitmap.data[pixelIdx];
                    const g = frameData.bitmap.data[pixelIdx + 1];
                    const b = frameData.bitmap.data[pixelIdx + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    avgBrightness[idx] += gray;
                }
            }
        }
        
        // 计算平均值
        const frameCount = frames.length;
        for (let i = 0; i < avgBrightness.length; i++) {
            avgBrightness[i] /= frameCount;
        }
        
        return avgBrightness;
    }

    /**
     * 计算平均帧间差异（动态活跃度）
     */
    async calculateAverageMotion(frames, width, height) {
        const avgMotion = new Float32Array(width * height).fill(0);
        const grayFrames = [];
        
        // 转换所有帧为灰度数组
        for (const frame of frames) {
            const frameData = frame.image || frame; // 支持两种格式
            const grayData = new Float32Array(width * height);
            
            // 从Jimp的RGBA数据转换为灰度
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    const pixelIdx = idx * 4; // RGBA格式
                    
                    // 计算灰度值
                    const r = frameData.bitmap.data[pixelIdx];
                    const g = frameData.bitmap.data[pixelIdx + 1];
                    const b = frameData.bitmap.data[pixelIdx + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    grayData[idx] = gray;
                }
            }
            grayFrames.push(grayData);
        }
        
        // 计算相邻帧之间的差异
        for (let i = 1; i < grayFrames.length; i++) {
            const prevFrame = grayFrames[i - 1];
            const currFrame = grayFrames[i];
            
            for (let idx = 0; idx < width * height; idx++) {
                const diff = Math.abs(currFrame[idx] - prevFrame[idx]);
                avgMotion[idx] += diff;
            }
        }
        
        // 计算平均值
        const diffCount = grayFrames.length - 1;
        for (let i = 0; i < avgMotion.length; i++) {
            avgMotion[i] /= diffCount;
        }
        
        return avgMotion;
    }

    /**
     * 计算动态阈值 - 严格按照Python版本实现
     */
    calculateMotionThreshold(avgMotion) {
        // 收集所有非零动态值 - 与Python版本保持一致
        const motionValues = [];
        for (let i = 0; i < avgMotion.length; i++) {
            if (avgMotion[i] > 0) {
                motionValues.push(avgMotion[i]);
            }
        }
        
        console.log(`动态值统计: 总像素=${avgMotion.length}, 非零动态值=${motionValues.length}`);
        
        if (motionValues.length === 0) {
            console.log('没有动态值，使用默认阈值: 5.0');
            return 5.0;
        }
        
        // 计算75百分位数 - 与Python的np.percentile(motion_values, 75)保持一致
        motionValues.sort((a, b) => a - b);
        const index = Math.floor(motionValues.length * 0.75);
        const motionPercentile75 = motionValues[Math.min(index, motionValues.length - 1)];
        
        // 使用75百分位数的30%作为阈值，但至少为5.0 - 与Python版本完全一致
        const threshold = Math.max(motionPercentile75 * 0.3, 5.0);
        
        console.log(`动态阈值计算: 75百分位数=${motionPercentile75.toFixed(2)}, 最终阈值=${threshold.toFixed(2)}`);
        
        return threshold;
    }

    /**
     * 分析单行的动态特性 - 严格按照Python版本的analyze_row_dynamics实现
     */
    analyzeRowDynamics(rowIdx, avgBrightness, avgMotion, motionThreshold, width) {
        let dynamicPixels = 0;
        let nonBlackPixels = 0;
        let nonBlackMotionSum = 0;
        let totalBrightness = 0;
        
        for (let x = 0; x < width; x++) {
            const idx = rowIdx * width + x;
            const brightness = avgBrightness[idx];
            const motion = avgMotion[idx];
            
            totalBrightness += brightness;
            
            // 计算动态像素占比
            if (motion > motionThreshold) {
                dynamicPixels++;
            }
            
            // 计算非黑像素占比和平均动态值（只考虑非黑像素）
            if (brightness > this.blackThreshold) {
                nonBlackPixels++;
                nonBlackMotionSum += motion;
            }
        }
        
        const dynamicRatio = dynamicPixels / width;
        const nonBlackRatio = nonBlackPixels / width;
        const avgMotionNonBlack = nonBlackPixels > 0 ? nonBlackMotionSum / nonBlackPixels : 0;
        const avgBrightnessRow = totalBrightness / width;
        
        return {
            dynamicRatio: dynamicRatio,
            nonBlackRatio: nonBlackRatio,
            avgMotion: avgMotionNonBlack,
            avgBrightness: avgBrightnessRow
        };
    }

    /**
     * 分析单列的动态特性 - 严格按照Python版本的analyze_col_dynamics实现
     */
    analyzeColDynamics(colIdx, avgBrightness, avgMotion, motionThreshold, width, height) {
        let dynamicPixels = 0;
        let nonBlackPixels = 0;
        let nonBlackMotionSum = 0;
        let totalBrightness = 0;
        
        for (let y = 0; y < height; y++) {
            const idx = y * width + colIdx;
            const brightness = avgBrightness[idx];
            const motion = avgMotion[idx];
            
            totalBrightness += brightness;
            
            // 计算动态像素占比
            if (motion > motionThreshold) {
                dynamicPixels++;
            }
            
            // 计算非黑像素占比和平均动态值（只考虑非黑像素）
            if (brightness > this.blackThreshold) {
                nonBlackPixels++;
                nonBlackMotionSum += motion;
            }
        }
        
        const dynamicRatio = dynamicPixels / height;
        const nonBlackRatio = nonBlackPixels / height;
        const avgMotionNonBlack = nonBlackPixels > 0 ? nonBlackMotionSum / nonBlackPixels : 0;
        const avgBrightnessCol = totalBrightness / height;
        
        return {
            dynamicRatio: dynamicRatio,
            nonBlackRatio: nonBlackRatio,
            avgMotion: avgMotionNonBlack,
            avgBrightness: avgBrightnessCol
        };
    }

    /**
     * 寻找真正的动态内容边界
     */
    findDynamicContentBoundaries(avgBrightness, avgMotion, motionThreshold, width, height) {
        let top = 0;
        let bottom = height - 1;
        let left = 0;
        let right = width - 1;
        
        console.log(`开始边界检测: 动态阈值=${motionThreshold.toFixed(2)}, 动态比例阈值=${this.dynamicRatioThreshold}, 非黑比例阈值=${this.nonBlackRatioThreshold}`);
        
        // 从上往下扫描，寻找动态内容开始
        for (let i = 0; i < height; i++) {
            const rowStats = this.analyzeRowDynamics(i, avgBrightness, avgMotion, motionThreshold, width);
            
            if (i < 10 || i === 53 || (i >= 50 && i <= 60)) {
                console.log(`行${i}: 动态比例=${(rowStats.dynamicRatio*100).toFixed(1)}%, 平均动态=${rowStats.avgMotion.toFixed(2)}, 非黑比例=${(rowStats.nonBlackRatio*100).toFixed(1)}%`);
            }
            
            // 严格条件：动态像素占比 > 20% 且 平均动态值 > 阈值 且 非黑像素占比 > 30%
            if (rowStats.dynamicRatio > this.dynamicRatioThreshold && 
                rowStats.avgMotion > motionThreshold && 
                rowStats.nonBlackRatio > this.nonBlackRatioThreshold) {
                console.log(`找到顶部边界: 行${i}`);
                top = i;
                break;
            }
        }
        
        // 从下往上扫描，寻找动态内容结束
        for (let i = height - 1; i >= 0; i--) {
            const rowStats = this.analyzeRowDynamics(i, avgBrightness, avgMotion, motionThreshold, width);
            
            if (rowStats.dynamicRatio > this.dynamicRatioThreshold && 
                rowStats.avgMotion > motionThreshold && 
                rowStats.nonBlackRatio > this.nonBlackRatioThreshold) {
                bottom = i;
                break;
            }
        }
        
        // 从左往右扫描，寻找动态内容开始
        for (let i = 0; i < width; i++) {
            const colStats = this.analyzeColDynamics(i, avgBrightness, avgMotion, motionThreshold, width, height);
            
            if (colStats.dynamicRatio > this.dynamicRatioThreshold && 
                colStats.avgMotion > motionThreshold && 
                colStats.nonBlackRatio > this.nonBlackRatioThreshold) {
                left = i;
                break;
            }
        }
        
        // 从右往左扫描，寻找动态内容结束
        for (let i = width - 1; i >= 0; i--) {
            const colStats = this.analyzeColDynamics(i, avgBrightness, avgMotion, motionThreshold, width, height);
            
            if (colStats.dynamicRatio > this.dynamicRatioThreshold && 
                colStats.avgMotion > motionThreshold && 
                colStats.nonBlackRatio > this.nonBlackRatioThreshold) {
                right = i;
                break;
            }
        }
        
        return { top, bottom, left, right };
    }

    /**
     * 验证和优化检测到的区域
     */
    validateAndOptimizeBoundaries(boundaries, avgBrightness, avgMotion, motionThreshold, width, height) {
        let { top, bottom, left, right } = boundaries;
        
        // 验证检测到的区域是否真的是动态播放区域
        if (top < bottom && left < right) {
            // 分析检测到的播放区域的动态特性
            let playRegionMotionSum = 0;
            let dynamicPixelCount = 0;
            let nonBlackPixelCount = 0;
            
            for (let y = top; y <= bottom; y++) {
                for (let x = left; x <= right; x++) {
                    const idx = y * width + x;
                    const brightness = avgBrightness[idx];
                    const motion = avgMotion[idx];
                    
                    if (brightness > this.blackThreshold) {
                        playRegionMotionSum += motion;
                        nonBlackPixelCount++;
                        
                        if (motion > motionThreshold) {
                            dynamicPixelCount++;
                        }
                    }
                }
            }
            
            let playRegionAvgMotion = 0;
            let dynamicPixelRatio = 0;
            
            if (nonBlackPixelCount > 0) {
                playRegionAvgMotion = playRegionMotionSum / nonBlackPixelCount;
                dynamicPixelRatio = dynamicPixelCount / nonBlackPixelCount;
            }
            
            console.log(`播放区域动态验证:`);
            console.log(`  区域平均动态值: ${playRegionAvgMotion.toFixed(1)}`);
            console.log(`  动态像素占比: ${(dynamicPixelRatio * 100).toFixed(1)}%`);
            
            // 如果播放区域的动态特性不足，说明可能没有真正的视频播放
            if (playRegionAvgMotion < motionThreshold || dynamicPixelRatio < 0.15) {
                console.log("  警告：检测到的区域动态特性不足，可能包含大量静态内容");
                
                // 进一步收缩边界，只保留最动态的核心区域
                const coreMotionThreshold = motionThreshold * 1.5;
                
                // 重新寻找核心动态区域 - 完全按照Python版本实现
                for (let i = top; i <= bottom; i++) {
                    let rowMotionSum = 0;
                    let count = 0;
                    for (let x = left; x <= right; x++) {
                        const idx = i * width + x;
                        rowMotionSum += avgMotion[idx];
                        count++;
                    }
                    const rowMotion = count > 0 ? rowMotionSum / count : 0;
                    
                    if (rowMotion > coreMotionThreshold) {
                        top = i;
                        break;
                    }
                }
                
                for (let i = bottom; i >= top; i--) {
                    let rowMotionSum = 0;
                    let count = 0;
                    for (let x = left; x <= right; x++) {
                        const idx = i * width + x;
                        rowMotionSum += avgMotion[idx];
                        count++;
                    }
                    const rowMotion = count > 0 ? rowMotionSum / count : 0;
                    
                    if (rowMotion > coreMotionThreshold) {
                        bottom = i;
                        break;
                    }
                }
                
                for (let i = left; i <= right; i++) {
                    let colMotionSum = 0;
                    let count = 0;
                    for (let y = top; y <= bottom; y++) {
                        const idx = y * width + i;
                        colMotionSum += avgMotion[idx];
                        count++;
                    }
                    const colMotion = count > 0 ? colMotionSum / count : 0;
                    
                    if (colMotion > coreMotionThreshold) {
                        left = i;
                        break;
                    }
                }
                
                for (let i = right; i >= left; i--) {
                    let colMotionSum = 0;
                    let count = 0;
                    for (let y = top; y <= bottom; y++) {
                        const idx = y * width + i;
                        colMotionSum += avgMotion[idx];
                        count++;
                    }
                    const colMotion = count > 0 ? colMotionSum / count : 0;
                    
                    if (colMotion > coreMotionThreshold) {
                        right = i;
                        break;
                    }
                }
                
                console.log(`  调整为核心动态区域: (${left}, ${top}) - (${right}, ${bottom})`);
            }
        }
        
        // 确保边界有效
        if (top >= bottom || left >= right) {
            // 如果检测失败，返回整个画面
            console.log("  动态内容检测失败，返回全画面");
            top = 0;
            left = 0;
            bottom = height - 1;
            right = width - 1;
        }
        
        return { top, bottom, left, right };
    }

    /**
     * 计算黑边信息
     */
    calculateBlackBars(contentArea, width, height) {
        const hasTopBlackBar = contentArea.y > 0;
        const hasBottomBlackBar = contentArea.y2 < height - 1;
        const hasLeftBlackBar = contentArea.x > 0;
        const hasRightBlackBar = contentArea.x2 < width - 1;
        
        if (!hasTopBlackBar && !hasBottomBlackBar && !hasLeftBlackBar && !hasRightBlackBar) {
            return null;
        }
        
        const blackBars = {};
        
        if (hasTopBlackBar || hasBottomBlackBar) {
            blackBars.type = 'horizontal';
            if (hasTopBlackBar) {
                blackBars.top = {
                    x: 0,
                    y: 0,
                    width: width,
                    height: contentArea.y
                };
            }
            if (hasBottomBlackBar) {
                blackBars.bottom = {
                    x: 0,
                    y: contentArea.y2 + 1,
                    width: width,
                    height: height - contentArea.y2 - 1
                };
            }
        }
        
        if (hasLeftBlackBar || hasRightBlackBar) {
            blackBars.type = blackBars.type ? 'both' : 'vertical';
            if (hasLeftBlackBar) {
                blackBars.left = {
                    x: 0,
                    y: 0,
                    width: contentArea.x,
                    height: height
                };
            }
            if (hasRightBlackBar) {
                blackBars.right = {
                    x: contentArea.x2 + 1,
                    y: 0,
                    width: width - contentArea.x2 - 1,
                    height: height
                };
            }
        }
        
        return blackBars;
    }

    /**
     * 计算区域平均亮度
     */
    calculateRegionAverageBrightness(avgBrightness, contentArea, width) {
        let sum = 0;
        let count = 0;
        
        for (let y = contentArea.y; y <= contentArea.y2; y++) {
            for (let x = contentArea.x; x <= contentArea.x2; x++) {
                const idx = y * width + x;  // 修正索引计算，使用原始图像宽度
                sum += avgBrightness[idx];
                count++;
            }
        }
        
        return count > 0 ? sum / count : 0;
    }

    /**
     * 计算检测置信度
     */
    calculateConfidence(avgMotion, contentArea, motionThreshold) {
        let dynamicPixels = 0;
        let totalPixels = 0;
        
        for (let y = contentArea.y; y <= contentArea.y2; y++) {
            for (let x = contentArea.x; x <= contentArea.x2; x++) {
                const idx = y * (contentArea.x2 - contentArea.x + 1) + x;
                if (avgMotion[idx] > motionThreshold) {
                    dynamicPixels++;
                }
                totalPixels++;
            }
        }
        
        return totalPixels > 0 ? dynamicPixels / totalPixels : 0;
    }
}

module.exports = OriginalVideoAreaDetector;