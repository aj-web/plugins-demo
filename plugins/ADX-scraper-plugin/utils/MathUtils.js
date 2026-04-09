/**
 * MathUtils - 数学工具类
 * 提供NumPy等效的数值计算功能
 */

const { Matrix } = require('ml-matrix');

class MathUtils {
  /**
   * 计算数组的平均值
   * @param {Array} arr - 输入数组
   * @returns {number} 平均值
   */
  static mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * 计算数组的标准差
   * @param {Array} arr - 输入数组
   * @returns {number} 标准差
   */
  static std(arr) {
    if (!arr || arr.length === 0) return 0;
    const mean = this.mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * 计算数组的最大值
   * @param {Array} arr - 输入数组
   * @returns {number} 最大值
   */
  static max(arr) {
    if (!arr || arr.length === 0) return 0;
    return Math.max(...arr);
  }

  /**
   * 计算数组的最小值
   * @param {Array} arr - 输入数组
   * @returns {number} 最小值
   */
  static min(arr) {
    if (!arr || arr.length === 0) return 0;
    return Math.min(...arr);
  }

  /**
   * 计算数组的总和
   * @param {Array} arr - 输入数组
   * @returns {number} 总和
   */
  static sum(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0);
  }

  /**
   * 创建指定范围的数组 (类似numpy.arange)
   * @param {number} start - 起始值
   * @param {number} stop - 结束值
   * @param {number} step - 步长
   * @returns {Array} 数组
   */
  static arange(start, stop, step = 1) {
    const result = [];
    for (let i = start; i < stop; i += step) {
      result.push(i);
    }
    return result;
  }

  /**
   * 创建等间距数组 (类似numpy.linspace)
   * @param {number} start - 起始值
   * @param {number} stop - 结束值
   * @param {number} num - 元素个数
   * @returns {Array} 数组
   */
  static linspace(start, stop, num) {
    if (num <= 1) return [start];
    const step = (stop - start) / (num - 1);
    return Array.from({ length: num }, (_, i) => start + i * step);
  }

  /**
   * 创建全零数组
   * @param {number} length - 数组长度
   * @returns {Array} 全零数组
   */
  static zeros(length) {
    return new Array(length).fill(0);
  }

  /**
   * 创建全一数组
   * @param {number} length - 数组长度
   * @returns {Array} 全一数组
   */
  static ones(length) {
    return new Array(length).fill(1);
  }

  /**
   * 数组元素级别的绝对值
   * @param {Array} arr - 输入数组
   * @returns {Array} 绝对值数组
   */
  static abs(arr) {
    return arr.map(val => Math.abs(val));
  }

  /**
   * 数组元素级别的平方
   * @param {Array} arr - 输入数组
   * @returns {Array} 平方数组
   */
  static square(arr) {
    return arr.map(val => val * val);
  }

  /**
   * 数组元素级别的平方根
   * @param {Array} arr - 输入数组
   * @returns {Array} 平方根数组
   */
  static sqrt(arr) {
    return arr.map(val => Math.sqrt(val));
  }

  /**
   * 计算两个数组的差值 (类似numpy.diff)
   * @param {Array} arr - 输入数组
   * @returns {Array} 差值数组
   */
  static diff(arr) {
    if (!arr || arr.length < 2) return [];
    const result = [];
    for (let i = 1; i < arr.length; i++) {
      result.push(arr[i] - arr[i - 1]);
    }
    return result;
  }

  /**
   * 计算累积和 (类似numpy.cumsum)
   * @param {Array} arr - 输入数组
   * @returns {Array} 累积和数组
   */
  static cumsum(arr) {
    if (!arr || arr.length === 0) return [];
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(result[i - 1] + arr[i]);
    }
    return result;
  }

  /**
   * 数组排序并返回索引 (类似numpy.argsort)
   * @param {Array} arr - 输入数组
   * @param {boolean} ascending - 是否升序
   * @returns {Array} 排序索引数组
   */
  static argsort(arr, ascending = true) {
    const indices = Array.from({ length: arr.length }, (_, i) => i);
    indices.sort((a, b) => {
      const diff = arr[a] - arr[b];
      return ascending ? diff : -diff;
    });
    return indices;
  }

  /**
   * 查找数组中满足条件的元素索引 (类似numpy.where)
   * @param {Array} arr - 输入数组
   * @param {Function} condition - 条件函数
   * @returns {Array} 满足条件的索引数组
   */
  static where(arr, condition) {
    const indices = [];
    for (let i = 0; i < arr.length; i++) {
      if (condition(arr[i], i)) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * 计算百分位数 (类似numpy.percentile)
   * @param {Array} arr - 输入数组
   * @param {number} percentile - 百分位数 (0-100)
   * @returns {number} 百分位数值
   */
  static percentile(arr, percentile) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * 矩阵乘法
   * @param {Array|Matrix} a - 矩阵A
   * @param {Array|Matrix} b - 矩阵B
   * @returns {Matrix} 乘积矩阵
   */
  static matmul(a, b) {
    const matA = Array.isArray(a) ? new Matrix(a) : a;
    const matB = Array.isArray(b) ? new Matrix(b) : b;
    return matA.mmul(matB);
  }

  /**
   * 计算协方差矩阵
   * @param {Array} data - 数据矩阵
   * @returns {Matrix} 协方差矩阵
   */
  static cov(data) {
    const matrix = new Matrix(data);
    return matrix.covariance();
  }

  /**
   * 计算相关系数矩阵
   * @param {Array} data - 数据矩阵
   * @returns {Matrix} 相关系数矩阵
   */
  static corrcoef(data) {
    const matrix = new Matrix(data);
    return matrix.correlation();
  }

  /**
   * 数组重塑 (类似numpy.reshape)
   * @param {Array} arr - 一维数组
   * @param {number} rows - 行数
   * @param {number} cols - 列数
   * @returns {Array} 二维数组
   */
  static reshape(arr, rows, cols) {
    if (arr.length !== rows * cols) {
      throw new Error('Array length must equal rows * cols');
    }
    
    const result = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push(arr[i * cols + j]);
      }
      result.push(row);
    }
    return result;
  }

  /**
   * 数组展平 (类似numpy.flatten)
   * @param {Array} arr - 多维数组
   * @returns {Array} 一维数组
   */
  static flatten(arr) {
    return arr.flat(Infinity);
  }

  /**
   * 计算两个数组的欧几里得距离
   * @param {Array} a - 数组A
   * @param {Array} b - 数组B
   * @returns {number} 欧几里得距离
   */
  static euclideanDistance(a, b) {
    if (a.length !== b.length) {
      throw new Error('Arrays must have the same length');
    }
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * 计算数组的中位数
   * @param {Array} arr - 输入数组
   * @returns {number} 中位数
   */
  static median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
}

module.exports = MathUtils;