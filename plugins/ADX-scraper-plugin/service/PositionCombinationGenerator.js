/**
 * PositionCombinationGenerator - 位置组合生成器
 * 负责生成元素位置组合方案，支持任意数量的元素
 */

class PositionCombinationGenerator {
    constructor() {
        // 定义8个有效位置（排除middle-center）
        this.validPositions = [
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right', 
            'bottom-left', 'bottom-center', 'bottom-right'
        ];
        
        // 角标只能放在四个角位置
        this.cornerMarkPositions = [
            'top-left', 'top-right', 'bottom-left', 'bottom-right'
        ];
    }

    /**
     * 生成所有可能的位置组合
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} elementPositionAnalyzer - 元素位置分析器实例
     * @param {number} maxResults - 最大返回结果数，默认为3
     * @returns {Object} 包含所有方案和选中方案的对象
     */
    generateAllPositionCombinations(elementsToAdd, playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo, elementAnalysis, elementPositionAnalyzer, maxResults = 3) {
        console.log(`需要添加的元素: ${elementsToAdd.join(', ')}`);
        
        // 如果没有需要添加的元素，返回空结果
        if (elementsToAdd.length === 0) {
            console.log('播放区域内已包含所有目标元素，无需生成位置方案');
            return {
                allValidCombinations: [],
                selectedSuggestions: [],
                totalCombinations: 0
            };
        }
        
        const border = elementPositionAnalyzer.calculateBorderArea(playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo);
        
        // 为每个元素生成可用的位置-方向组合
        const elementPositionCombos = this.generateElementPositionCombos(elementsToAdd, border, elementPositionAnalyzer);
        
        // 生成所有可行的组合方案（不限制数量）
        const allValidCombinations = this.generateAllValidCombinations(
            elementsToAdd, 
            elementPositionCombos, 
            playAreaAnalysis, 
            averageCharSize, 
            canUseBlackBars, 
            videoInfo, 
            elementAnalysis, 
            elementPositionAnalyzer
        );
        
        console.log(`生成的所有有效组合方案数: ${allValidCombinations.length}`);
        
        // 从所有方案中随机抽取指定数量的方案
        const selectedSuggestions = this.selectRandomSuggestions(allValidCombinations, maxResults);
        
        console.log(`随机选择的方案数: ${selectedSuggestions.length}`);
        
        return {
            allValidCombinations: allValidCombinations,
            selectedSuggestions: selectedSuggestions,
            totalCombinations: allValidCombinations.length
        };
    }

    /**
     * 为每个元素生成可用的位置-方向组合
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Object} border - 边界信息
     * @param {Object} elementPositionAnalyzer - 元素位置分析器实例
     * @returns {Object} 元素位置组合映射
     */
    generateElementPositionCombos(elementsToAdd, border, elementPositionAnalyzer) {
        const elementPositionCombos = {};
        
        elementsToAdd.forEach(elementType => {
            const combos = [];
            
            if (elementType === 'corner_mark') {
                // 角标只能在四个角位置，使用fullVideo
                this.cornerMarkPositions.forEach(position => {
                    const orientations = elementPositionAnalyzer.getAvailableOrientations(position, 'fullVideo');
                    orientations.forEach(orientation => {
                        combos.push({ position, orientation, borderType: 'fullVideo' });
                    });
                });
            } else {
                // 其他元素类型，为每个位置选择最合适的borderType
                this.validPositions.forEach(position => {
                    const orientations = elementPositionAnalyzer.getAvailableOrientations(position, 'fullVideo');
                    
                    orientations.forEach(orientation => {
                        let borderType = 'fullVideo';
                        let allowedOrientation = orientation;
                        
                        // 如果有黑边，根据位置选择最合适的borderType
                        if (border.type === 'blackBars') {
                            if (position.includes('middle')) {
                                // middle行位置：优先使用topBlack，但只允许horizontal
                                borderType = 'topBlack';
                                allowedOrientation = 'horizontal';
                            } else if (position.includes('bottom')) {
                                // bottom行位置：可以使用topBlack（在黑边内）或fullVideo
                                // 如果是horizontal方向，使用topBlack；否则使用fullVideo
                                if (orientation === 'horizontal') {
                                    borderType = 'topBlack';
                                    allowedOrientation = 'horizontal';
                                } else {
                                    borderType = 'fullVideo';
                                    allowedOrientation = orientation;
                                }
                            } else if (position.includes('top')) {
                                // top行位置：可以使用bottomBlack（在黑边内）或fullVideo
                                // 如果是horizontal方向，使用bottomBlack；否则使用fullVideo
                                if (orientation === 'horizontal') {
                                    borderType = 'bottomBlack';
                                    allowedOrientation = 'horizontal';
                                } else {
                                    borderType = 'fullVideo';
                                    allowedOrientation = orientation;
                                }
                            }
                        }
                        
                        combos.push({ position, orientation: allowedOrientation, borderType });
                    });
                });
            }
            
            elementPositionCombos[elementType] = combos;
            console.log(`${elementType} 可用位置-方向组合数: ${combos.length}`);
        });
        
        return elementPositionCombos;
    }

    /**
     * 生成所有有效的组合方案，不限制数量
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Object} elementPositionCombos - 元素位置组合映射
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} elementPositionAnalyzer - 元素位置分析器实例
     * @returns {Array} 所有有效方案的数组
     */
    generateAllValidCombinations(elementsToAdd, elementPositionCombos, playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo, elementAnalysis, elementPositionAnalyzer) {
        const allSchemes = [];
        let schemeCounter = 0;
        
        // 获取每个元素的组合数组
        const elementCombosArrays = elementsToAdd.map(elementType => elementPositionCombos[elementType]);
        
        // 生成所有可能的组合
        const allCombinations = this.cartesianProduct(elementCombosArrays);
        
        console.log(`总的位置组合数: ${allCombinations.length}`);
        
        for (const combination of allCombinations) {
            // 检查位置是否重复
            const positions = combination.map(combo => combo.position);
            const uniquePositions = new Set(positions);
            if (uniquePositions.size !== positions.length) {
                continue; // 跳过有重复位置的组合
            }
            
            // 尝试生成这个组合的方案
            const scheme = this.generateSchemeForCombination(
                elementsToAdd, 
                combination, 
                playAreaAnalysis, 
                averageCharSize, 
                canUseBlackBars, 
                videoInfo, 
                elementAnalysis, 
                elementPositionAnalyzer
            );
            
            if (scheme) {
                schemeCounter++;
                const description = this.generateSchemeDescription(elementsToAdd, combination);
                allSchemes.push({
                    ...scheme,
                    schemeId: `combination-${schemeCounter}`,
                    description: description
                });
            }
        }
        
        console.log(`有效方案数: ${allSchemes.length} / ${allCombinations.length}`);
        return allSchemes;
    }

    /**
     * 为特定的组合生成方案
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Array} combination - 位置组合
     * @param {Object} playAreaAnalysis - 播放区域分析结果
     * @param {number} averageCharSize - 平均字符大小
     * @param {boolean} canUseBlackBars - 是否可以使用黑边
     * @param {Object} videoInfo - 视频信息
     * @param {Object} elementAnalysis - 元素分析结果
     * @param {Object} elementPositionAnalyzer - 元素位置分析器实例
     * @returns {Object|null} 生成的方案或null
     */
    generateSchemeForCombination(elementsToAdd, combination, playAreaAnalysis, averageCharSize, canUseBlackBars, videoInfo, elementAnalysis, elementPositionAnalyzer) {
        const scheme = {};
        const addedElements = [];
        
        // 逐个生成元素并检查重叠
        for (let i = 0; i < elementsToAdd.length; i++) {
            const elementType = elementsToAdd[i];
            const combo = combination[i];
            
            const elementInfo = elementPositionAnalyzer.generateElementAtFixedPosition(
                elementType,
                combo.position,
                playAreaAnalysis,
                averageCharSize,
                canUseBlackBars,
                videoInfo,
                combo.orientation,
                combo.borderType
            );
            
            if (!elementInfo) {
                return null; // 无法生成元素信息
            }
            
            // 检查当前元素是否与已有元素和之前添加的新元素重叠
            const hasOverlap = elementPositionAnalyzer.checkElementOverlap(elementInfo.bbox, elementAnalysis, addedElements);
            if (hasOverlap) {
                return null; // 有重叠，方案无效
            }
            
            scheme[elementType] = elementInfo;
            addedElements.push({ bbox: elementInfo.bbox, type: elementType });
        }
        
        return scheme;
    }

    /**
     * 生成方案描述
     * @param {Array} elementsToAdd - 需要添加的元素列表
     * @param {Array} combination - 位置组合
     * @returns {string} 方案描述
     */
    generateSchemeDescription(elementsToAdd, combination) {
        const descriptions = elementsToAdd.map((elementType, index) => {
            const combo = combination[index];
            return `${elementType}:${combo.position}-${combo.orientation}`;
        });
        return descriptions.join(', ');
    }

    /**
     * 从所有方案中随机选择指定数量的方案
     * @param {Array} allCombinations - 所有有效方案
     * @param {number} maxResults - 最大选择数量
     * @returns {Array} 随机选择的方案
     */
    selectRandomSuggestions(allCombinations, maxResults) {
        if (allCombinations.length <= maxResults) {
            return allCombinations; // 如果总数不超过要求数量，返回全部
        }
        
        // 随机打乱数组并取前maxResults个
        const shuffled = [...allCombinations];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled.slice(0, maxResults);
    }

    /**
     * 计算多个数组的笛卡尔积
     * @param {Array} arrays - 数组的数组
     * @returns {Array} 笛卡尔积结果
     */
    cartesianProduct(arrays) {
        if (arrays.length === 0) return [];
        if (arrays.length === 1) return arrays[0].map(item => [item]);
        
        const result = [];
        const [first, ...rest] = arrays;
        const restProduct = this.cartesianProduct(rest);
        
        for (const firstItem of first) {
            for (const restItem of restProduct) {
                result.push([firstItem, ...restItem]);
            }
        }
        
        return result;
    }
}

module.exports = PositionCombinationGenerator;