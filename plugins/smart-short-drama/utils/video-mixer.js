/**
 * 视频混剪工具
 * 负责视频的裁剪、拼接等操作
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DEFAULT_ENCODING_OPTIONS = {
  videoBitrateK: 2800,
  videoMaxrateK: 2800,
  videoBufsizeK: 2800,
  audioBitrateK: 128
};

class VideoMixer {
  constructor(ffmpegPath, ffprobePath, enableGPU = true, encodingOptions = {}) {
    this.ffmpegPath = ffmpegPath;
    this.ffprobePath = ffprobePath;
    this.enableGPU = enableGPU;
    this.encodingOptions = {
      ...DEFAULT_ENCODING_OPTIONS,
      ...encodingOptions
    };
    this.gpuType = null; // 'nvidia', 'intel', 'amd', 或 null
    this.hwAccelOptions = null;
    console.log('[VideoMixer] 初始化视频混剪工具');
    console.log('[VideoMixer] 编码配置:', this.getEncodingSummary());
    
    // 异步检测 GPU（不阻塞初始化）
    if (this.enableGPU) {
      this.detectGPU().catch(err => {
        console.warn('[VideoMixer] GPU 检测失败，将使用 CPU 模式:', err.message);
      });
    }
  }

  getEncodingSummary() {
    return {
      videoBitrate: this.getVideoBitrate(),
      videoMaxrate: this.getVideoMaxrate(),
      videoBufsize: this.getVideoBufsize(),
      audioBitrate: this.getAudioBitrate()
    };
  }

  getVideoBitrate() {
    return `${this.encodingOptions.videoBitrateK}k`;
  }

  getVideoMaxrate() {
    return `${this.encodingOptions.videoMaxrateK}k`;
  }

  getVideoBufsize() {
    return `${this.encodingOptions.videoBufsizeK}k`;
  }

  getAudioBitrate() {
    return `${this.encodingOptions.audioBitrateK}k`;
  }

  getVideoBitrateOptionStrings() {
    return [
      `-b:v ${this.getVideoBitrate()}`,
      `-maxrate ${this.getVideoMaxrate()}`,
      `-bufsize ${this.getVideoBufsize()}`
    ];
  }

  getVideoBitrateOptionPairs() {
    return [
      '-b:v', this.getVideoBitrate(),
      '-maxrate', this.getVideoMaxrate(),
      '-bufsize', this.getVideoBufsize()
    ];
  }

  getAudioOptionStrings() {
    return [
      '-c:a aac',
      `-b:a ${this.getAudioBitrate()}`
    ];
  }

  getAudioOptionPairs() {
    return [
      '-c:a', 'aac',
      '-b:a', this.getAudioBitrate()
    ];
  }

  /**
   * 检测可用的 GPU 加速类型
   * @returns {Promise<void>}
   */
  async detectGPU() {
    try {
      console.log('[VideoMixer] 开始检测 GPU 加速支持...');
      
      // 获取 FFmpeg 支持的编码器列表
      const { stdout } = await execAsync(`"${this.ffmpegPath}" -encoders -hide_banner`);
      
      // 检测 NVIDIA NVENC (优先级最高)
        if (stdout.includes('h264_nvenc') || stdout.includes('hevc_nvenc')) {
          this.gpuType = 'nvidia';
          this.hwAccelOptions = {
            decoder: 'h264_cuvid',  // NVIDIA 硬件解码
            encoder: 'h264_nvenc',   // NVIDIA 硬件编码
            pixelFormat: 'yuv420p',
            preset: 'p4',            // p1-p7, p4 是速度和质量的平衡
            inputOptions: ['-hwaccel cuda', '-hwaccel_output_format cuda'],
            outputOptions: [
              '-c:v h264_nvenc',
              '-preset p4',
              '-tune hq',
              '-rc vbr',
              ...this.getVideoBitrateOptionStrings(),
              '-gpu 0',
              '-bf 3',
              '-rc-lookahead 32'
            ]
          };
        console.log('[VideoMixer] 检测到 NVIDIA GPU 加速支持 (NVENC)');
      }
      // 检测 Intel Quick Sync
      else if (stdout.includes('h264_qsv') || stdout.includes('hevc_qsv')) {
        this.gpuType = 'intel';
        this.hwAccelOptions = {
          decoder: 'h264_qsv',
          encoder: 'h264_qsv',
          pixelFormat: 'nv12',
          preset: 'medium',
          inputOptions: ['-hwaccel qsv', '-hwaccel_output_format qsv'],
          outputOptions: [
            '-c:v h264_qsv',
            '-preset medium',
            ...this.getVideoBitrateOptionStrings()
          ]
        };
        console.log('[VideoMixer] 检测到 Intel Quick Sync 加速支持 (QSV)');
      }
      // 检测 AMD AMF
      else if (stdout.includes('h264_amf') || stdout.includes('hevc_amf')) {
        this.gpuType = 'amd';
        this.hwAccelOptions = {
          decoder: 'h264',
          encoder: 'h264_amf',
          pixelFormat: 'yuv420p',
          preset: 'balanced',
          inputOptions: [],
          outputOptions: [
            '-c:v h264_amf',
            '-quality balanced',
            '-rc vbr_latency',
            ...this.getVideoBitrateOptionStrings()
          ]
        };
        console.log('[VideoMixer] 检测到 AMD GPU 加速支持 (AMF)');
      }
      else {
        console.log('[VideoMixer] 未检测到 GPU 加速支持，将使用 CPU 模式');
        this.gpuType = null;
      }
      
      if (this.gpuType) {
        console.log(`[VideoMixer] GPU 加速模式: ${this.gpuType.toUpperCase()}`);
      }
    } catch (error) {
      console.warn('[VideoMixer] GPU 检测失败:', error.message);
      this.gpuType = null;
    }
  }

  /**
   * 获取视频编码选项（根据 GPU 类型）
   * @param {boolean} forceGPU - 强制使用 GPU（如果可用）
   * @returns {Object} 编码选项
   */
  getEncoderOptions(forceGPU = false) {
    // 如果启用了 GPU 且检测到 GPU
    if (this.enableGPU && this.gpuType && this.hwAccelOptions) {
      return {
        useGPU: true,
        gpuType: this.gpuType,
        videoCodec: this.hwAccelOptions.encoder,
        outputOptions: [
          ...this.hwAccelOptions.outputOptions,
          ...this.getAudioOptionStrings()
        ]
      };
    }
    
    // 默认使用 CPU
    return {
      useGPU: false,
      gpuType: null,
      videoCodec: 'libx264',
      outputOptions: [
        '-c:v libx264',
        '-preset medium',
        ...this.getVideoBitrateOptionStrings(),
        ...this.getAudioOptionStrings()
      ]
    };
  }

  /**
   * 获取 GPU 加速状态信息
   * @returns {Object} GPU 状态
   */
  getGPUStatus() {
    return {
      enabled: this.enableGPU,
      detected: this.gpuType !== null,
      type: this.gpuType,
      encoder: this.gpuType ? this.hwAccelOptions.encoder : null,
      message: this.gpuType 
        ? `GPU 加速已启用 (${this.gpuType.toUpperCase()})`
        : this.enableGPU 
          ? 'GPU 加速已启用，但未检测到 GPU 硬件'
          : 'GPU 加速已禁用'
    };
  }

  /**
   * 获取视频时长（秒）
   * @param {string} videoPath - 视频路径
   * @returns {Promise<number>} 视频时长（秒）
   */
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.setFfprobePath(this.ffprobePath);
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`获取视频时长失败: ${err.message}`));
        } else {
          const duration = metadata.format.duration;
          resolve(duration);
        }
      });
    });
  }


  /**
   * 裁剪视频
   * @param {string} inputPath - 输入视频路径
   * @param {string} outputPath - 输出视频路径
   * @param {number} startTime - 开始时间（秒）
   * @param {number} duration - 持续时长（秒）
   * @returns {Promise<void>}
   */
  async trimVideo(inputPath, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      console.log(`[VideoMixer] 裁剪视频: ${path.basename(inputPath)}`);
      console.log(`[VideoMixer] 起始: ${startTime}s, 时长: ${duration}s`);

      ffmpeg(inputPath)
        .setFfmpegPath(this.ffmpegPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .outputOptions([
          '-c copy',              // 使用 copy 模式，快速裁剪
          '-avoid_negative_ts 1'  // 避免负时间戳问题
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[VideoMixer] FFmpeg 命令:', commandLine);
        })
        .on('end', () => {
          console.log(`[VideoMixer] 裁剪完成: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`视频裁剪失败: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * 叠加视频（overlay）- 支持 GPU 加速
   * @param {string} originalVideoPath - 原片路径
   * @param {string} overlayVideoPath - 叠加视频路径（话术，带透明通道）
   * @param {string} outputPath - 输出路径
   * @param {number} startTime - 原片起始时间（秒）
   * @param {number} duration - 时长（秒）
   * @param {number} overlayStartTime - 叠加视频起始时间（秒，通常为0）
   * @returns {Promise<void>}
   */
  async overlayVideo(originalVideoPath, overlayVideoPath, outputPath, startTime, duration, overlayStartTime = 0) {
    return new Promise((resolve, reject) => {
      console.log(`[VideoMixer] 叠加视频`);
      console.log(`[VideoMixer] 原片: ${path.basename(originalVideoPath)} (${startTime}s-${startTime + duration}s)`);
      console.log(`[VideoMixer] 叠加: ${path.basename(overlayVideoPath)} (${overlayStartTime}s-${overlayStartTime + duration}s)`);

      // 获取编码选项
      const encoderOpts = this.getEncoderOptions();
      
      if (encoderOpts.useGPU) {
        console.log(`[VideoMixer] 使用 GPU 加速: ${encoderOpts.gpuType.toUpperCase()}`);
      } else {
        console.log('[VideoMixer] 使用 CPU 编码');
      }

      const cmd = ffmpeg()
        .setFfmpegPath(this.ffmpegPath);

      // 输入1：原片（裁剪指定片段）
      cmd.input(originalVideoPath)
        .inputOptions([
          `-ss ${startTime}`,
          `-t ${duration}`
        ]);

      // 输入2：话术视频
      cmd.input(overlayVideoPath)
        .inputOptions([
          `-ss ${overlayStartTime}`,
          `-t ${duration}`
        ]);

      // 使用 filter_complex 进行透明叠加
      // 注意：GPU 加速时，overlay filter 在 CPU 上执行，但编码在 GPU 上
      cmd.complexFilter([
        // [0:v] 原片视频流（底层）
        // [1:v] 话术视频流（透明叠加层）
        // 1. 强制话术视频使用透明格式
        '[1:v]format=yuva420p[overlay_alpha]',
        // 2. 使用 scale2ref 将话术视频高度缩放到与原片相同
        '[overlay_alpha][0:v]scale2ref=w=-1:h=ih[overlay_scaled][original]',
        // 3. 叠加到原片上
        '[original][overlay_scaled]overlay=(main_w-overlay_w)/2:main_h-overlay_h[outv]'
      ]);

      // 输出选项
      const outputOpts = [
        '-map [outv]',            // 映射叠加后的视频流
        '-map 1:a',               // 映射话术的音频流（索引1）
        '-shortest'               // 以最短的输入流为准
      ];

      // 添加编码器特定选项
      if (encoderOpts.useGPU) {
        outputOpts.push(...encoderOpts.outputOptions);
      } else {
        outputOpts.push(
          '-c:v libx264',
          '-preset medium',
          ...this.getVideoBitrateOptionStrings(),
          ...this.getAudioOptionStrings()
        );
      }

      cmd.outputOptions(outputOpts)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[VideoMixer] FFmpeg 命令:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VideoMixer] 处理进度: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log(`[VideoMixer] Overlay 完成: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('[VideoMixer] FFmpeg 错误输出:', stderr);
          reject(new Error(`视频叠加失败: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * 将图片叠加到视频上（支持透明度，强制指定分辨率）
   * @param {string} videoPath - 视频路径
   * @param {string} imagePath - 图片路径
   * @param {string} outputPath - 输出路径
   * @param {number} opacity - 图片透明度 (0-1)
   * @param {number} targetWidth - 目标宽度（默认 720）
   * @param {number} targetHeight - 目标高度（默认 1280）
   * @returns {Promise<void>}
   */
  async overlayImageToVideo(videoPath, imagePath, outputPath, opacity = 0.7, targetWidth = 720, targetHeight = 1280) {
    return new Promise((resolve, reject) => {
      console.log(`[VideoMixer] 图片叠加到视频`);
      console.log(`[VideoMixer] 视频: ${path.basename(videoPath)}`);
      console.log(`[VideoMixer] 图片: ${path.basename(imagePath)}`);
      console.log(`[VideoMixer] 透明度: ${opacity}`);

      // 获取编码选项
      const encoderOpts = this.getEncoderOptions();
      
      if (encoderOpts.useGPU) {
        console.log(`[VideoMixer] 使用 GPU 加速: ${encoderOpts.gpuType.toUpperCase()}`);
      } else {
        console.log('[VideoMixer] 使用 CPU 编码');
      }

      const cmd = ffmpeg()
        .setFfmpegPath(this.ffmpegPath);

      // 输入1：视频
      cmd.input(videoPath);

      // 输入2：图片
      cmd.input(imagePath)
        .loop();  // 循环图片以匹配视频时长

      // 使用 filter_complex 进行图片叠加
      // 1. 将视频缩放到 720×1280
      // 2. 将图片缩放到 720×1280 并设置透明度
      // 3. 叠加图片到视频上
      cmd.complexFilter([
        // [0:v] 视频流，强制缩放到 720×1280，并设置像素格式
        `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=disable,format=yuv420p[video_scaled]`,
        // [1:v] 图片流，强制缩放到目标分辨率（拉伸变形），并设置透明度
        `[1:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=disable,format=rgba,colorchannelmixer=aa=${opacity}[image_overlay]`,
        // 叠加图片到视频上（位置 0:0，完全覆盖）
        '[video_scaled][image_overlay]overlay=0:0:shortest=1[outv]'
      ]);

      // 输出选项
      const outputOpts = [
        '-map [outv]',
        '-map 0:a?',
        '-shortest'
      ];

      // 添加编码器特定选项
      if (encoderOpts.useGPU) {
        outputOpts.push('-c:v', encoderOpts.videoCodec);
        if (encoderOpts.gpuType === 'nvidia') {
          outputOpts.push(
            '-preset', 'p4',
            '-tune', 'hq',
            ...this.getVideoBitrateOptionPairs(),
            '-bf', '2',
            '-rc-lookahead', '16'
          );
        } else {
          outputOpts.push(...encoderOpts.outputOptions.filter(opt => !opt.includes('crf') && !opt.includes('cq')));
        }
        outputOpts.push(...this.getAudioOptionPairs());
      } else {
        outputOpts.push(
          '-c:v', 'libx264',
          '-preset', 'medium',
          ...this.getVideoBitrateOptionPairs(),
          ...this.getAudioOptionPairs()
        );
      }

      cmd.outputOptions(outputOpts)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[VideoMixer] FFmpeg 命令:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VideoMixer] 图片叠加进度: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log(`[VideoMixer] 图片叠加完成: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('[VideoMixer] FFmpeg 错误输出:', stderr);
          reject(new Error(`图片叠加失败: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * 拼接多个视频（自动统一分辨率）
   * @param {Array<string>} videoPaths - 视频路径数组（按顺序拼接）
   * @param {string} outputPath - 输出视频路径
   * @param {string} tempDir - 临时目录
   * @param {number} targetWidth - 目标宽度（默认 720）
   * @param {number} targetHeight - 目标高度（默认 1280）
   * @returns {Promise<void>}
   */
  async concatVideos(videoPaths, outputPath, tempDir, targetWidth = 720, targetHeight = 1280) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`[VideoMixer] 拼接 ${videoPaths.length} 个视频`);

        // 获取编码选项
        const encoderOpts = this.getEncoderOptions();

        console.log(`[VideoMixer] 目标分辨率: ${targetWidth}x${targetHeight}`);

        // 构建 filter_complex：先缩放每个视频，再拼接
        // 格式：[v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[outv][outa]
        const scaleFilters = [];
        const concatInputs = [];
        
        for (let i = 0; i < videoPaths.length; i++) {
          // 缩放每个视频到统一分辨率，并强制设置 SAR=1（正方形像素）
          scaleFilters.push(`[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=disable,format=yuv420p,setsar=1[v${i}]`);
          // 音频直接传递
          concatInputs.push(`[v${i}][${i}:a]`);
        }
        
        const concatFilter = `${concatInputs.join('')}concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
        const complexFilter = [...scaleFilters, concatFilter].join(';');

        console.log(`[VideoMixer] 使用 filter_complex 统一分辨率并拼接`);

        const cmd = ffmpeg();

        // 添加所有输入
        for (const videoPath of videoPaths) {
          cmd.input(videoPath);
        }

        // 使用 filter_complex 进行缩放和拼接
        cmd.complexFilter(complexFilter);

        // 输出选项
        const outputOpts = [
          '-map', '[outv]',
          '-map', '[outa]',
          '-shortest'
        ];

        // 添加编码器选项
        if (encoderOpts.useGPU) {
          outputOpts.push('-c:v', encoderOpts.videoCodec);
          if (encoderOpts.gpuType === 'nvidia') {
            outputOpts.push(
              '-preset', 'p4',
              '-tune', 'hq',
              ...this.getVideoBitrateOptionPairs(),
              '-bf', '2',
              '-rc-lookahead', '16'
            );
          } else {
            outputOpts.push(...encoderOpts.outputOptions.filter(opt => !opt.includes('crf') && !opt.includes('cq')));
          }
          outputOpts.push(...this.getAudioOptionPairs());
        } else {
          outputOpts.push(
            '-c:v', 'libx264',
            '-preset', 'medium',
            ...this.getVideoBitrateOptionPairs(),
            ...this.getAudioOptionPairs()
          );
        }

        cmd.outputOptions(outputOpts)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('[VideoMixer] FFmpeg 命令:', commandLine);
          })
          .on('end', async () => {
            console.log(`[VideoMixer] 拼接完成: ${path.basename(outputPath)}`);
            resolve();
          })
          .on('error', (err, stdout, stderr) => {
            console.error('[VideoMixer] FFmpeg 错误输出:', stderr);
            reject(new Error(`视频拼接失败: ${err.message}`));
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取视频信息
   * @param {string} videoPath - 视频路径
   * @returns {Promise<Object>} 视频信息
   */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.setFfprobePath(this.ffprobePath);
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`获取视频信息失败: ${err.message}`));
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          resolve({
            width: videoStream ? videoStream.width : 0,
            height: videoStream ? videoStream.height : 0,
            duration: metadata.format.duration,
            codec: videoStream ? videoStream.codec_name : 'unknown'
          });
        }
      });
    });
  }

  /**
   * 混剪视频（纯后置模式 - 使用 overlay 叠加）
   * @param {string} originalVideoPath - 原片路径
   * @param {string} scriptVideoPath - 话术视频路径
   * @param {string} outputPath - 输出路径
   * @param {string} tempDir - 临时目录
   * @returns {Promise<void>}
   */
  async mixPostMode(originalVideoPath, scriptVideoPath, outputPath, tempDir) {
    console.log('[VideoMixer] 执行纯后置叠加模式（overlay）');

    // 1. 获取视频时长
    const durationOriginal = await this.getVideoDuration(originalVideoPath);
    const durationScript = await this.getVideoDuration(scriptVideoPath);

    console.log(`[VideoMixer] 原片时长: ${durationOriginal}s, 话术时长: ${durationScript}s`);

    // 2. 检查时长
    if (durationScript >= durationOriginal) {
      throw new Error(`话术时长(${durationScript}s)大于等于原片时长(${durationOriginal}s)，无法处理`);
    }

    // 3. 计算裁剪点和叠加时间
    const cutPoint = durationOriginal - durationScript;
    console.log(`[VideoMixer] 前半部分: 0-${cutPoint}s（纯原片）`);
    console.log(`[VideoMixer] 后半部分: ${cutPoint}-${durationOriginal}s（原片+话术overlay）`);

    // 4. 裁剪原片前半部分（纯原片，保留原片音频）
    const tempPart1Path = path.join(tempDir, `part1_${Date.now()}.mp4`);
    await this.trimVideo(originalVideoPath, tempPart1Path, 0, cutPoint);

    // 5. 生成后半部分（原片+话术overlay，只保留话术音频）
    const tempPart2Path = path.join(tempDir, `part2_overlay_${Date.now()}.mp4`);
    await this.overlayVideo(
      originalVideoPath,
      scriptVideoPath,
      tempPart2Path,
      cutPoint,
      durationScript,
      0 // 原片起始时间（相对于整个视频）
    );

    // 6. 拼接两部分
    await this.concatVideos([tempPart1Path, tempPart2Path], outputPath, tempDir);

    // 7. 清理临时文件
    try {
      await fs.unlink(tempPart1Path);
      await fs.unlink(tempPart2Path);
    } catch (e) {
      console.warn(`[VideoMixer] 清理临时文件失败: ${e.message}`);
    }

    console.log('[VideoMixer] 纯后置叠加完成');
  }

  /**
   * 混剪视频（留钩子模式 - 使用 overlay 叠加）
   * @param {string} originalVideoPath - 原片路径
   * @param {string} scriptVideoPath - 话术视频路径
   * @param {string} outputPath - 输出路径
   * @param {number} hookSeconds - 钩子时长（秒）
   * @param {string} tempDir - 临时目录
   * @returns {Promise<void>}
   */
  async mixHookMode(originalVideoPath, scriptVideoPath, outputPath, hookSeconds, tempDir) {
    console.log('[VideoMixer] 执行留钩子叠加模式（overlay）');
    console.log(`[VideoMixer] 钩子时长: ${hookSeconds}s`);

    // 1. 获取视频时长
    const durationOriginal = await this.getVideoDuration(originalVideoPath);
    const durationScript = await this.getVideoDuration(scriptVideoPath);

    console.log(`[VideoMixer] 原片时长: ${durationOriginal}s, 话术时长: ${durationScript}s`);

    // 2. 检查时长
    if (durationScript + hookSeconds >= durationOriginal) {
      throw new Error(
        `话术时长(${durationScript}s) + 钩子时长(${hookSeconds}s) 大于等于原片时长(${durationOriginal}s)，无法处理`
      );
    }

    // 3. 计算裁剪点
    const cutPoint1 = durationOriginal - durationScript - hookSeconds;
    const cutPoint2 = durationOriginal - hookSeconds;

    console.log(`[VideoMixer] 前半部分: 0-${cutPoint1}s（纯原片）`);
    console.log(`[VideoMixer] 中间部分: ${cutPoint1}-${cutPoint2}s（原片+话术overlay）`);
    console.log(`[VideoMixer] 钩子部分: ${cutPoint2}-${durationOriginal}s（纯原片）`);

    // 4. 裁剪原片前半部分（纯原片，保留原片音频）
    const tempPart1Path = path.join(tempDir, `part1_${Date.now()}.mp4`);
    await this.trimVideo(originalVideoPath, tempPart1Path, 0, cutPoint1);

    // 5. 生成中间部分（原片+话术overlay，只保留话术音频）
    const tempPart2Path = path.join(tempDir, `part2_overlay_${Date.now()}.mp4`);
    await this.overlayVideo(
      originalVideoPath,
      scriptVideoPath,
      tempPart2Path,
      cutPoint1,
      durationScript,
      0 // 原片起始时间
    );

    // 6. 裁剪原片钩子部分（纯原片，保留原片音频）
    const tempHookPath = path.join(tempDir, `hook_${Date.now()}.mp4`);
    await this.trimVideo(originalVideoPath, tempHookPath, cutPoint2, hookSeconds);

    // 7. 拼接三段视频
    await this.concatVideos([tempPart1Path, tempPart2Path, tempHookPath], outputPath, tempDir);

    // 8. 清理临时文件
    try {
      await fs.unlink(tempPart1Path);
      await fs.unlink(tempPart2Path);
      await fs.unlink(tempHookPath);
    } catch (e) {
      console.warn(`[VideoMixer] 清理临时文件失败: ${e.message}`);
    }

    console.log('[VideoMixer] 留钩子叠加完成');
  }
}

module.exports = { VideoMixer };
