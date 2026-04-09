/**
 * ElementPositionAnalyzer -/**
 * 元素位置分析器
 * 负责分析ONNX检测结果，检测原视频播放区域，计算9:16扩展，生成位置建议
 */

const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const OriginalVideoAreaDetector = require('../algorithms/OriginalVideoAreaDetector');
const PositionCombinationGenerator = require('./PositionCombinationGenerator');

class ElementPositionAnalyzer {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.targetAspectRatio = 9 / 16; // 目标宽高比 9:16
        
        // 元素类型映射
        this.elementTypes = {
            title: ['剧名', 'title'],
            warning: ['警告', '提示', 'warning'],
            corner_mark: ['角标', 'corner', 'mark']
        };
        
        // 原视频播放区域检测器
        this.originalVideoAreaDetector = new OriginalVideoAreaDetector();
        
        // 位置组合生成器
        this.positionCombinationGenerator = new PositionCombinationGenerator();
    }

    /**
     * 分析三帧ONNX检测结果，合并判断元素存在性
     * @param {Object} onnxDetectionResult - ONNX检测结果
     * @returns {Object} 合并后的元素分析结果
     */
    analyzeThreeFrameDetections(onnxDetectionResult) {
        if (!onnxDetectionResult || !onnxDetectionResult.results) {
            return { elements: {}, frameAnalysis: [], allDetections: [] };
        }

        const frameResults = onnxDetectionResult.results;
        const elementStats = {};
        const frameAnalysis = [];
        const allDetections = []; // 收集所有检测结果用于计算平均字号

        // 分析每一帧的检测结果
        frameResults.forEach(frameResult => {
            const frameNumber = frameResult.frameNumber;
            const detections = frameResult.detections.detections || frameResult.detections;
            
            const frameElements = [];
            
            if (Array.isArray(detections)) {
                detections.forEach(detection => {
                    const className = detection.className;
                    const bbox = detection.bbox;
                    const classId = detection.classId;
                    
                    // 收集所有检测结果
                    allDetections.push({
                        className,
                        classId,
                        bbox,
                        confidence: detection.confidence,
                        frame: frameNumber
                    });
                    
                    // 初始化元素统计
                    if (!elementStats[className]) {
                        elementStats[className] = {
                            classId: classId,
                            appearances: [],
                            totalCount: 0,
                            exists: false,
                            representativeBbox: null,
                            confidence: 0
                        };
                    }
                    
                    // 记录出现信息
                    elementStats[className].appearances.push({
                        frame: frameNumber,
                        bbox: bbox,
                        confidence: detection.confidence
                    });
                    elementStats[className].totalCount++;
                    
                    frameElements.push({
                        className: className,
                        classId: classId,
                        bbox: bbox,
                        confidence: detection.confidence
                    });
                });
            }
            
            frameAnalysis.push({
                frameNumber: frameNumber,
                elements: frameElements
            });
        });

        // 应用过半数原则（3帧中至少2帧出现）
        Object.keys(elementStats).forEach(className => {
            const uniqueFrames = [...new Set(elementStats[className].appearances.map(app => app.frame))];
            elementStats[className].exists = uniqueFrames.length >= 2; // 至少在2帧中出现
            
            if (elementStats[className].exists) {
                // 选择置信度最高的bbox作为代表
                const bestDetection = elementStats[className].appearances.reduce((best, current) => 
                    current.confidence > best.confidence ? current : best
                );
                elementStats[className].representativeBbox = bestDetection.bbox;
                elementStats[className].confidence = bestDetection.confidence;
            }
        });

        return {
            elements: elementStats,
            frameAnalysis: frameAnalysis,
            allDetections: allDetections
        };
    }

    /**
     * 计算平均字号（基于所有检测到的bbox的最小边）
     * @param {Array} allDetections - 所有检测结果
     * @returns {number} 平均字号
     */
    calculateAverageCharacterSize(allDetections) {
        if (!allDetections || allDetections.length === 0) {
            return 40; // 默认字号
        }

        const minSides = allDetections.map(detection => {
            const [x1, y1, x2, y2] = detection.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            return Math.min(width, height);
        });

        const averageMinSide = minSides.reduce((sum, side) => sum + side, 0) / minSides.length;
        return Math.max(averageMinSide, 20); // 最小字号为20
    }

    /**
     * 检查黑边是否足够放置元素
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字号
     * @param {Object} videoInfo - 视频信息
     * @returns {boolean} 是否足够放置元素
     */
    canPlaceElementsInBlackBars(playAreaAnalysis, averageCharSize, videoInfo) {
        const { playArea } = playAreaAnalysis;
        const videoWidth = videoInfo.width;
        const videoHeight = videoInfo.height;

        // 计算黑边区域
        const topBlackHeight = playArea.y;
        const bottomBlackHeight = videoHeight - (playArea.y + playArea.height);
        const leftBlackWidth = playArea.x;
        const rightBlackWidth = videoWidth - (playArea.x + playArea.width);

        // 需要至少1.5倍字号的空间才能放置元素
        const minRequiredSpace = averageCharSize * 1.5;

        return topBlackHeight >= minRequiredSpace || 
               bottomBlackHeight >= minRequiredSpace || 
               leftBlackWidth >= minRequiredSpace || 
               rightBlackWidth >= minRequiredSpace;
    }

    /**
     * 检查播放区域内是否存在目标元素
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @returns {Object} 目标元素存在状态
     */
    checkTargetElementsInPlayArea(elementAnalysis, playAreaAnalysis) {
        const { playArea } = playAreaAnalysis;
        const targetStatus = {
            'title': { exists: false, inPlayArea: false },
            'corner_mark': { exists: false, inPlayArea: false },
            'warning': { exists: false, inPlayArea: false }
        };

        // 防护检查
        if (!elementAnalysis || !elementAnalysis.elements) {
            console.warn('elementAnalysis 或 elementAnalysis.elements 为空，跳过目标元素检查');
            return targetStatus;
        }

        // 检查每个目标元素类型
        Object.keys(this.elementTypes).forEach(targetType => {
            const targetClassNames = this.elementTypes[targetType];
            
            // 在检测结果中查找对应的元素
            Object.keys(elementAnalysis.elements).forEach(detectedClassName => {
                const element = elementAnalysis.elements[detectedClassName];
                
                // 检查检测到的类名是否匹配目标类型
                if (targetClassNames.includes(detectedClassName) && element.exists) {
                    targetStatus[targetType].exists = true;
                    
                    // 检查是否在播放区域内
                    const bbox = element.representativeBbox;
                    const elementCenterX = bbox[0] + (bbox[2] - bbox[0]) / 2;
                    const elementCenterY = bbox[1] + (bbox[3] - bbox[1]) / 2;
                    
                    const isInPlayArea = elementCenterX >= playArea.x && 
                                       elementCenterX <= playArea.x + playArea.width &&
                                       elementCenterY >= playArea.y && 
                                       elementCenterY <= playArea.y + playArea.height;
                    
                    if (isInPlayArea) {
                        targetStatus[targetType].inPlayArea = true;
                    }
                }
            });
        });

        return targetStatus;
    }

    /**
     * 检测原视频播放区域并计算9:16扩展参数
     * @param {Object} videoInfo - 视频信息
     * @param {Array} frames - 视频帧数组（用于播放区域检测）
     * @returns {Promise<Object>} 播放区域分析结果
     */
    async calculatePlayAreaWithDetection(videoInfo, frames = null) {
        const originalWidth = videoInfo.width;
        const originalHeight = videoInfo.height;
        const originalAspectRatio = originalWidth / originalHeight;
        
        let originalVideoArea = null;
        
        // 如果提供了帧数据，则检测原视频播放区域
        if (frames && frames.length > 0) {
            console.log('检测原视频播放区域...');
            try {
                originalVideoArea = await this.originalVideoAreaDetector.detectOriginalVideoArea(frames, videoInfo);
            } catch (error) {
                console.warn('原视频播放区域检测失败，使用全画面:', error.message);
                originalVideoArea = {
                    contentArea: {
                        x: 0,
                        y: 0,
                        width: originalWidth,
                        height: originalHeight,
                        x2: originalWidth - 1,
                        y2: originalHeight - 1
                    },
                    contentRatio: 1.0,
                    hasBlackBars: false,
                    blackBars: null,
                    confidence: 0
                };
            }
        } else {
            // 没有帧数据时，假设整个视频就是播放区域
            console.log('未提供帧数据，假设整个视频为播放区域');
            originalVideoArea = {
                contentArea: {
                    x: 0,
                    y: 0,
                    width: originalWidth,
                    height: originalHeight,
                    x2: originalWidth - 1,
                    y2: originalHeight - 1
                },
                contentRatio: 1.0,
                hasBlackBars: false,
                blackBars: null,
                confidence: 1.0
            };
        }
        
        // 获取真实播放区域
        const realPlayArea = originalVideoArea.contentArea;
        const realPlayAreaAspectRatio = realPlayArea.width / realPlayArea.height;
        
        // 判断是否需要9:16扩展
        const needsAdjustment = Math.abs(realPlayAreaAspectRatio - this.targetAspectRatio) > 0.001;
        
        let extendedWidth = originalWidth;
        let extendedHeight = originalHeight;
        let extendedPlayAreaX = realPlayArea.x;
        let extendedPlayAreaY = realPlayArea.y;
        let extensionBlackBars = null;

        if (needsAdjustment) {
            if (realPlayAreaAspectRatio > this.targetAspectRatio) {
                // 播放区域太宽，需要增加高度（上下黑边）
                extendedHeight = Math.round(realPlayArea.width / this.targetAspectRatio);
                const totalExtensionHeight = extendedHeight - originalHeight;
                extendedPlayAreaY = realPlayArea.y + Math.round(totalExtensionHeight / 2);
                
                extensionBlackBars = {
                    type: 'vertical',
                    top: { x: 0, y: 0, width: extendedWidth, height: Math.round(totalExtensionHeight / 2) },
                    bottom: { 
                        x: 0, 
                        y: originalHeight + Math.round(totalExtensionHeight / 2), 
                        width: extendedWidth, 
                        height: Math.round(totalExtensionHeight / 2) 
                    }
                };
            } else {
                // 播放区域太高，需要增加宽度（左右黑边）
                extendedWidth = Math.round(realPlayArea.height * this.targetAspectRatio);
                const totalExtensionWidth = extendedWidth - originalWidth;
                extendedPlayAreaX = realPlayArea.x + Math.round(totalExtensionWidth / 2);
                
                extensionBlackBars = {
                    type: 'horizontal',
                    left: { x: 0, y: 0, width: Math.round(totalExtensionWidth / 2), height: extendedHeight },
                    right: { 
                        x: originalWidth + Math.round(totalExtensionWidth / 2), 
                        y: 0, 
                        width: Math.round(totalExtensionWidth / 2), 
                        height: extendedHeight 
                    }
                };
            }
        }

        return {
            // 播放区域位置和尺寸
            playArea: { 
                x: realPlayArea.x,
                y: realPlayArea.y,
                width: realPlayArea.width,
                height: realPlayArea.height
            },
            
            // 是否有黑边
            hasBlackBars: originalVideoArea.hasBlackBars,
            
            // 黑边信息（如果有）
            blackBars: originalVideoArea.hasBlackBars ? originalVideoArea.blackBars : null,
            
            // 检测置信度
            confidence: originalVideoArea.confidence,
            
            // 是否需要9:16扩展
            needsAdjustment: needsAdjustment
        };
    }

    /**
     * 向后兼容的方法：不进行原视频播放区域检测的简单9:16扩展
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} 播放区域分析结果
     */
    calculatePlayArea(videoInfo) {
        const originalWidth = videoInfo.width;
        const originalHeight = videoInfo.height;
        const originalAspectRatio = originalWidth / originalHeight;
        
        const needsAdjustment = Math.abs(originalAspectRatio - this.targetAspectRatio) > 0.001;
        
        let extendedWidth = originalWidth;
        let extendedHeight = originalHeight;
        let frameX = 0;
        let frameY = 0;
        let blackBars = null;

        if (needsAdjustment) {
            if (originalAspectRatio > this.targetAspectRatio) {
                // 视频太宽，需要增加高度（上下黑边）
                extendedHeight = Math.round(originalWidth / this.targetAspectRatio);
                frameY = Math.round((extendedHeight - originalHeight) / 2);
                blackBars = {
                    type: 'vertical',
                    top: { x: 0, y: 0, width: extendedWidth, height: frameY },
                    bottom: { x: 0, y: frameY + originalHeight, width: extendedWidth, height: frameY }
                };
            } else {
                // 视频太高，需要增加宽度（左右黑边）
                extendedWidth = Math.round(originalHeight * this.targetAspectRatio);
                frameX = Math.round((extendedWidth - originalWidth) / 2);
                blackBars = {
                    type: 'horizontal',
                    left: { x: 0, y: 0, width: frameX, height: extendedHeight },
                    right: { x: frameX + originalWidth, y: 0, width: frameX, height: extendedHeight }
                };
            }
        }

        return {
            original: { width: originalWidth, height: originalHeight, aspectRatio: originalAspectRatio },
            extended: { width: extendedWidth, height: extendedHeight, aspectRatio: this.targetAspectRatio },
            playArea: { x: frameX, y: frameY, width: originalWidth, height: originalHeight },
            blackBars: blackBars,
            needsAdjustment: needsAdjustment
        };
    }

    /**
     * 生成平均图+ONNX检测结果的可视化
     * @param {Object} averageImage - 平均图像
     * @param {Object} elementAnalysis - 元素分析结果
     * @returns {Promise<string>} 输出文件路径
     */
    async generateAverageImageWithDetections(averageImage, elementAnalysis) {
        // 克隆平均图像作为基础
        const image = averageImage.image.clone();

        // 绘制所有检测到的元素
        for (const className of Object.keys(elementAnalysis.elements)) {
            const element = elementAnalysis.elements[className];
            if (element.exists && element.representativeBbox) {
                const bbox = element.representativeBbox;
                const x = Math.round(bbox[0]);
                const y = Math.round(bbox[1]);
                const width = Math.round(bbox[2] - bbox[0]);
                const height = Math.round(bbox[3] - bbox[1]);

                // 绘制绿色边框
                const borderColor = 0x00FF00FF; // 绿色
                const borderThickness = 2;
                
                // 绘制矩形边框
                for (let i = 0; i < borderThickness; i++) {
                    // 上边框
                    for (let px = x; px < x + width; px++) {
                        if (px >= 0 && px < image.bitmap.width && y + i >= 0 && y + i < image.bitmap.height) {
                            image.setPixelColor(borderColor, px, y + i);
                        }
                    }
                    // 下边框
                    for (let px = x; px < x + width; px++) {
                        if (px >= 0 && px < image.bitmap.width && y + height - 1 - i >= 0 && y + height - 1 - i < image.bitmap.height) {
                            image.setPixelColor(borderColor, px, y + height - 1 - i);
                        }
                    }
                    // 左边框
                    for (let py = y; py < y + height; py++) {
                        if (x + i >= 0 && x + i < image.bitmap.width && py >= 0 && py < image.bitmap.height) {
                            image.setPixelColor(borderColor, x + i, py);
                        }
                    }
                    // 右边框
                    for (let py = y; py < y + height; py++) {
                        if (x + width - 1 - i >= 0 && x + width - 1 - i < image.bitmap.width && py >= 0 && py < image.bitmap.height) {
                            image.setPixelColor(borderColor, x + width - 1 - i, py);
                        }
                    }
                }

                // 绘制标签背景（绿色半透明矩形）
                const labelText = `${className} (${(element.confidence * 100).toFixed(1)}%)`;
                const labelWidth = labelText.length * 8 + 8; // 估算文字宽度
                const labelHeight = 20;
                const labelY = Math.max(0, y - labelHeight);
                
                // 绘制标签背景
                const labelBgColor = 0x00FF00CC; // 绿色半透明
                for (let py = labelY; py < labelY + labelHeight && py < image.bitmap.height; py++) {
                    for (let px = x; px < x + labelWidth && px < image.bitmap.width; px++) {
                        if (px >= 0 && py >= 0) {
                            image.setPixelColor(labelBgColor, px, py);
                        }
                    }
                }
                
                // 绘制标签文字
                await this.drawSimpleText(image, labelText, x + 2, labelY + 2, 0x000000FF);
            }
        }

        // 保存图像
        const outputPath = path.join(this.outputDir, 'average_image_with_detections.png');
        await image.writeAsync(outputPath);

        console.log(`Average image with detections saved: ${outputPath}`);
        return outputPath;
    }

    /**
     * 生成9:16扩展图+播放区域标记+偏移后的bbox
     * @param {Object} averageImage - 平均图像
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @returns {Promise<string>} 输出文件路径
     */
    async generateExtendedImageWithPlayArea(averageImage, elementAnalysis, playAreaAnalysis) {
        // 使用新Python算法的结果格式
        const { playArea } = playAreaAnalysis;
        
        // 计算9:16扩展画布尺寸
        const originalWidth = averageImage.width;
        const originalHeight = averageImage.height;
        const targetAspectRatio = 9 / 16;
        
        // 计算扩展后的尺寸
        let extendedWidth, extendedHeight;
        const currentAspectRatio = originalWidth / originalHeight;
        
        if (currentAspectRatio > targetAspectRatio) {
            // 当前比例比9:16更宽，需要增加高度
            extendedWidth = originalWidth;
            extendedHeight = Math.round(originalWidth / targetAspectRatio);
        } else {
            // 当前比例比9:16更窄，需要增加宽度
            extendedHeight = originalHeight;
            extendedWidth = Math.round(originalHeight * targetAspectRatio);
        }
        
        // 计算原始视频在扩展画布中的位置（居中）
        const playAreaX = Math.round((extendedWidth - originalWidth) / 2);
        const playAreaY = Math.round((extendedHeight - originalHeight) / 2);
        
        // 创建黑色背景的扩展图像
        const extendedImage = new Jimp(extendedWidth, extendedHeight, 0x000000FF);
        
        // 将原始图像复制到扩展图像的中心位置
        extendedImage.composite(averageImage.image, playAreaX, playAreaY);

        // 绘制播放区域边框（红色）
        const playAreaBorderColor = 0xFF0000FF; // 红色
        const playAreaBorderThickness = 3;
        const contentAreaX = playAreaX + playArea.x;
        const contentAreaY = playAreaY + playArea.y;
        
        // 绘制播放区域矩形边框
        for (let i = 0; i < playAreaBorderThickness; i++) {
            // 上下边框
            for (let px = contentAreaX; px < contentAreaX + playArea.width; px++) {
                if (px >= 0 && px < extendedWidth) {
                    if (contentAreaY + i >= 0 && contentAreaY + i < extendedHeight) {
                        extendedImage.setPixelColor(playAreaBorderColor, px, contentAreaY + i);
                    }
                    if (contentAreaY + playArea.height - 1 - i >= 0 && contentAreaY + playArea.height - 1 - i < extendedHeight) {
                        extendedImage.setPixelColor(playAreaBorderColor, px, contentAreaY + playArea.height - 1 - i);
                    }
                }
            }
            // 左右边框
            for (let py = contentAreaY; py < contentAreaY + playArea.height; py++) {
                if (py >= 0 && py < extendedHeight) {
                    if (contentAreaX + i >= 0 && contentAreaX + i < extendedWidth) {
                        extendedImage.setPixelColor(playAreaBorderColor, contentAreaX + i, py);
                    }
                    if (contentAreaX + playArea.width - 1 - i >= 0 && contentAreaX + playArea.width - 1 - i < extendedWidth) {
                        extendedImage.setPixelColor(playAreaBorderColor, contentAreaX + playArea.width - 1 - i, py);
                    }
                }
            }
        }

        // 绘制9:16区域边框（蓝色）
        const extendedBorderColor = 0x0000FFFF; // 蓝色
        const extendedBorderThickness = 2;
        
        // 绘制扩展区域矩形边框
        for (let i = 0; i < extendedBorderThickness; i++) {
            // 上下边框
            for (let px = 2; px < extendedWidth - 2; px++) {
                if (2 + i < extendedHeight) {
                    extendedImage.setPixelColor(extendedBorderColor, px, 2 + i);
                }
                if (extendedHeight - 3 - i >= 0) {
                    extendedImage.setPixelColor(extendedBorderColor, px, extendedHeight - 3 - i);
                }
            }
            // 左右边框
            for (let py = 2; py < extendedHeight - 2; py++) {
                if (2 + i < extendedWidth) {
                    extendedImage.setPixelColor(extendedBorderColor, 2 + i, py);
                }
                if (extendedWidth - 3 - i >= 0) {
                    extendedImage.setPixelColor(extendedBorderColor, extendedWidth - 3 - i, py);
                }
            }
        }

        // 绘制检测元素
        for (const className of Object.keys(elementAnalysis.elements)) {
            const element = elementAnalysis.elements[className];
            if (element.exists && element.representativeBbox) {
                const bbox = element.representativeBbox;
                
                // 计算元素在扩展画布中的位置
                const offsetX = Math.round(playAreaX + bbox[0]);
                const offsetY = Math.round(playAreaY + bbox[1]);
                const width = Math.round(bbox[2] - bbox[0]);
                const height = Math.round(bbox[3] - bbox[1]);

                // 判断元素是否在播放区域内（基于新算法的contentArea）
                const elementCenterX = offsetX + width / 2;
                const elementCenterY = offsetY + height / 2;
                const contentAreaAbsX = playAreaX + playArea.x;
                const contentAreaAbsY = playAreaY + playArea.y;
                
                const isInPlayArea = elementCenterX >= contentAreaAbsX && 
                                   elementCenterX <= contentAreaAbsX + playArea.width &&
                                   elementCenterY >= contentAreaAbsY && 
                                   elementCenterY <= contentAreaAbsY + playArea.height;

                // 绘制边框（不同颜色区分播放区域内外）
                const borderColor = isInPlayArea ? 0x00FF00FF : 0xFFFF00FF; // 绿色或黄色
                const borderThickness = 2;
                
                // 绘制矩形边框
                for (let i = 0; i < borderThickness; i++) {
                    // 上下边框
                    for (let px = offsetX; px < offsetX + width; px++) {
                        if (px >= 0 && px < extendedWidth) {
                            if (offsetY + i >= 0 && offsetY + i < extendedHeight) {
                                extendedImage.setPixelColor(borderColor, px, offsetY + i);
                            }
                            if (offsetY + height - 1 - i >= 0 && offsetY + height - 1 - i < extendedHeight) {
                                extendedImage.setPixelColor(borderColor, px, offsetY + height - 1 - i);
                            }
                        }
                    }
                    // 左右边框
                    for (let py = offsetY; py < offsetY + height; py++) {
                        if (py >= 0 && py < extendedHeight) {
                            if (offsetX + i >= 0 && offsetX + i < extendedWidth) {
                                extendedImage.setPixelColor(borderColor, offsetX + i, py);
                            }
                            if (offsetX + width - 1 - i >= 0 && offsetX + width - 1 - i < extendedWidth) {
                                extendedImage.setPixelColor(borderColor, offsetX + width - 1 - i, py);
                            }
                        }
                    }
                }

                // 绘制标签背景
                const locationText = isInPlayArea ? 'InPlayArea' : 'InBlackBar';
                const labelText = `${className} (${locationText})`;
                const labelWidth = labelText.length * 8 + 8; // 估算文字宽度
                const labelHeight = 20;
                const labelY = Math.max(0, offsetY - labelHeight);
                
                // 绘制标签背景
                const labelBgColor = isInPlayArea ? 0x00FF00CC : 0xFFFF00CC; // 绿色或黄色半透明
                for (let py = labelY; py < labelY + labelHeight && py < extendedHeight; py++) {
                    for (let px = offsetX; px < offsetX + labelWidth && px < extendedWidth; px++) {
                        if (px >= 0 && py >= 0) {
                            extendedImage.setPixelColor(labelBgColor, px, py);
                        }
                    }
                }
                
                // 绘制标签文字
                await this.drawSimpleText(extendedImage, labelText, offsetX + 2, labelY + 2, 0x000000FF);
            }
        }

        // 保存图像
        const outputPath = path.join(this.outputDir, 'extended_image_with_play_area.png');
        await extendedImage.writeAsync(outputPath);

        console.log(`Extended 9:16 image with play area saved (new algorithm): ${outputPath}`);
        return outputPath;
    }

    /**
     * 判断元素是否在黑边区域内
     * @param {Object} element - 元素位置 {x, y, width, height}
     * @param {Object} playArea - 播放区域
     * @param {Object} blackBars - 黑边信息
     * @returns {boolean} 是否在黑边内
     */
    /**
     * 检查元素是否在黑边区域内
     * @param {Object} element - 元素信息（在扩展画布坐标系中）
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @returns {boolean} 是否在黑边区域
     */


    /**
     * 简单的文字渲染方法
     * @param {Jimp} image - 目标图像
     * @param {string} text - 要绘制的文字
     * @param {number} x - x坐标
     * @param {number} y - y坐标
     * @param {number} color - 颜色值
     */
    async drawSimpleText(image, text, x, y, color = 0xFFFFFFFF) {
        try {
            // 根据颜色选择合适的字体
            let font;
            const isLightColor = (color & 0xFF) + ((color >> 8) & 0xFF) + ((color >> 16) & 0xFF) > 384; // 判断是否为浅色
            
            if (isLightColor) {
                font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
            } else {
                font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
            }
            
            // 直接在图像上绘制文字
            image.print(font, x, y, text);
            
        } catch (error) {
            console.warn('Text rendering failed, using pixel-based fallback:', error.message);
            
            // 备用方法：使用像素绘制简单文字
            const textWidth = text.length * 6;
            const textHeight = 10;
            
            // 绘制文字轮廓
            for (let i = 0; i < text.length; i++) {
                const charX = x + i * 6;
                const charY = y;
                
                // 简单的字符绘制（绘制矩形代表字符）
                for (let px = charX; px < charX + 5 && px < image.bitmap.width; px++) {
                    for (let py = charY; py < charY + 8 && py < image.bitmap.height; py++) {
                        if (px >= 0 && py >= 0) {
                            // 绘制字符边框
                            if (px === charX || px === charX + 4 || py === charY || py === charY + 7) {
                                image.setPixelColor(color, px, py);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * 生成位置建议的主方法
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {Object} videoInfo - 视频信息
     * @param {number} maxSchemes - 最大方案数量，默认为3
     * @returns {Object} 位置建议结果
     */
    generatePositionSuggestions(elementAnalysis, playAreaAnalysis, videoInfo, maxSchemes = 3) {
        // 计算平均字号
        const averageCharSize = this.calculateAverageCharacterSize(elementAnalysis.allDetections);
        
        // 检查黑边是否足够放置元素
        const canUseBlackBars = this.canPlaceElementsInBlackBars(playAreaAnalysis, averageCharSize, videoInfo);
        
        // 检查播放区域内目标元素存在状态
        const targetElementStatus = this.checkTargetElementsInPlayArea(elementAnalysis, playAreaAnalysis);
        
        // 确定需要添加的元素
        const elementsToAdd = [];
        Object.keys(targetElementStatus).forEach(elementType => {
            const status = targetElementStatus[elementType];
            // 如果播放区域内没有该元素，则需要添加
            if (!status.inPlayArea) {
                elementsToAdd.push(elementType);
            }
        });

        // 生成所有可能的位置组合
        const combinationResult = this.generateAllPositionCombinations(
            elementsToAdd, 
            playAreaAnalysis, 
            averageCharSize, 
            canUseBlackBars, 
            videoInfo,
            elementAnalysis,
            maxSchemes // 使用传入的maxSchemes参数
        );

        return {
            elementStatus: targetElementStatus,
            suggestions: combinationResult.selectedSuggestions, // 用于推荐的方案
            allValidCombinations: combinationResult.allValidCombinations, // 所有有效方案，用于可视化
            totalCombinations: combinationResult.totalCombinations, // 总方案数
            playAreaInfo: playAreaAnalysis,
            averageCharSize: averageCharSize,
            canUseBlackBars: canUseBlackBars,
            elementsToAdd: elementsToAdd
        };
    }

    /**
     * 生成所有可能的位置组合
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {number} maxResults - 最大返回结果数，默认为3
     * @returns {Object} 包含所有方案和选中方案的对象
     */
    generateAllPositionCombinations(elementsToAdd, playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo, elementAnalysis = null, maxResults = 3) {
        return this.positionCombinationGenerator.generateAllPositionCombinations(
            elementsToAdd, 
            playAreaAnalysis, 
            averageCharSize, 
            canUseBlackBars, 
            videoInfo, 
            elementAnalysis, 
            this,
            maxResults
        );
    }

    /**
     * 计算边界区域信息
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} 边界区域信息
     */
    calculateBorderArea(playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo) {
        if (canUseBlackBars && playAreaAnalysis.hasBlackBars) {
            return {
                type: 'blackBars',
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height,
                playArea: playAreaAnalysis.playArea,
                blackBars: playAreaAnalysis.blackBars
            };
        } else {
            return {
                type: 'fullVideo',
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height,
                playArea: null
            };
        }
    }

    /**
     * 获取位置可用的方向
     * @param {string} position - 位置
     * @param {string} borderType - border类型
     * @returns {Array} 可用方向数组
     */
    getAvailableOrientations(position, borderType) {
        // 强制方向的位置
        if (position.includes('middle-left') || position.includes('middle-right')) {
            return ['vertical']; // 左中右中必须竖向
        }
        if (position.includes('top-center') || position.includes('bottom-center')) {
            return ['horizontal']; // 上中下中必须横向
        }
        
        // 角落位置支持双方向（即使在黑边区域）
        const cornerPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        if (cornerPositions.includes(position)) {
            return ['horizontal', 'vertical'];
        }
        
        // 黑边区域其他位置只支持横向
        if (borderType === 'blackBars') {
            return ['horizontal'];
        }
        
        // 整个视频区域支持两种方向
        return ['horizontal', 'vertical'];
    }



    /**
     * 在固定位置生成元素
     * @param {string} elementType - 元素类型
     * @param {string} position - 位置 (top-left, top-center, etc.)
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @param {string} orientation - 方向 ('horizontal' 或 'vertical')
     * @returns {Object} 元素位置信息
     */
    generateElementAtFixedPosition(elementType, position, playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo, orientation = 'horizontal', forcedBorderType = null) {
        // 禁止在中中位置放置元素
        if (position === 'middle-center') {
            return null;
        }
        
        // 确定border区域和类型
        let border;
        let borderType;
        
        if (forcedBorderType) {
            // 如果指定了强制的borderType，使用它
            borderType = forcedBorderType;
            
            if (borderType === 'fullVideo' || elementType === 'corner_mark') {
                border = {
                    x: 0,
                    y: 0,
                    width: videoInfo.width,
                    height: videoInfo.height,
                    type: 'fullVideo',
                    playArea: null
                };
            } else {
                // topBlack或bottomBlack
                border = this.calculateBorderArea(playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo);
                border.type = 'blackBars'; // 确保使用黑边计算
            }
        } else {
            // 兼容旧的调用方式
            if (elementType === 'corner_mark') {
                border = {
                    x: 0,
                    y: 0,
                    width: videoInfo.width,
                    height: videoInfo.height,
                    type: 'fullVideo',
                    playArea: null
                };
                borderType = 'fullVideo';
            } else {
                border = this.calculateBorderArea(playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo);
                borderType = 'fullVideo';
            }
        }
        
        // 根据border类型和位置确定方向
        const finalOrientation = this.determineOrientation(position, border.type, orientation);
        
        // 计算字号 - 使用检测到的平均字号或合理默认值
        const fontSize = averageCharSize > 0 ? averageCharSize : Math.min(videoInfo.width, videoInfo.height) * 0.05;
        
        // 估算文本尺寸 - 使用类型ID和类型名的格式
        const elementNames = {
            'title': '剧名',
            'warning': '警示语', 
            'corner_mark': '角标'
        };
        const elementIds = {
            'title': '0',
            'warning': '1',
            'corner_mark': '2'
        };
        
        const text = `${elementIds[elementType]}, ${elementNames[elementType]}`;
        
        // 根据方向计算文本尺寸
        let textWidth, textHeight;
        if (finalOrientation === 'vertical') {
            textWidth = fontSize;
            textHeight = text.length * fontSize * 0.8; // 竖向时每个字符占用更多高度
        } else {
            textWidth = text.length * fontSize * 0.6; // 横向
            textHeight = fontSize;
        }
        
        // 根据位置计算坐标
        const coords = this.calculatePositionCoordinates(position, border, textWidth, textHeight, finalOrientation);
        
        // 生成bbox
        const bbox = [coords.x1, coords.y1, coords.x2, coords.y2];
        
        // 计算基于分辨率比例的margin
        const margin = this.calculateMarginByRatio(bbox, borderType, playAreaAnalysis, videoInfo, position);
        
        const result = {
            bbox: bbox,
            fontSize: fontSize,
            text: text,
            position: position,
            orientation: finalOrientation,
            base: borderType,
            reason: `固定位置: ${position}，${finalOrientation === 'vertical' ? '竖向' : '横向'}，基于${borderType}边界`,
            margin: margin
        };
        
        return result;
    }

    /**
     * 确定元素方向
     * @param {string} position - 位置
     * @param {string} borderType - border类型 ('blackBars' 或 'fullVideo')
     * @param {string} requestedOrientation - 请求的方向
     * @returns {string} 最终方向
     */
    determineOrientation(position, borderType, requestedOrientation) {
        // 强制方向规则
        if (position.includes('middle-left') || position.includes('middle-right')) {
            return 'vertical'; // 左中右中必须竖向
        }
        if (position.includes('top-center') || position.includes('bottom-center')) {
            return 'horizontal'; // 上中下中必须横向
        }
        
        // 黑边区域默认横向
        if (borderType === 'blackBars') {
            return 'horizontal';
        }
        
        // 整个视频区域时，可以选择方向
        return requestedOrientation;
    }

    /**
     * 计算border区域
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} border区域坐标和类型
     */
    calculateBorderArea(playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo) {
        if (canUseBlackBars && playAreaAnalysis.hasBlackBars) {
            // 优先使用黑边区域作为border
            return {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height,
                type: 'blackBars',
                playArea: playAreaAnalysis.playArea
            };
        } else {
            // 黑边不够时使用整个视频区域作为border
            return {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height,
                type: 'fullVideo',
                playArea: null
            };
        }
    }

    /**
     * 根据位置计算具体坐标
     * @param {string} position - 位置名称
     * @param {Object} border - border区域
     * @param {number} textWidth - 文本宽度
     * @param {number} textHeight - 文本高度
     * @param {string} orientation - 方向
     * @returns {Object} 坐标信息
     */
    calculatePositionCoordinates(position, border, textWidth, textHeight, orientation = 'horizontal') {
        const margin = 20; // 边距
        let x, y;
        
        // 如果是黑边区域，需要避开播放区域
        if (border.type === 'blackBars' && border.playArea) {
            return this.calculateBlackBarPosition(position, border, textWidth, textHeight, orientation);
        }
        
        // 计算x坐标
        if (position.includes('left')) {
            x = border.x + margin;
        } else if (position.includes('center') || position.includes('middle')) {
            x = border.x + (border.width - textWidth) / 2;
        } else if (position.includes('right')) {
            x = border.x + border.width - textWidth - margin;
        }
        
        // 计算y坐标
        if (position.includes('top')) {
            y = border.y + margin;
        } else if (position.includes('middle')) {
            y = border.y + (border.height - textHeight) / 2;
        } else if (position.includes('bottom')) {
            y = border.y + border.height - textHeight - margin;
        }
        
        return {
            x1: Math.max(0, x),
            y1: Math.max(0, y),
            x2: Math.min(border.x + border.width, x + textWidth),
            y2: Math.min(border.y + border.height, y + textHeight)
        };
    }

    /**
     * 在黑边区域计算位置坐标
     * @param {string} position - 位置名称
     * @param {Object} border - border区域
     * @param {number} textWidth - 文本宽度
     * @param {number} textHeight - 文本高度
     * @param {string} orientation - 方向
     * @returns {Object} 坐标信息
     */
    calculateBlackBarPosition(position, border, textWidth, textHeight, orientation) {
        const margin = 20;
        const playArea = border.playArea;
        let x, y;
        
        // 根据位置确定在哪个黑边区域
        if (position.includes('top')) {
            // 上方黑边
            x = position.includes('left') ? margin : 
                position.includes('right') ? border.width - textWidth - margin :
                (border.width - textWidth) / 2;
            y = margin;
        } else if (position.includes('bottom')) {
            // 下方黑边
            x = position.includes('left') ? margin : 
                position.includes('right') ? border.width - textWidth - margin :
                (border.width - textWidth) / 2;
            y = playArea.y + playArea.height + margin;
        } else if (position.includes('middle')) {
            // 中间位置处理
            if (position.includes('left')) {
                // 左侧中间
                x = margin;
                y = playArea.y + (playArea.height - textHeight) / 2;
            } else if (position.includes('right')) {
                // 右侧中间
                x = border.width - textWidth - margin;
                y = playArea.y + (playArea.height - textHeight) / 2;
            } else {
                // 正中间 - 在顶部黑边区域居中显示
                x = (border.width - textWidth) / 2;
                y = margin;
            }
        }
        
        return {
            x1: Math.max(0, x),
            y1: Math.max(0, y),
            x2: Math.min(border.width, x + textWidth),
            y2: Math.min(border.height, y + textHeight)
        };
    }

    /**
     * 生成标题位置建议
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字号
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {number} schemeIndex - 方案索引
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} 标题位置建议
     */
    generateTitlePosition(playAreaAnalysis, averageCharSize, canUseBlackBars, schemeIndex, videoInfo) {
        const { contentArea } = playAreaAnalysis;
        const videoWidth = videoInfo.width;
        const videoHeight = videoInfo.height;
        
        // 随机字体大小（在最大最小值之间）
        const minFontSize = Math.max(averageCharSize * 0.8, 20);
        const maxFontSize = averageCharSize * 1.2;
        const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
        
        // 估算文字宽度（假设4个字）
        const textWidth = fontSize * 4;
        const textHeight = fontSize;
        const padding = 10;

        let bbox;
        let reason;

        if (canUseBlackBars) {
            // 黑边模式：优先在上下黑边
            const topBlackHeight = contentArea.y;
            const bottomBlackHeight = videoHeight - (contentArea.y + contentArea.height);
            
            if (schemeIndex === 0) {
                // 方案1：上方居中
                if (topBlackHeight >= textHeight + padding * 2) {
                    const x = (videoWidth - textWidth) / 2;
                    const y = padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "上方黑边居中放置";
                } else {
                    // 回退到下方
                    const x = (videoWidth - textWidth) / 2;
                    const y = videoHeight - bottomBlackHeight + padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "下方黑边居中放置";
                }
            } else if (schemeIndex === 1) {
                // 方案2：左对齐
                if (topBlackHeight >= textHeight + padding * 2) {
                    const x = padding;
                    const y = padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "上方黑边左对齐";
                } else {
                    const x = padding;
                    const y = videoHeight - bottomBlackHeight + padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "下方黑边左对齐";
                }
            } else {
                // 方案3：右对齐
                if (topBlackHeight >= textHeight + padding * 2) {
                    const x = videoWidth - textWidth - padding;
                    const y = padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "上方黑边右对齐";
                } else {
                    const x = videoWidth - textWidth - padding;
                    const y = videoHeight - bottomBlackHeight + padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "下方黑边右对齐";
                }
            }
        } else {
            // 全视频模式：以整个视频为画布
            if (schemeIndex === 0) {
                // 方案1：上方居中
                const x = (videoWidth - textWidth) / 2;
                const y = padding;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频上方居中";
            } else if (schemeIndex === 1) {
                // 方案2：左上角
                const x = padding;
                const y = padding;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频左上角";
            } else {
                // 方案3：右上角
                const x = videoWidth - textWidth - padding;
                const y = padding;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频右上角";
            }
        }

        return {
            bbox: bbox.map(Math.round),
            fontSize: Math.round(fontSize),
            reason: reason
        };
    }

    /**
     * 生成警示语位置建议
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字号
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {number} schemeIndex - 方案索引
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} 警示语位置建议
     */
    generateWarningPosition(playAreaAnalysis, averageCharSize, canUseBlackBars, schemeIndex, videoInfo) {
        const { contentArea } = playAreaAnalysis;
        const videoWidth = videoInfo.width;
        const videoHeight = videoInfo.height;
        
        // 随机字体大小
        const minFontSize = Math.max(averageCharSize * 0.8, 16);
        const maxFontSize = averageCharSize * 1.2;
        const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
        
        const padding = 10;
        let bbox;
        let reason;
        let isVertical = false;

        if (canUseBlackBars) {
            // 黑边模式
            const topBlackHeight = contentArea.y;
            const bottomBlackHeight = videoHeight - (contentArea.y + contentArea.height);
            const leftBlackWidth = contentArea.x;
            const rightBlackWidth = videoWidth - (contentArea.x + contentArea.width);
            
            if (schemeIndex === 0) {
                // 方案1：横向在上方或下方
                const textWidth = fontSize * 3; // 假设3个字
                const textHeight = fontSize;
                
                if (topBlackHeight >= textHeight + padding * 2) {
                    const x = (videoWidth - textWidth) / 2;
                    const y = padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "上方黑边横向居中";
                } else if (bottomBlackHeight >= textHeight + padding * 2) {
                    const x = (videoWidth - textWidth) / 2;
                    const y = videoHeight - bottomBlackHeight + padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "下方黑边横向居中";
                } else {
                    // 回退到左侧竖向
                    isVertical = true;
                    const textWidth = fontSize;
                    const textHeight = fontSize * 3;
                    const x = padding;
                    const y = (videoHeight - textHeight) / 2;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "左侧黑边竖向居中";
                }
            } else if (schemeIndex === 1) {
                // 方案2：竖向在左侧或右侧
                isVertical = true;
                const textWidth = fontSize;
                const textHeight = fontSize * 3;
                
                if (leftBlackWidth >= textWidth + padding * 2) {
                    const x = padding;
                    const y = (videoHeight - textHeight) / 2;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "左侧黑边竖向居中";
                } else if (rightBlackWidth >= textWidth + padding * 2) {
                    const x = videoWidth - rightBlackWidth + padding;
                    const y = (videoHeight - textHeight) / 2;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "右侧黑边竖向居中";
                } else {
                    // 回退到上方横向
                    isVertical = false;
                    const textWidth = fontSize * 3;
                    const textHeight = fontSize;
                    const x = (videoWidth - textWidth) / 2;
                    const y = padding;
                    bbox = [x, y, x + textWidth, y + textHeight];
                    reason = "上方黑边横向居中";
                }
            } else {
                // 方案3：随机选择横向或竖向
                const useVertical = Math.random() > 0.5;
                
                if (useVertical && (leftBlackWidth >= fontSize + padding * 2 || rightBlackWidth >= fontSize + padding * 2)) {
                    isVertical = true;
                    const textWidth = fontSize;
                    const textHeight = fontSize * 3;
                    
                    if (leftBlackWidth >= textWidth + padding * 2) {
                        const x = padding;
                        const y = (videoHeight - textHeight) / 2;
                        bbox = [x, y, x + textWidth, y + textHeight];
                        reason = "左侧黑边竖向";
                    } else {
                        const x = videoWidth - rightBlackWidth + padding;
                        const y = (videoHeight - textHeight) / 2;
                        bbox = [x, y, x + textWidth, y + textHeight];
                        reason = "右侧黑边竖向";
                    }
                } else {
                    // 横向
                    const textWidth = fontSize * 3;
                    const textHeight = fontSize;
                    
                    if (bottomBlackHeight >= textHeight + padding * 2) {
                        const x = (videoWidth - textWidth) / 2;
                        const y = videoHeight - bottomBlackHeight + padding;
                        bbox = [x, y, x + textWidth, y + textHeight];
                        reason = "下方黑边横向";
                    } else {
                        const x = (videoWidth - textWidth) / 2;
                        const y = padding;
                        bbox = [x, y, x + textWidth, y + textHeight];
                        reason = "上方黑边横向";
                    }
                }
            }
        } else {
            // 全视频模式
            if (schemeIndex === 0) {
                // 方案1：下方横向
                const textWidth = fontSize * 3;
                const textHeight = fontSize;
                const x = (videoWidth - textWidth) / 2;
                const y = videoHeight - textHeight - padding;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频下方横向";
            } else if (schemeIndex === 1) {
                // 方案2：左侧竖向
                isVertical = true;
                const textWidth = fontSize;
                const textHeight = fontSize * 3;
                const x = padding;
                const y = (videoHeight - textHeight) / 2;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频左侧竖向";
            } else {
                // 方案3：右侧竖向
                isVertical = true;
                const textWidth = fontSize;
                const textHeight = fontSize * 3;
                const x = videoWidth - textWidth - padding;
                const y = (videoHeight - textHeight) / 2;
                bbox = [x, y, x + textWidth, y + textHeight];
                reason = "视频右侧竖向";
            }
        }

        return {
            bbox: bbox.map(Math.round),
            fontSize: Math.round(fontSize),
            isVertical: isVertical,
            reason: reason
        };
    }

    /**
     * 生成角标位置建议
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字号
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {number} schemeIndex - 方案索引
     * @param {Object} videoInfo - 视频信息
     * @returns {Object} 角标位置建议
     */
    generateCornerMarkPosition(playAreaAnalysis, averageCharSize, canUseBlackBars, schemeIndex, videoInfo) {
        const { contentArea } = playAreaAnalysis;
        const videoWidth = videoInfo.width;
        const videoHeight = videoInfo.height;
        
        // 随机字体大小
        const minFontSize = Math.max(averageCharSize * 0.7, 14);
        const maxFontSize = averageCharSize * 1.0;
        const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
        
        // 角标通常比较小
        const markSize = fontSize * 1.5; // 正方形角标
        const padding = 8;
        
        let bbox;
        let reason;
        let corner;

        // 四个角的位置
        const corners = ['左上', '右上', '左下', '右下'];
        
        // 角标强制使用整个视频的四个角，不使用黑边区域
        const cornerIndex = schemeIndex % 4;
        corner = corners[cornerIndex];
        
        switch (cornerIndex) {
            case 0: // 左上
                bbox = [padding, padding, padding + markSize, padding + markSize];
                reason = "视频左上角";
                break;
            case 1: // 右上
                bbox = [videoWidth - markSize - padding, padding, videoWidth - padding, padding + markSize];
                reason = "视频右上角";
                break;
            case 2: // 左下
                bbox = [padding, videoHeight - markSize - padding, padding + markSize, videoHeight - padding];
                reason = "视频左下角";
                break;
            case 3: // 右下
                bbox = [videoWidth - markSize - padding, videoHeight - markSize - padding, 
                       videoWidth - padding, videoHeight - padding];
                reason = "视频右下角";
                break;
        }

        return {
            bbox: bbox.map(Math.round),
            fontSize: Math.round(fontSize),
            corner: corner,
            reason: reason
        };
    }


    /**
     * 检查两个边界框是否重叠（扩大30%进行检测）
     * @param {Array} bbox1 - 第一个边界框 [x1, y1, x2, y2]
     * @param {Array} bbox2 - 第二个边界框 [x1, y1, x2, y2]
     * @returns {boolean} 是否重叠
     */
    checkBboxOverlap(bbox1, bbox2) {
        if (!bbox1 || !bbox2 || bbox1.length !== 4 || bbox2.length !== 4) {
            return false;
        }
        
        // 扩大30%进行检测
        const expandRatio = 0.3;
        
        // 扩大第一个边界框
        const width1 = bbox1[2] - bbox1[0];
        const height1 = bbox1[3] - bbox1[1];
        const expandX1 = width1 * expandRatio / 2;
        const expandY1 = height1 * expandRatio / 2;
        const expanded1 = [
            bbox1[0] - expandX1,
            bbox1[1] - expandY1,
            bbox1[2] + expandX1,
            bbox1[3] + expandY1
        ];
        
        // 扩大第二个边界框
        const width2 = bbox2[2] - bbox2[0];
        const height2 = bbox2[3] - bbox2[1];
        const expandX2 = width2 * expandRatio / 2;
        const expandY2 = height2 * expandRatio / 2;
        const expanded2 = [
            bbox2[0] - expandX2,
            bbox2[1] - expandY2,
            bbox2[2] + expandX2,
            bbox2[3] + expandY2
        ];
        
        // 检查扩大后的边界框是否重叠
        return !(expanded1[2] <= expanded2[0] || // bbox1在bbox2左边
                expanded1[0] >= expanded2[2] || // bbox1在bbox2右边
                expanded1[3] <= expanded2[1] || // bbox1在bbox2上边
                expanded1[1] >= expanded2[3]);  // bbox1在bbox2下边
    }

    /**
     * 检查新元素是否与已有元素重叠
     * @param {Array} newElementBbox - 新元素的边界框
     * @param {Object} elementAnalysis - 已有元素分析结果
     * @param {Array} addedElements - 已添加的新元素列表
     * @returns {boolean} 是否重叠
     */
    checkElementOverlap(newElementBbox, elementAnalysis, addedElements = []) {
        // 检查与已有检测到的元素是否重叠
        if (elementAnalysis && elementAnalysis.elements) {
            for (const className of Object.keys(elementAnalysis.elements)) {
                const element = elementAnalysis.elements[className];
                if (element.exists && element.representativeBbox) {
                    if (this.checkBboxOverlap(newElementBbox, element.representativeBbox)) {
                        return true;
                    }
                }
            }
        }
        
        // 检查与已添加的新元素是否重叠
        for (const addedElement of addedElements) {
            if (addedElement.bbox && this.checkBboxOverlap(newElementBbox, addedElement.bbox)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 将bbox坐标转换为语义化的位置格式
     * @param {Array} bbox - [x1, y1, x2, y2] 格式的边界框
     * @param {string} borderType - 边界类型：'fullVideo', 'topBlack', 'bottomBlack'
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {Object} videoInfo - 视频信息
     * @param {string} originalPosition - 原始的固定位置（如 'bottom-center'）
     * @returns {Object} 语义化位置格式 { base, position, margin }
     */
    /**
     * 计算基于分辨率比例的margin值
     * @param {Array} bbox - 元素边界框 [x1, y1, x2, y2]
     * @param {string} borderType - 边界类型
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {Object} videoInfo - 视频信息
     * @param {string} position - 原始位置
     * @returns {number} 基于分辨率比例的margin值
     */
    calculateMarginByRatio(bbox, borderType, playAreaAnalysis, videoInfo, position) {
        const [x1, y1, x2, y2] = bbox;
        
        // 获取参考区域
        let referenceArea;
        let contentArea;
        
        if (playAreaAnalysis && playAreaAnalysis.playArea) {
            contentArea = playAreaAnalysis.playArea;
        } else {
            contentArea = {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height
            };
        }
        
        if (borderType === 'fullVideo') {
            referenceArea = {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height
            };
        } else if (borderType === 'topBlack') {
            referenceArea = {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: contentArea.y
            };
        } else if (borderType === 'bottomBlack') {
            const contentBottom = contentArea.y + contentArea.height;
            referenceArea = {
                x: 0,
                y: contentBottom,
                width: videoInfo.width,
                height: videoInfo.height - contentBottom
            };
        } else {
            referenceArea = {
                x: 0,
                y: 0,
                width: videoInfo.width,
                height: videoInfo.height
            };
        }
        
        // 解析位置
        const parts = position.split('-');
        const horizontalPos = parts[0];
        const verticalPos = parts[1];
        
        // 计算实际像素距离
        let pixelMargin = 0;
        
        if (horizontalPos === 'left') {
            pixelMargin = x1 - referenceArea.x;
        } else if (horizontalPos === 'right') {
            pixelMargin = (referenceArea.x + referenceArea.width) - x2;
        } else if (verticalPos === 'top') {
            pixelMargin = y1 - referenceArea.y;
        } else if (verticalPos === 'bottom') {
            pixelMargin = (referenceArea.y + referenceArea.height) - y2;
        } else {
            // center位置，使用到最近边缘的距离
            const leftMargin = x1 - referenceArea.x;
            const rightMargin = (referenceArea.x + referenceArea.width) - x2;
            const topMargin = y1 - referenceArea.y;
            const bottomMargin = (referenceArea.y + referenceArea.height) - y2;
            pixelMargin = Math.min(leftMargin, rightMargin, topMargin, bottomMargin);
        }
        
        // 确保margin为非负值
        pixelMargin = Math.max(0, pixelMargin);
        
        // 基于视频分辨率计算比例margin
        // 使用视频较小边的固定比例（约3%）作为基准
        const baseResolution = Math.min(videoInfo.width, videoInfo.height);
        const ratioMargin = baseResolution * 0.03;
        
        // 如果实际margin接近比例margin，使用比例margin；否则保持实际值
        const marginDiff = Math.abs(pixelMargin - ratioMargin);
        const tolerance = baseResolution * 0.01; // 1%的容差
        
        if (marginDiff <= tolerance) {
            return Math.round(ratioMargin);
        } else {
            return Math.round(pixelMargin);
        }
    }

}

module.exports = ElementPositionAnalyzer;