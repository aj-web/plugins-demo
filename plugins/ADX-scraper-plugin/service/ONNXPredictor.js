/**
 * ONNX预测器 - Node.js版本
 * 使用onnxruntime-web进行YOLO模型推理
 */

const ort = require('onnxruntime-web');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

class ONNXPredictor {
  constructor(modelPath, options = {}) {
    this.modelPath = modelPath;
    this.confThreshold = options.confThreshold || 0.25;
    this.iouThreshold = options.iouThreshold || 0.45;
    this.inputSize = options.inputSize || [640, 640];
    
    // YOLO类别名称
    this.classNames = {
      0: '剧名',
      1: '标题', 
      2: '角标',
      3: '警示语',
      4: '对白旁白',
      5: '引导语',
      6: '水印',
      7: '动态效果',
      8: '其它'
    };
    
    // 颜色映射
    this.colors = [
      [255, 0, 0],    // 红色 - 剧名
      [0, 255, 0],    // 绿色 - 标题
      [0, 0, 255],    // 蓝色 - 角标
      [255, 255, 0],  // 黄色 - 警示语
      [255, 0, 255],  // 紫色 - 对白旁白
      [0, 255, 255],  // 青色 - 引导语
      [128, 128, 128], // 灰色 - 水印
      [255, 165, 0],  // 橙色 - 动态效果
      [128, 0, 128]   // 紫红色 - 其它
    ];
    
    this.session = null;
    this.initialized = false;
  }

  /**
   * 初始化ONNX模型
   */
  async initialize() {
    try {
      console.log(`正在加载ONNX模型: ${this.modelPath}`);
      
      // 检查模型文件是否存在
      if (!fs.existsSync(this.modelPath)) {
        throw new Error(`ONNX模型文件不存在: ${this.modelPath}`);
      }
      
      // 创建推理会话
      this.session = await ort.InferenceSession.create(this.modelPath);
      
      console.log('ONNX模型加载成功');
      console.log(`  - 输入名称: ${this.session.inputNames[0]}`);
      console.log(`  - 输出名称: ${this.session.outputNames[0]}`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('ONNX模型初始化失败:', error);
      throw error;
    }
  }

  /**
   * 预处理图像
   * @param {string} imagePath - 图像路径
   * @returns {Object} 预处理结果
   */
  async preprocessImage(imagePath) {
    try {
      // 使用Jimp加载图像
      const image = await Jimp.read(imagePath);
      const originalWidth = image.getWidth();
      const originalHeight = image.getHeight();
      
      // 计算缩放比例，保持宽高比
      const scale = Math.min(
        this.inputSize[0] / originalWidth,
        this.inputSize[1] / originalHeight
      );
      
      const newWidth = Math.round(originalWidth * scale);
      const newHeight = Math.round(originalHeight * scale);
      
      // 调整图像大小
      image.resize(newWidth, newHeight);
      
      // 创建640x640的画布，填充黑色
      const canvas = new Jimp(this.inputSize[0], this.inputSize[1], 0x000000ff);
      
      // 计算居中位置
      const offsetX = Math.floor((this.inputSize[0] - newWidth) / 2);
      const offsetY = Math.floor((this.inputSize[1] - newHeight) / 2);
      
      // 将调整后的图像粘贴到画布中心
      canvas.composite(image, offsetX, offsetY);
      
      // 转换为RGB数组并归一化
      const imageData = [];
      for (let y = 0; y < this.inputSize[1]; y++) {
        for (let x = 0; x < this.inputSize[0]; x++) {
          const pixel = Jimp.intToRGBA(canvas.getPixelColor(x, y));
          imageData.push(pixel.r / 255.0); // R
          imageData.push(pixel.g / 255.0); // G
          imageData.push(pixel.b / 255.0); // B
        }
      }
      
      // 重新排列为CHW格式 (3, 640, 640)
      const chw = new Float32Array(3 * this.inputSize[0] * this.inputSize[1]);
      const pixelCount = this.inputSize[0] * this.inputSize[1];
      
      for (let i = 0; i < pixelCount; i++) {
        chw[i] = imageData[i * 3];                    // R channel
        chw[i + pixelCount] = imageData[i * 3 + 1];   // G channel
        chw[i + pixelCount * 2] = imageData[i * 3 + 2]; // B channel
      }
      
      return {
        tensor: chw,
        scale: scale,
        offset: [offsetX, offsetY],
        originalSize: [originalWidth, originalHeight]
      };
    } catch (error) {
      console.error('图像预处理失败:', error);
      throw error;
    }
  }

  /**
   * 后处理模型输出
   * @param {Float32Array} output - 模型输出
   * @param {number} scale - 缩放比例
   * @param {Array} offset - 偏移量
   * @param {Array} originalSize - 原始图像尺寸
   * @returns {Array} 检测结果
   */
  postprocessOutput(output, scale, offset, originalSize) {
    const detections = [];
    
    // 模型输出格式: [1, 13, 8400] -> 重塑为 [13, 8400]
    // 前4行是边界框坐标，后9行是类别概率
    const numClasses = 9; // 我们的模型有9个类别
    const numDetections = 8400; // YOLOv8的检测数量
    
    // 重塑输出数据
    const bboxData = [];
    const clsData = [];
    
    // 提取边界框数据 (前4行)
    for (let i = 0; i < 4; i++) {
      bboxData.push(output.slice(i * numDetections, (i + 1) * numDetections));
    }
    
    // 提取类别数据 (后9行)
    for (let i = 0; i < numClasses; i++) {
      clsData.push(output.slice((4 + i) * numDetections, (4 + i + 1) * numDetections));
    }
    
    // 处理每个检测
    for (let i = 0; i < numDetections; i++) {
      // 获取边界框坐标 (中心点格式)
      const centerX = bboxData[0][i];
      const centerY = bboxData[1][i];
      const width = bboxData[2][i];
      const height = bboxData[3][i];
      
      // 获取类别概率
      const classScores = [];
      for (let j = 0; j < numClasses; j++) {
        classScores.push(clsData[j][i]);
      }
      
      // 计算最大类别概率和对应的类别ID
      const maxScore = Math.max(...classScores);
      const classId = classScores.indexOf(maxScore);
      
      // 过滤低置信度检测
      if (maxScore < this.confThreshold) {
        continue;
      }
      
      // 转换为左上角坐标格式
      const x1 = centerX - width / 2;
      const y1 = centerY - height / 2;
      const x2 = centerX + width / 2;
      const y2 = centerY + height / 2;
      
      // 转换回原始图像坐标
      const originalX1 = (x1 - offset[0]) / scale;
      const originalY1 = (y1 - offset[1]) / scale;
      const originalX2 = (x2 - offset[0]) / scale;
      const originalY2 = (y2 - offset[1]) / scale;
      
      // 限制边界框在图像范围内
      const clampedX1 = Math.max(0, Math.min(originalSize[0], originalX1));
      const clampedY1 = Math.max(0, Math.min(originalSize[1], originalY1));
      const clampedX2 = Math.max(0, Math.min(originalSize[0], originalX2));
      const clampedY2 = Math.max(0, Math.min(originalSize[1], originalY2));
      
      detections.push({
        bbox: [
          Math.round(clampedX1),
          Math.round(clampedY1),
          Math.round(clampedX2),
          Math.round(clampedY2)
        ],
        confidence: maxScore,
        classId: classId,
        className: this.classNames[classId] || '未知'
      });
    }
    
    // 应用非极大值抑制
    return this.nonMaxSuppression(detections);
  }

  /**
   * 非极大值抑制
   * @param {Array} detections - 检测结果
   * @returns {Array} 过滤后的检测结果
   */
  nonMaxSuppression(detections) {
    // 按置信度排序
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const keep = [];
    const suppressed = new Set();
    
    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;
      
      keep.push(detections[i]);
      
      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;
        
        const iou = this.calculateIoU(detections[i].bbox, detections[j].bbox);
        if (iou > this.iouThreshold) {
          suppressed.add(j);
        }
      }
    }
    
    return keep;
  }

  /**
   * 计算IoU
   * @param {Array} box1 - 边界框1 [x1, y1, x2, y2]
   * @param {Array} box2 - 边界框2 [x1, y1, x2, y2]
   * @returns {number} IoU值
   */
  calculateIoU(box1, box2) {
    const x1 = Math.max(box1[0], box2[0]);
    const y1 = Math.max(box1[1], box2[1]);
    const x2 = Math.min(box1[2], box2[2]);
    const y2 = Math.min(box1[3], box2[3]);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * 预测单张图像
   * @param {string} imagePath - 图像路径
   * @returns {Object} 预测结果
   */
  async predict(imagePath) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      
      // 预处理图像
      const preprocessResult = await this.preprocessImage(imagePath);
      
      // 创建输入张量
      const inputTensor = new ort.Tensor('float32', preprocessResult.tensor, [1, 3, 640, 640]);
      
      // 运行推理
      const feeds = {};
      feeds[this.session.inputNames[0]] = inputTensor;
      const results = await this.session.run(feeds);
      
      // 获取输出
      const output = results[this.session.outputNames[0]].data;
      
      // 后处理
      const detections = this.postprocessOutput(
        output,
        preprocessResult.scale,
        preprocessResult.offset,
        preprocessResult.originalSize
      );
      
      const endTime = Date.now();
      const inferenceTime = endTime - startTime;
      
      return {
        detections: detections,
        inferenceTime: inferenceTime,
        imageSize: preprocessResult.originalSize,
        detectionCount: detections.length
      };
    } catch (error) {
      console.error('预测失败:', error);
      throw error;
    }
  }



  /**
   * 清理资源
   */
  async cleanup() {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.initialized = false;
  }
}

module.exports = ONNXPredictor;