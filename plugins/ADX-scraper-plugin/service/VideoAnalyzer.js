/**
 * 视频分析器 - Node.js版本
 * 使用FFmpeg和纯JavaScript库替代OpenCV
 */

const Jimp = require('jimp');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { spawn } = require('child_process');
const crypto = require('crypto');

const MathUtils = require('../utils/MathUtils');
const HeatmapComputer = require('../algorithms/HeatmapComputer');
const TailDetector = require('../algorithms/TailDetector');
const VisualizationGenerator = require('./VisualizationGenerator');
const ElementPositionAnalyzer = require('./ElementPositionAnalyzer');


const ONNXPredictor = require('./ONNXPredictor');

class VideoAnalyzer {
  constructor(videoPath = null, outputDir = null, options = {}) {
        this.videoPath = videoPath;
        this.outputDir = outputDir || (videoPath ? path.join(path.dirname(videoPath), 'analysis_output') : path.join(__dirname, '..', 'analysis_output'));
        this.frames = [];
        this.videoInfo = null;
        this.heatmapComputer = new HeatmapComputer();
    this.tailDetector = new TailDetector();
    this.visualizationGenerator = new VisualizationGenerator(this.outputDir);
    this.elementPositionAnalyzer = new ElementPositionAnalyzer(this.outputDir);

    this.frames = null;  
        
        // 生成唯一的会话ID，用于并发安全
        this.sessionId = crypto.randomUUID();
        this.tempDirName = `temp_frames_${this.sessionId}`;
        
        // 初始化ONNX预测器（如果提供了模型路径）
        this.onnxPredictor = null;
        this.enableONNXDetection = options.enableONNXDetection || false;
        this.onnxModelPath = options.onnxModelPath || path.join(__dirname, '../../models/yolo/weights/best.onnx');
        
        // 确保输出目录存在
        this.ensureOutputDir();
    }

  /**
   * 确保输出目录存在
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 初始化ONNX预测器
   */
  async initializeONNXPredictor() {
    if (!this.enableONNXDetection) {
      return false;
    }

    try {
      console.log('正在初始化ONNX预测器...');
      this.onnxPredictor = new ONNXPredictor(this.onnxModelPath, {
        confThreshold: 0.25,
        iouThreshold: 0.45
      });
      
      await this.onnxPredictor.initialize();
      console.log('ONNX预测器初始化成功');
      return true;
    } catch (error) {
      console.error('ONNX预测器初始化失败:', error);
      this.enableONNXDetection = false;
      return false;
    }
  }



   /**
    * 从内存中的帧数据执行ONNX检测
    * @param {Array} frameData - 内存中的帧数据数组
    * @param {Object} playAreaAnalysis - 播放区域分析结果
    */
   async performONNXDetectionFromMemory(frameData, playAreaAnalysis = null) {
     try {
       // 选择第1、25、50帧（索引0、24、49）
       const selectedIndices = [0, 24, 49];
       const detectionResults = [];
       const tempDir = path.join(this.outputDir, this.tempDirName);
       
       if (!fs.existsSync(tempDir)) {
         fs.mkdirSync(tempDir, { recursive: true });
       }

       for (const index of selectedIndices) {
         if (index >= frameData.length) {
           console.warn(`跳过索引 ${index}，超出帧数范围 (${frameData.length})`);
           continue;
         }

         const frame = frameData[index];
         const frameNumber = index + 1; // 显示为1-based索引
         
         // 创建临时文件用于ONNX检测
         const tempFramePath = path.join(tempDir, `temp_onnx_frame_${frameNumber}.png`);
         
         try {
           // 将内存中的图像保存为临时文件
           await frame.image.writeAsync(tempFramePath);
           
           console.log(`正在检测第 ${frameNumber} 帧 (内存模式)...`);
           
           // 进行ONNX检测
           const predictions = await this.onnxPredictor.predict(tempFramePath);
           
           // 如果有播放区域信息，判断检测到的元素是否在播放区域内
           let processedDetections = predictions;
           if (playAreaAnalysis && playAreaAnalysis.contentArea && predictions.detections) {
             processedDetections = this.filterDetectionsByPlayArea(predictions, playAreaAnalysis.contentArea);
           }
           
           detectionResults.push({
             frameNumber: frameNumber,
             frameIndex: index,
             framePath: frame.path, // 使用虚拟路径
             detections: processedDetections,
             detectionCount: processedDetections.detectionCount || processedDetections.detections?.length || 0,
             playAreaFiltered: playAreaAnalysis ? true : false
           });

           console.log(`第 ${frameNumber} 帧检测到 ${predictions.detectionCount || predictions.detections?.length || 0} 个目标`);
           
           // 删除临时文件
           fs.unlinkSync(tempFramePath);
         } catch (error) {
           console.warn(`处理第 ${frameNumber} 帧时出错:`, error.message);
           // 确保删除临时文件
           if (fs.existsSync(tempFramePath)) {
             fs.unlinkSync(tempFramePath);
           }
         }
       }

       return {
         totalFramesAnalyzed: detectionResults.length,
         selectedFrames: selectedIndices.map(i => i + 1), // 1-based索引
         results: detectionResults,
         summary: {
           totalDetections: detectionResults.reduce((sum, result) => sum + result.detectionCount, 0),
           averageDetectionsPerFrame: detectionResults.length > 0 ? 
             detectionResults.reduce((sum, result) => sum + result.detectionCount, 0) / detectionResults.length : 0
         }
       };
     } catch (error) {
       console.error('内存模式ONNX检测过程中出错:', error);
       return null;
     }
   }

   /**
    * 根据播放区域过滤ONNX检测结果
    * @param {Object} predictions - ONNX检测结果
    * @param {Object} contentArea - 播放区域信息
    * @returns {Object} 过滤后的检测结果
    */
   filterDetectionsByPlayArea(predictions, contentArea) {
     if (!predictions.detections || !Array.isArray(predictions.detections)) {
       return predictions;
     }

     const filteredDetections = predictions.detections.filter(detection => {
       // 检查检测框是否与播放区域有重叠
       const detectionBox = {
         x1: detection.x1 || detection.bbox?.[0] || 0,
         y1: detection.y1 || detection.bbox?.[1] || 0,
         x2: detection.x2 || detection.bbox?.[2] || 0,
         y2: detection.y2 || detection.bbox?.[3] || 0
       };

       // 计算检测框中心点
       const centerX = (detectionBox.x1 + detectionBox.x2) / 2;
       const centerY = (detectionBox.y1 + detectionBox.y2) / 2;

       // 判断中心点是否在播放区域内
       const isInPlayArea = centerX >= contentArea.x && 
                           centerX <= contentArea.x + contentArea.width &&
                           centerY >= contentArea.y && 
                           centerY <= contentArea.y + contentArea.height;

       // 添加位置标记
       detection.inPlayArea = isInPlayArea;
       detection.position = isInPlayArea ? 'play_area' : 'border_area';

       return true; // 保留所有检测结果，但添加位置标记
     });

     return {
       ...predictions,
       detections: filteredDetections,
       detectionCount: filteredDetections.length,
       playAreaStats: {
         totalDetections: filteredDetections.length,
         inPlayArea: filteredDetections.filter(d => d.inPlayArea).length,
         inBorderArea: filteredDetections.filter(d => !d.inPlayArea).length
       }
     };
   }

   /**
    * 获取视频信息
   * @returns {Promise<Object>} 视频信息
   */
  async getVideoInfo(videoPath = null) {
    const targetPath = videoPath || this.videoPath;
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(targetPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video info: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const info = {
          duration: parseFloat(metadata.format.duration) || 0,
          fps: eval(videoStream.r_frame_rate) || 30,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          totalFrames: Math.floor((parseFloat(metadata.format.duration) || 0) * (eval(videoStream.r_frame_rate) || 30)),
          format: metadata.format.format_name || 'unknown',
          codec: videoStream.codec_name || 'unknown',
          bitrate: parseInt(metadata.format.bit_rate) || 0,
          size: parseInt(metadata.format.size) || 0
        };

        this.videoInfo = info;
        resolve(info);
      });
    });
  }

  /**
   * 视频预检查
   * @param {string} videoPath - 视频路径
   * @returns {Promise<Object>} 预检查结果
   */
  async precheck(videoPath = null) {
    const targetPath = videoPath || this.videoPath;
    console.log('Starting video precheck...');

    try {
      // 检查文件是否存在
      if (!fs.existsSync(targetPath)) {
        return {
          isValid: false,
          canProcess: false,
          errors: ['Video file does not exist'],
          warnings: [],
          videoInfo: null
        };
      }

      // 获取视频信息
      const videoInfo = await this.getVideoInfo(targetPath);
      
      const errors = [];
      const warnings = [];

      // 基本验证
      if (videoInfo.duration <= 0) {
        errors.push('Invalid video duration');
      }
      if (videoInfo.width <= 0 || videoInfo.height <= 0) {
        errors.push('Invalid video dimensions');
      }
      if (videoInfo.totalFrames <= 0) {
        errors.push('No frames detected');
      }

      // 警告检查
      if (videoInfo.duration < 1) {
        warnings.push('Video is very short (< 1 second)');
      }
      if (videoInfo.fps < 10) {
        warnings.push('Low frame rate detected');
      }
      if (videoInfo.width < 320 || videoInfo.height < 240) {
        warnings.push('Low resolution video');
      }

      const isValid = errors.length === 0;
      const canProcess = isValid && videoInfo.totalFrames > 0;

      return {
        isValid,
        canProcess,
        errors,
        warnings,
        videoInfo
      };

    } catch (error) {
      console.error('Precheck failed:', error.message);
      return {
        isValid: false,
        canProcess: false,
        errors: [error.message],
        warnings: [],
        videoInfo: null
      };
    }
  }

  /**
   * 使用FFmpeg提取视频帧（智能采样策略）
   * @param {number} maxFrames - 最大帧数，默认50帧
   * @param {string} videoPath - 视频路径
   * @param {Object} options - 采样选项
   * @returns {Promise<Array>} 帧文件路径数组
   */
  async extractFrames(maxFrames = 50, videoPath = null, options = {}) {
    console.log('Starting intelligent frame extraction with FFmpeg...');
    
    const targetPath = videoPath || this.videoPath;
    if (!targetPath) {
      throw new Error('Video path is required for frame extraction');
    }
    
    const {
      startPercent = 0.1,  // 从10%开始采样，避免片头
      endPercent = 0.8,    // 到80%结束采样，避免片尾
      samplingStrategy = 'uniform'  // 采样策略：uniform(均匀) 或 smart(智能)
    } = options;
    
    const tempDir = path.join(this.outputDir, this.tempDirName);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 获取视频信息以计算采样点
    const videoInfo = await this.getVideoInfo(targetPath);
    const totalDuration = videoInfo.duration;
    const fps = videoInfo.fps || 25;
    
    const startTime = totalDuration * startPercent;
    const endTime = totalDuration * endPercent;
    const samplingDuration = endTime - startTime;
    
    console.log(`Video duration: ${totalDuration}s, sampling from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
    
    return new Promise((resolve, reject) => {
      let command;
      
      if (samplingStrategy === 'smart' && maxFrames <= 10) {
        // 智能采样：少量关键帧
        const interval = samplingDuration / (maxFrames - 1);
        const timePoints = [];
        for (let i = 0; i < maxFrames; i++) {
          timePoints.push(startTime + i * interval);
        }
        
        // 使用select过滤器精确提取指定时间点的帧
        const selectFilter = timePoints.map((t, i) => `eq(t,${t.toFixed(3)})`).join('+');
        command = ffmpeg(targetPath)
          .output(path.join(tempDir, 'frame_%06d.png'))
          .outputOptions([
            '-vf', `select='${selectFilter}'`,
            '-vsync', 'vfr',
            '-f', 'image2'
          ]);
      } else {
        // 均匀采样：使用fps过滤器
        const targetFps = Math.min(maxFrames / samplingDuration, fps / 2);
        command = ffmpeg(targetPath)
          .output(path.join(tempDir, 'frame_%06d.png'))
          .outputOptions([
            '-ss', startTime.toString(),
            '-t', samplingDuration.toString(),
            '-vf', `fps=${targetFps.toFixed(3)}`,
            '-f', 'image2'
          ]);
        
        // 限制最大帧数
        if (maxFrames) {
          command = command.outputOptions(['-vframes', maxFrames.toString()]);
        }
      }

      command
        .on('end', () => {
          // 获取生成的帧文件列表
          const frameFiles = fs.readdirSync(tempDir)
            .filter(file => file.startsWith('frame_') && file.endsWith('.png'))
            .sort()
            .map(file => path.join(tempDir, file));
          
          console.log(`Extracted ${frameFiles.length} frames using ${samplingStrategy} sampling`);
          resolve(frameFiles);
        })
        .on('error', (err) => {
          console.error('Frame extraction failed:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * 直接提取帧到内存中（不写入文件系统）
   * @param {number} maxFrames - 最大帧数，默认50帧
   * @param {string} videoPath - 视频路径
   * @param {Object} options - 采样选项
   * @returns {Promise<Array>} 帧图像数据数组
   */
  async extractFramesToMemory(maxFrames = 50, videoPath = null, options = {}) {
    console.log('Starting direct frame extraction to memory...');
    
    const targetPath = videoPath || this.videoPath;
    if (!targetPath) {
      throw new Error('Video path is required for frame extraction');
    }
    
    const {
      startPercent = 0.1,  // 从10%开始采样，避免片头
      endPercent = 0.8,    // 到80%结束采样，避免片尾
      samplingStrategy = 'uniform'  // 采样策略：uniform(均匀) 或 smart(智能)
    } = options;

    // 创建临时目录（使用不同的前缀避免冲突）
    const tempDir = path.join(this.outputDir, this.tempDirName);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 使用唯一的文件名前缀避免与其他提取操作冲突
    const uniquePrefix = `memory_${Date.now()}_`;

    // 获取视频信息以计算采样点
    const videoInfo = await this.getVideoInfo(targetPath);
    const totalDuration = videoInfo.duration;
    const fps = videoInfo.fps || 25;
    
    const startTime = totalDuration * startPercent;
    const endTime = totalDuration * endPercent;
    const samplingDuration = endTime - startTime;
    
    console.log(`Video duration: ${totalDuration}s, sampling from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
    
    return new Promise((resolve, reject) => {
      let command;
      
      if (samplingStrategy === 'smart' && maxFrames <= 10) {
        // 智能采样：少量关键帧
        const interval = samplingDuration / (maxFrames - 1);
        const timePoints = [];
        for (let i = 0; i < maxFrames; i++) {
          timePoints.push(startTime + i * interval);
        }
        
        // 使用select过滤器精确提取指定时间点的帧
        const selectFilter = timePoints.map((t, i) => `eq(t,${t.toFixed(3)})`).join('+');
        command = ffmpeg(targetPath)
          .output(path.join(tempDir, `${uniquePrefix}frame_%06d.png`))
          .outputOptions([
            '-vf', `select='${selectFilter}'`,
            '-vsync', 'vfr',
            '-f', 'image2'
          ]);
      } else {
        // 均匀采样：使用fps过滤器
        const targetFps = Math.min(maxFrames / samplingDuration, fps / 2);
        command = ffmpeg(targetPath)
          .output(path.join(tempDir, `${uniquePrefix}frame_%06d.png`))
          .outputOptions([
            '-ss', startTime.toString(),
            '-t', samplingDuration.toString(),
            '-vf', `fps=${targetFps.toFixed(3)}`,
            '-f', 'image2'
          ]);
        
        // 限制最大帧数
        if (maxFrames) {
          command = command.outputOptions(['-vframes', maxFrames.toString()]);
        }
      }

      command
        .on('end', async () => {
          try {
            // 获取生成的帧文件列表
            const frameFiles = fs.readdirSync(tempDir)
              .filter(file => file.startsWith(uniquePrefix) && file.endsWith('.png'))
              .sort()
              .map(file => path.join(tempDir, file));
            
            console.log(`Extracted ${frameFiles.length} frames, loading to memory...`);
            
            // 加载帧数据到内存
            const frameData = [];
            for (let i = 0; i < frameFiles.length; i++) {
              try {
                const image = await Jimp.read(frameFiles[i]);
                frameData.push({
                  path: `memory_frame_${i.toString().padStart(6, '0')}.png`, // 虚拟路径
                  width: image.bitmap.width,
                  height: image.bitmap.height,
                  data: image.bitmap.data,
                  image: image,
                  frameIndex: i,
                  isMemoryFrame: true
                });
              } catch (error) {
                console.warn(`Failed to load frame ${frameFiles[i]}:`, error.message);
              }
            }
            
            // 立即删除临时文件
            for (const file of frameFiles) {
              try {
                fs.unlinkSync(file);
              } catch (error) {
                console.warn(`Failed to delete temporary file ${file}:`, error.message);
              }
            }
            
            console.log(`Loaded ${frameData.length} frames to memory and cleaned up temporary files`);
            resolve(frameData);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('Frame extraction to memory failed:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * 加载帧图像数据
   * @param {Array} framePaths - 帧文件路径数组
   * @returns {Promise<Array>} 帧图像数据数组
   */
  async loadFrameData(framePaths) {
    console.log('Loading frame data...');
    const frameData = [];

    for (let i = 0; i < framePaths.length; i++) {
      try {
        const image = await Jimp.read(framePaths[i]);
        frameData.push({
          path: framePaths[i],
          width: image.bitmap.width,
          height: image.bitmap.height,
          data: image.bitmap.data,
          image: image
        });

        if ((i + 1) % 50 === 0) {
          console.log(`Loaded ${i + 1}/${framePaths.length} frames`);
        }
      } catch (error) {
        console.warn(`Failed to load frame ${framePaths[i]}:`, error.message);
      }
    }

    this.frames = frameData;
    return frameData;
  }

  /**
   * 计算平均图像
   * @param {Array} frames - 帧数据数组
   * @returns {Promise<Object>} 平均图像数据
   */
  async computeAverageImage(frames = null) {
    const targetFrames = frames || this.frames;
    if (!targetFrames || targetFrames.length === 0) {
      throw new Error('No frames available for average computation');
    }

    console.log('Computing average image...');
    
    const firstFrame = targetFrames[0];
    const { width, height } = firstFrame;
    
    // 初始化累加器
    const accumulator = new Array(width * height * 4).fill(0);
    
    // 累加所有帧的像素值
    for (const frame of targetFrames) {
      const data = frame.data;
      for (let i = 0; i < data.length; i++) {
        accumulator[i] += data[i];
      }
    }
    
    // 计算平均值
    const avgData = new Uint8ClampedArray(accumulator.length);
    const frameCount = targetFrames.length;
    for (let i = 0; i < accumulator.length; i++) {
      avgData[i] = Math.round(accumulator[i] / frameCount);
    }
    
    // 创建平均图像
    const avgImage = new Jimp({ data: avgData, width, height });
    
    return {
      image: avgImage,
      width,
      height,
      frameCount
    };
  }

  /**
   * 执行完整的视频分析
   * @param {string} videoPath - 视频路径
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyze(videoPath = null, options = {}) {
    const targetPath = videoPath || this.videoPath;
    const {
      maxFrames = 50,
      heatmapThreshold = 0.1,
      skipPrecheck = false,
      outputDir = null,
      tailDuration = 10,
      multiplier = 3,
      samplingStrategy = 'uniform',
      startPercent = 0.1,
      endPercent = 0.8,
      maxSchemes = 5,
      generateIntermediateFiles = true
    } = options;

    if (outputDir) {
      this.outputDir = outputDir;
      this.ensureOutputDir();
    }

    console.log(`Starting video analysis: ${targetPath}`);
    const startTime = Date.now();

    try {
      // 预检查（如果未跳过）
      let precheckResult = null;
      if (!skipPrecheck) {
        precheckResult = await this.precheck(targetPath);
        if (!precheckResult.canProcess) {
          throw new Error(`Video cannot be processed: ${precheckResult.errors.join(', ')}`);
        }
      }

      // 获取视频信息
      const videoInfo = await this.getVideoInfo(targetPath);
      
      // 初始化ONNX预测器（如果启用）
      await this.initializeONNXPredictor();
      
      // 提取帧 - 专门为平均图和稳定性掩码计算提取50帧（从10%到80%位置）
      // 使用内存方式避免与尾帧检测的80帧文件冲突
      const framesForAverageAndStability = await this.extractFramesToMemory(50, targetPath, {
        samplingStrategy: 'uniform',
        startPercent: 0.1,  // 从10%开始
        endPercent: 0.8     // 到80%结束
      });
      
      if (framesForAverageAndStability.length === 0) {
        throw new Error('No frames could be extracted from video for average and stability calculation');
      }

      console.log(`使用从10%到80%位置均匀提取的${framesForAverageAndStability.length}帧数据计算平均图和稳定性掩码（内存模式）`);

      // 计算平均图像
      const avgImageResult = await this.computeAverageImage(framesForAverageAndStability);
      
      // 使用播放区域检测算法 - 使用相同的50帧数据
      console.log('检测播放区域...');
      const playAreaResult = await this.elementPositionAnalyzer.calculatePlayAreaWithDetection(videoInfo, framesForAverageAndStability);
      
      // 使用简化后的playAreaAnalysis结构
      const playAreaAnalysis = playAreaResult;
      
      // 计算稳定性掩码（替代热力图）- 使用相同的50帧数据
      const stabilityMaskResult = await this.heatmapComputer.computeStabilityHeatmap(framesForAverageAndStability);
      
      // 为尾帧检测单独提取最后8秒的帧，每秒10帧（共80帧）
      console.log('Extracting frames for tail detection (last 8 seconds, 10fps)...');
      const tailFramePaths = await this.extractFrames(80, targetPath, {
        samplingStrategy: 'uniform',
        startPercent: Math.max(0, (videoInfo.duration - 8) / videoInfo.duration), // 最后8秒
        endPercent: 1.0 // 到视频结束
      });
      const tailFrames = await this.loadFrameData(tailFramePaths);
      
      // 尾帧检测（基于掩码）- 使用新的检测频率
      const tailDetectionResult = await this.tailDetector.detectTailFrameImproved(
        tailFrames,
        stabilityMaskResult,
        {
          fps: 10, // 每秒10帧的检测频率
          tailDuration: 8, // 最后8秒
          multiplier: multiplier,
          videoDuration: videoInfo.duration,
          videoTotalFrames: videoInfo.totalFrames,
          originalFps: videoInfo.fps, // 传递原始fps用于帧索引转换
          outputDir: this.outputDir, // 添加输出目录参数
          averageImage: new Uint8ClampedArray(avgImageResult.image.bitmap.data), // 转换为正确的数据格式
          detectionFrequency: 10 // 每秒检测10帧
        }
      );
      
      // 执行ONNX检测（如果启用）
      let onnxDetectionResult = null;
      if (this.enableONNXDetection) {
        console.log('开始ONNX目标检测...');
        onnxDetectionResult = await this.performONNXDetectionFromMemory(framesForAverageAndStability, playAreaAnalysis);
      }
      
      // 执行元素位置分析（如果有ONNX检测结果）
      let elementPositionAnalysis = null;
      if (onnxDetectionResult) {
        console.log('开始元素位置分析...');
        
        // 1. 分析三帧检测结果
        const elementAnalysis = this.elementPositionAnalyzer.analyzeThreeFrameDetections(onnxDetectionResult);
        
        // 2. 使用新的Python算法播放区域检测结果（已经计算过了）
        const oldPlayAreaAnalysis = playAreaAnalysis;
        
        // 3. 生成第一个图片：平均图+ONNX检测结果
        const avgWithDetectionsPath = await this.elementPositionAnalyzer.generateAverageImageWithDetections(
          avgImageResult, elementAnalysis
        );
        
        // 4. 生成第二个图片：9:16扩展图+播放区域标记
        const extendedWithPlayAreaPath = await this.elementPositionAnalyzer.generateExtendedImageWithPlayArea(
          avgImageResult, elementAnalysis, playAreaAnalysis
        );
        
        // 5. 生成位置建议
        const positionSuggestions = this.elementPositionAnalyzer.generatePositionSuggestions(
          elementAnalysis, playAreaAnalysis, videoInfo, maxSchemes
        );
        
        // 6. 生成推荐方案可视化图 (已移除)
        
        elementPositionAnalysis = {
          elementAnalysis,
          playAreaAnalysis,
          positionSuggestions,
          visualizations: {
            averageWithDetections: avgWithDetectionsPath,
            extendedWithPlayArea: extendedWithPlayAreaPath
          }
        };
        
        console.log('元素位置分析完成');
      }
      
      // 保存结果
      const outputFiles = await this.saveResults({
        videoInfo,
        stabilityMask: stabilityMaskResult,
        tailDetection: tailDetectionResult,
        averageImage: avgImageResult,
        playAreaAnalysis,
        onnxDetection: onnxDetectionResult,
        elementPositionAnalysis
      }, { maxSchemes, generateIntermediateFiles });

      // 清理临时文件
      await this.cleanupTempFiles();

      return {
        success: true,
        videoInfo,
        stabilityMask: stabilityMaskResult,
        tailDetection: tailDetectionResult,
        playAreaAnalysis,
        onnxDetection: onnxDetectionResult,
        elementPositionAnalysis,
        outputFiles,
        precheckResult
      };

    } catch (error) {
      console.error('Analysis failed:', error.message);
      await this.cleanupTempFiles();
      throw error;
    }
  }

  /**
   * 保存分析结果
   * @param {Object} results - 分析结果
   * @param {Object} options - 保存选项
   * @param {number} options.maxSchemes - 最大方案数量
   * @param {boolean} options.generateIntermediateFiles - 是否生成中间文件
   * @returns {Promise<Array>} 输出文件列表
   */
  async saveResults(results, options = {}) {
    const { maxSchemes = 5, generateIntermediateFiles = true } = options;
    console.log('Saving analysis results...');
    const outputFiles = [];

    try {
      // 根据generateIntermediateFiles参数决定是否生成中间文件
      if (generateIntermediateFiles) {
        // 保存平均图像
        if (results.averageImage && results.averageImage.image) {
          const avgImagePath = path.join(this.outputDir, 'average_image.png');
          await results.averageImage.image.writeAsync(avgImagePath);
          outputFiles.push(avgImagePath);
        }

        // 保存稳定性掩码可视化
        if (results.stabilityMask) {
          const stabilityMaskPath = path.join(this.outputDir, 'stability_mask.png');
          await this.saveStabilityMaskVisualization(results.stabilityMask, stabilityMaskPath, results.videoInfo);
          outputFiles.push(stabilityMaskPath);
        }

        // 生成尾帧可视化（如果检测到尾帧）
        if (results.tailDetection && results.tailDetection.hasTail && results.tailDetection.analysisData) {
          try {
            console.log('生成尾帧前后帧可视化...');
            const tailVisualizationPath = await this.visualizationGenerator.generateTailFramesVisualization(
              results.tailDetection.analysisData,
              results.tailDetection.tailStartIdx,
              this.videoPath,
              results.videoInfo
            );
            outputFiles.push(tailVisualizationPath);
            console.log(`尾帧可视化已保存: ${tailVisualizationPath}`);
          } catch (error) {
            console.warn('生成尾帧可视化失败:', error.message);
          }
        }

        // 保存ONNX检测结果到单独的JSON文件
        if (results.onnxDetection) {
          const onnxDetectionPath = path.join(this.outputDir, 'onnx_detection_results.json');
          fs.writeFileSync(onnxDetectionPath, JSON.stringify(results.onnxDetection, null, 2));
          outputFiles.push(onnxDetectionPath);
          console.log(`ONNX检测结果已保存到: ${onnxDetectionPath}`);
        }
        
        // 保存详细的元素位置分析结果到单独的JSON文件
        if (results.elementPositionAnalysis) {
          const elementPositionPath = path.join(this.outputDir, 'element_position_details.json');
          fs.writeFileSync(elementPositionPath, JSON.stringify(results.elementPositionAnalysis, null, 2));
          outputFiles.push(elementPositionPath);
          console.log(`详细的元素位置分析结果已保存到: ${elementPositionPath}`);
        }
      }

      // 保存分析结果JSON - 优化输出结构，只保留关键信息
      const resultsPath = path.join(this.outputDir, 'analysis_results.json');
      
      // 构建优化的JSON结果，只包含关键信息
      const jsonResults = {
        // 1. 视频基本信息
        videoInfo: results.videoInfo,
        
        // 2. 尾帧检测关键信息（移除冗长的analysisData）
        tailDetection: results.tailDetection ? {
          hasTail: results.tailDetection.hasTail,
          confidence: results.tailDetection.confidence,
          tailStartTime: results.tailDetection.tailStartTime,
          tailStartFrame: results.tailDetection.tailStartFrame,
          tailStartIdx: results.tailDetection.tailStartIdx,
          // 保留统计信息，移除逐帧分析数据
          stats: results.tailDetection.stats
          // 注意：移除了 analysisData 字段，该字段包含大量逐帧信息
        } : null,
        
        // 3. 播放区域分析结果
        playAreaAnalysis: results.playAreaAnalysis,
        
        // 4. ONNX检测结果引用（移除详细数据，只保留文件引用）
        onnxDetection: results.onnxDetection ? {
          totalFramesAnalyzed: results.onnxDetection.totalFramesAnalyzed,
          selectedFrames: results.onnxDetection.selectedFrames,
          averageDetectionsPerFrame: results.onnxDetection.averageDetectionsPerFrame,
          ...(generateIntermediateFiles && { detailsFile: 'onnx_detection_results.json' }) // 只有生成中间文件时才包含文件引用
        } : null,
        
        // 5. 元素位置分析和建议（简化版本，移除详细检测数据）
        elementPositionAnalysis: results.elementPositionAnalysis ? {
          elementAnalysis: results.elementPositionAnalysis.elementAnalysis ? {
            // 只保留元素存在性和代表性信息，移除详细的appearances数据
            elements: Object.keys(results.elementPositionAnalysis.elementAnalysis.elements || {}).reduce((simplified, className) => {
              const element = results.elementPositionAnalysis.elementAnalysis.elements[className];
              simplified[className] = {
                classId: element.classId,
                exists: element.exists,
                totalCount: element.totalCount,
                representativeBbox: element.representativeBbox,
                confidence: element.confidence
                // 注意：移除了 appearances 数组，该数组包含大量逐帧检测数据
              };
              return simplified;
            }, {}),
            // 移除frameAnalysis和allDetections，这些包含大量详细数据
            summary: {
              totalElements: Object.keys(results.elementPositionAnalysis.elementAnalysis.elements || {}).length,
              existingElements: Object.values(results.elementPositionAnalysis.elementAnalysis.elements || {}).filter(e => e.exists).length
            }
          } : null,
          playAreaAnalysis: results.elementPositionAnalysis.playAreaAnalysis,
          positionSuggestions: results.elementPositionAnalysis.positionSuggestions ? {
            elementStatus: results.elementPositionAnalysis.positionSuggestions.elementStatus,
            // 保持原始的方案结构，每个方案包含所有需要添加的元素
            suggestions: (() => {
              const originalSuggestions = results.elementPositionAnalysis.positionSuggestions.suggestions || [];
              // 根据maxSchemes参数控制方案数量
              return originalSuggestions.slice(0, maxSchemes).map((suggestion, index) => {
                // 创建新的方案对象，包含所有元素和方案元数据
                const scheme = {};
                
                // 复制所有元素（排除schemeId和description，这些是方案级别的元数据）
                Object.keys(suggestion).forEach(key => {
                  if (!['schemeId', 'description'].includes(key)) {
                    scheme[key] = {
                      bbox: suggestion[key].bbox,
                      fontSize: suggestion[key].fontSize,
                      text: suggestion[key].text,
                      position: suggestion[key].position,
                      orientation: suggestion[key].orientation,
                      base: suggestion[key].base,
                      reason: suggestion[key].reason,
                      margin: suggestion[key].margin
                    };
                  }
                });
                
                // 添加方案级别的元数据
                scheme.schemeId = suggestion.schemeId || `scheme-${index + 1}`;
                scheme.description = suggestion.description || `方案${index + 1}`;
                
                return scheme;
              });
            })(),
            playAreaInfo: results.elementPositionAnalysis.positionSuggestions.playAreaInfo,
            averageCharSize: results.elementPositionAnalysis.positionSuggestions.averageCharSize,
            canUseBlackBars: results.elementPositionAnalysis.positionSuggestions.canUseBlackBars,
            // 只有生成中间文件时才添加引用到详细文件
            ...(generateIntermediateFiles && { detailsFile: 'element_position_details.json' })
          } : null,
          visualizations: results.elementPositionAnalysis.visualizations
        } : null,
        

        
        // 6. 生成时间戳
        generatedAt: new Date().toISOString(),
        
        // 7. 版本信息
        version: "1.0.0"
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(jsonResults, null, 2));
      outputFiles.push(resultsPath);

      console.log(`Results saved to ${outputFiles.length} files`);
      return outputFiles;

    } catch (error) {
      console.error('Failed to save results:', error.message);
      throw error;
    }
  }





  /**
   * 保存稳定性掩码可视化
   * @param {Object} stabilityMask - 稳定性掩码数据
   * @param {string} filePath - 输出文件路径
   * @param {Object} videoInfo - 视频信息
   */
  async saveStabilityMaskVisualization(stabilityMask, filePath, videoInfo) {
    const { width, height } = videoInfo;
    
    const image = new Jimp(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const value = stabilityMask.stabilityMask[idx] === 1 ? 255 : 0; // 白色表示稳定区域，黑色表示不稳定区域
        image.setPixelColor(Jimp.rgbaToInt(value, value, value, 255), x, y);
      }
    }
    
    await image.writeAsync(filePath);
    console.log(`稳定性掩码已保存到: ${filePath}`);
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    const tempDir = path.join(this.outputDir, this.tempDirName);
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Temporary files cleaned up: ${this.tempDirName}`);
      } catch (error) {
        console.warn('Failed to cleanup temp files:', error.message);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    await this.cleanupTempFiles();
    
    // 清理ONNX预测器
    if (this.onnxPredictor) {
      try {
        await this.onnxPredictor.cleanup();
        this.onnxPredictor = null;
        console.log('ONNX预测器已清理');
      } catch (error) {
        console.warn('清理ONNX预测器时出错:', error.message);
      }
    }
    
    this.frames = [];
    this.videoInfo = null;
    console.log('VideoAnalyzer resources cleaned up');
  }


}

module.exports = VideoAnalyzer;