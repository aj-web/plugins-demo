"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasNvidiaGpuAndDriverAbove570 = hasNvidiaGpuAndDriverAbove570;
exports.convertToTargetResolution = convertToTargetResolution;
exports.addElementsToVideo = addElementsToVideo;
exports.escapeUnescapedColons = escapeUnescapedColons;
exports.buildGenerateVideoParamsForAll = buildGenerateVideoParamsForAll;
exports.getFfmpegPathInfo = getFfmpegPathInfo;
exports.getAvailableFfmpegPath = getAvailableFfmpegPath;
exports.getAvailableFfprobePath = getAvailableFfprobePath;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ffmpeg_locator_1 = __importStar(require("../utils/ffmpeg-locator"));
function writeLog(level, message, data) {
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { execSync } = require('child_process');
        const userDataPath = process.env.APPDATA || os.homedir();
        const logFile = path.join(userDataPath, 'plugins-demo', 'app-debug.log');
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] [PLUGIN] ${message}${dataStr}\n`;
        fs.appendFileSync(logFile, logMessage);
    }
    catch (error) {
    }
}
function getAvailableFfmpegPath() {
    try {
        const projectRootPath = path.join(process.cwd(), 'ffmpeg.exe');
        writeLog('INFO', '检查项目根目录:', projectRootPath);
        if (fs.existsSync(projectRootPath)) {
            writeLog('INFO', '使用项目根目录路径:', projectRootPath);
            return projectRootPath;
        }
        const possibleFfmpegPath = path.join(process.resourcesPath || '', 'ffmpeg.exe');
        if (fs.existsSync(possibleFfmpegPath)) {
            writeLog('INFO', '使用打包路径:', possibleFfmpegPath);
            return possibleFfmpegPath;
        }
        if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
            writeLog('INFO', '使用环境变量FFMPEG_PATH:', process.env.FFMPEG_PATH);
            return process.env.FFMPEG_PATH;
        }
        const localFfmpeg = ffmpeg_locator_1.findLocalFfmpeg();
        if (localFfmpeg && fs.existsSync(localFfmpeg)) {
            writeLog('INFO', '使用ffmpeg-locator找到的路径:', localFfmpeg);
            return localFfmpeg;
        }
        writeLog('INFO', '未找到可用的ffmpeg路径');
    }
    catch (error) {
        writeLog('ERROR', 'FFmpeg路径检测失败:', error.message);
    }
    return null;
}
function getAvailableFfprobePath() {
    try {
        const projectRootPath = path.join(process.cwd(), 'ffprobe.exe');
        writeLog('INFO', '检查项目根目录ffprobe:', projectRootPath);
        if (fs.existsSync(projectRootPath)) {
            writeLog('INFO', '使用项目根目录ffprobe路径:', projectRootPath);
            return projectRootPath;
        }
        const possibleFfprobePath = path.join(process.resourcesPath || '', 'ffprobe.exe');
        if (fs.existsSync(possibleFfprobePath)) {
            writeLog('INFO', '使用打包ffprobe路径:', possibleFfprobePath);
            return possibleFfprobePath;
        }
        if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
            writeLog('INFO', '使用环境变量FFPROBE_PATH:', process.env.FFPROBE_PATH);
            return process.env.FFPROBE_PATH;
        }
        const localFfprobe = ffmpeg_locator_1.findLocalFfprobe();
        if (localFfprobe && fs.existsSync(localFfprobe)) {
            writeLog('INFO', '使用ffmpeg-locator找到的ffprobe路径:', localFfprobe);
            return localFfprobe;
        }
        writeLog('INFO', '未找到可用的ffprobe路径');
    }
    catch (error) {
        writeLog('ERROR', 'FFprobe路径检测失败:', error.message);
    }
    return null;
}
function createFfmpegInstance(inputPath) {
    const ffmpegPath = getAvailableFfmpegPath();
    const ffprobePath = getAvailableFfprobePath();
    const ffmpegInstance = (0, fluent_ffmpeg_1.default)(inputPath);
    if (ffmpegPath) {
        ffmpegInstance.setFfmpegPath(ffmpegPath);
    }
    if (ffprobePath) {
        ffmpegInstance.setFfprobePath(ffprobePath);
    }
    return ffmpegInstance;
}
function chooseCodec(inputPath, videoCodec = 'h264') {
    return new Promise((resolve) => {
        const codecMap = {
            h264: { hardware: 'h264_nvenc', software: 'libx264' },
            h265: { hardware: 'hevc_nvenc', software: 'libx265' }
        };
        const codec = codecMap[videoCodec];
        Promise.all([
            new Promise((resolveEncoders) => {
                fluent_ffmpeg_1.default.getAvailableEncoders((encErr, encoders) => {
                    resolveEncoders({ encErr, encoders });
                });
            }),
            hasNvidiaGpuAndDriverAbove570()
        ])
            .then(([encoderResult, nvidiaAvailable]) => {
            const { encErr, encoders } = encoderResult;
            const hasNvenc = !encErr && encoders && !!encoders[codec.hardware] && nvidiaAvailable;
            let selectedCodec = hasNvenc ? codec.hardware : codec.software;
            writeLog('INFO', 'GPU编码可用性：', { nvidiaAvailable, selectedCodec: codec.hardware, supportedEncoders: encoders ? Object.keys(encoders) : [], finalCodec: selectedCodec });
            let proc = createFfmpegInstance(inputPath);
            if (hasNvenc) {
                proc = proc.inputOptions(['-hwaccel', 'auto']);
            }
            proc = proc.videoCodec(selectedCodec);
            resolve(proc);
        })
            .catch((error) => {
            let proc = createFfmpegInstance(inputPath);
            proc = proc.videoCodec(codec.software);
            resolve(proc);
        });
    });
}
let nvidiaCheckPromise = null;
function hasNvidiaGpuAndDriverAbove570() {
    if (nvidiaCheckPromise)
        return nvidiaCheckPromise;
    nvidiaCheckPromise = new Promise((resolve) => {
        (0, child_process_1.exec)('nvidia-smi --query-gpu=driver_version --format=csv,noheader', (err, stdout) => {
            if (err || !stdout) {
                return resolve(false);
            }
            const versions = stdout
                .split('\n')
                .map((v) => v.trim())
                .filter((v) => /^\d+(\.\d+)?$/.test(v));
            if (versions.length === 0) {
                return resolve(false);
            }
            const above570 = versions.some((ver) => {
                const major = parseInt(ver.split('.')[0], 10);
                return major > 570;
            });
            resolve(above570);
        });
    });
    return nvidiaCheckPromise;
}
function getVideoMetadata(inputPath) {
    return new Promise((resolveMetadata, rejectMetadata) => {
        try {
            const ffmpegInstance = createFfmpegInstance(inputPath);
            ffmpegInstance.ffprobe((err, data) => {
                if (err) {
                    writeLog('ERROR', 'ffprobe获取元数据失败:', err.message);
                    rejectMetadata(err);
                }
                else {
                    writeLog('INFO', '成功获取视频元数据');
                    resolveMetadata(data);
                }
            });
        }
        catch (execErr) {
            writeLog('ERROR', 'ffprobe执行失败:', execErr.message);
            rejectMetadata(execErr);
        }
    });
}
;
function convertToTargetResolution(inputPath, outputPath, width = 720, height = 1280, videoCodec = 'h264') {
    return new Promise((resolve, reject) => {
        if (!require('fs').existsSync(inputPath)) {
            return reject(new Error(`输入文件不存在: ${inputPath}`));
        }
        getVideoMetadata(inputPath)
            .then((metadata) => {
            if (!metadata || !metadata.format) {
                return reject(new Error('无法获取文件元数据'));
            }
            const duration = metadata.format.duration || 1;
            const maxSizeBytes = 480 * 1024 * 1024;
            const maxAllowedBitrate = 12 * 1000 * 1000;
            let targetBitrate = Math.floor((maxSizeBytes * 8) / duration / 1000);
            if (targetBitrate * 1000 > maxAllowedBitrate) {
                targetBitrate = Math.floor(maxAllowedBitrate / 1000);
            }
            const vf = `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
            const maxBufsizeK = Math.floor(maxAllowedBitrate / 1000);
            const bufsizeK = Math.min(targetBitrate * 2, maxBufsizeK);
            chooseCodec(inputPath, videoCodec)
                .then((proc) => {
                proc
                    .audioCodec('copy')
                    .outputOptions(['-vf', vf, '-b:v', `${targetBitrate}k`, '-maxrate', `${targetBitrate}k`, '-bufsize', `${bufsizeK}k`, '-pix_fmt', 'yuv420p'])
                    .on('end', () => {
                    resolve();
                })
                    .on('error', (e) => {
                    writeLog('ERROR', 'FFmpeg转换错误:', e.message);
                    reject(e);
                })
                    .save(outputPath);
            })
                .catch((error) => {
                writeLog('ERROR', '编码器选择失败:', error.message);
                reject(error);
            });
        })
            .catch((error) => {
            writeLog('ERROR', '获取视频元数据失败:', error.message);
            reject(error);
        });
    });
}
function addElementsToVideo(params) {
    const { videoPath, mainVideoDuration, playAreaAnalysis, outputPath, outputWidth, outputHeight, titles, stickers, mosaicAreas, postVideos, } = params;
    return new Promise((resolve, reject) => {
        const ffmpegInputs = [];
        stickers.forEach(sticker => ffmpegInputs.push(sticker.filepath));
        postVideos.forEach(post => ffmpegInputs.push(post.filePath));
        chooseCodec(videoPath, 'h264').then((proc) => {
            ffmpegInputs.forEach((input) => {
                const ext = path.extname(input).toLowerCase();
                if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                    proc = proc.input(input).inputOptions(['-loop', '1']);
                }
                else {
                    proc = proc.input(input);
                }
            });
            const filters = [];
            let last = '[0:v]';
            if (playAreaAnalysis.hasBlackBars) {
                const cx = Math.round(playAreaAnalysis.playArea.x || 0);
                const cy = Math.round(playAreaAnalysis.playArea.y || 0);
                const cw = Math.round(playAreaAnalysis.playArea.width || 0);
                const ch = Math.round(playAreaAnalysis.playArea.height || 0);
                filters.push(`[0:v]crop=${cw}:${ch}:${cx}:${cy}[cropped]`);
                filters.push(`color=c=black:s=16x16:d=36000:r=25[bg]`);
                filters.push(`[bg][0:v]scale2ref[bg_scaled][ref]`);
                filters.push(`[bg_scaled][cropped]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2[play_area_out]`);
                last = `[play_area_out]`;
            }
            stickers.forEach((sticker, idx) => {
                filters.push(`[${idx + 1}:v]scale=${sticker.width}:${sticker.height}[sticker${idx}]`);
            });
            if (mosaicAreas.length > 0) {
                mosaicAreas.forEach((area, idx) => {
                    filters.push(`[0:v]crop=${area.width}:${area.height}:${area.x}:${area.y},boxblur=10[mos${idx}]`);
                });
                mosaicAreas.forEach((area, idx) => {
                    filters.push(`${last}[mos${idx}]overlay=${area.x}:${area.y}[mosout${idx}]`);
                    last = `[mosout${idx}]`;
                });
            }
            stickers.forEach((sticker, idx) => {
                if (mainVideoDuration !== undefined) {
                    filters.push(`[sticker${idx}]trim=duration=${mainVideoDuration},setpts=PTS-STARTPTS[sticker_trim${idx}]`);
                    filters.push(`${last}[sticker_trim${idx}]overlay=${sticker.x}:${sticker.y}:shortest=1[tmp${idx}]`);
                }
                else {
                    filters.push(`${last}[sticker${idx}]overlay=${sticker.x}:${sticker.y}:shortest=0[tmp${idx}]`);
                }
                last = `[tmp${idx}]`;
            });
            titles.forEach((title, idx) => {
                let textExpr = title.text.replace(/'/g, "\\'");
                if (title.direction === 'vertical') {
                    textExpr = textExpr.split('').join('\\n');
                }
                const drawtext = [
                    `drawtext=text='${textExpr}'`,
                    `fontfile='${title.fontPath}'`,
                    `x=${title.x}`,
                    `y=${title.y}`,
                    `fontsize=${title.fontSize}`,
                    `fontcolor=${title.fillColor || 'white'}`,
                    `borderw=${title.strokeWidth || 0}`,
                    `bordercolor=${title.strokeColor || 'black'}`
                ];
                if (title.backgroundColor) {
                    drawtext.push(`box=1`, `boxcolor=${title.backgroundColor}@0.5`);
                }
                filters.push(`${last}${drawtext.join(':')}[dt${idx}]`);
                last = `[dt${idx}]`;
            });
            let filterComplex = filters.length > 0 ? filters.join(';') + ';' : '';
            const mainOut = last;
            const concatInputs = [];
            let concatCount = 1 + postVideos.length;
            if (mainVideoDuration !== undefined) {
                filterComplex += `${mainOut}trim=duration=${mainVideoDuration},setpts=PTS-STARTPTS,scale=w=${outputWidth}:h=${outputHeight}:flags=lanczos[v0];`;
                concatInputs.push('[v0]');
            }
            else {
                filterComplex += `${mainOut}setpts=PTS-STARTPTS,scale=w=${outputWidth}:h=${outputHeight}:flags=lanczos[v0];`;
                concatInputs.push('[v0]');
            }
            postVideos.forEach((post, idx) => {
                const inputIndex = stickers.length + 1 + idx;
                filterComplex += `[${inputIndex}:v]setpts=PTS-STARTPTS,scale=w=${outputWidth}:h=${outputHeight}:flags=lanczos[v${idx + 1}];`;
                concatInputs.push(`[v${idx + 1}]`);
            });
            if (postVideos.length > 0) {
                filterComplex += `${concatInputs.join('')}concat=n=${concatCount}:v=1:a=0[outv];`;
            }
            else {
                filterComplex += `[v0]setpts=PTS-STARTPTS[outv];`;
            }
            proc = proc.complexFilter(filterComplex, ['outv']);
            const outOpts = ['-map', '0:a?', '-c:a', 'copy'];
            outOpts.unshift('-c:v', 'h264_nvenc');
            proc
                .outputOptions(outOpts)
                .on('start', (cmd) => console.log('FFmpeg 命令:', cmd))
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .save(outputPath);
        }).catch((error) => {
            reject(error);
        });
    });
}
async function readJsonIfExists(p) {
    try {
        const content = await fs.promises.readFile(p, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
async function readTxtFileLinesAsync(filePath) {
    try {
        const absolutePath = path.resolve(filePath);
        const content = await fs.promises.readFile(absolutePath, 'utf8');
        const lines = content.split(/\r?\n/);
        return lines;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`读取文件失败: ${error.message}`);
        }
        else {
            throw new Error(`读取文件时发生未知错误: ${String(error)}`);
        }
    }
}
function getRandomElement(array) {
    if (array.length === 0) {
        return undefined;
    }
    if (array.length === 1) {
        return array[0];
    }
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}
function getRandomResult(rate) {
    if (Math.random() <= rate) {
        return true;
    }
    return false;
}
async function getFilePathFromFolder(folderPath, exts) {
    const results = [];
    try {
        const files = await fs.promises.readdir(folderPath);
        for (const f of files) {
            const ext = path.extname(f).toLowerCase();
            if (exts.includes(ext)) {
                results.push(path.join(folderPath, f));
            }
        }
    }
    catch (e) {
        throw (e);
    }
    return results;
}
const stickerPosition = {
    "bottom-left": "左下",
    "bottom-right": "右下",
    "top-left": "左上",
    "top-right": "右上",
};
function escapeUnescapedColons(input) {
    if (!input)
        return input;
    let out = '';
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === ':') {
            if (i > 0 && input[i - 1] === '\\') {
                out += ':';
            }
            else {
                out += '\\:';
            }
        }
        else {
            out += ch;
        }
    }
    return out;
}
async function buildGenerateVideoParamsForAll(buildConfigs) {
    const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
    const results = [];
    const elementsRootPath = buildConfigs.basePath;
    const elementsSecondFolder = "素材";
    let configForder = path.join(elementsRootPath, "配置文件");
    if (!fs.existsSync(configForder)) {
        configForder = buildConfigs.configPath;
    }
    const elementsFolder = path.join(elementsRootPath, elementsSecondFolder, "原始素材");
    const elementsConfigFolder = path.join(elementsRootPath, elementsSecondFolder, "检测结果");
    const elementsOutputFolder = path.join(elementsRootPath, elementsSecondFolder, "最终成片");
    if (!fs.existsSync(elementsOutputFolder)) {
        fs.mkdirSync(elementsOutputFolder, { recursive: true });
    }
    try {
        const files = await fs.promises.readdir(elementsFolder);
        console.log(`发现素材文件 ${files.length} 个，开始处理...`);
        let index = 1;
        for (const f of files) {
            console.log(`处理第 ${index} 个文件: ${f}`);
            const ext = path.extname(f).toLowerCase();
            if (!videoExts.includes(ext))
                continue;
            const base = path.parse(f).name;
            const videoPath = path.join(elementsFolder, f);
            const configName = `${base}/analysis_results.json`;
            const materialConfigName = "config.json";
            let config = null;
            const p1 = path.join(elementsConfigFolder, configName);
            config = await readJsonIfExists(p1);
            if (!config) {
                console.log(`can not find file ${f} config: ${p1}`);
                continue;
            }
            console.log(`load video ${f} analyze result success: ${p1}`);
            const tailDetection = config["tailDetection"];
            const analysisResult = config["elementPositionAnalysis"];
            const playAreaAnalysis = config["playAreaAnalysis"];
            const elementStatus = analysisResult.positionSuggestions.elementStatus;
            if (elementStatus.title.exists && elementStatus.warning.exists && elementStatus.corner_mark.exists) {
                if (!playAreaAnalysis.hasBlackBars || (elementStatus.title.inPlayArea && elementStatus.corner_mark.inPlayArea && elementStatus.corner_mark.inPlayArea)) {
                    console.log(`视频${videoPath}包含所有元素，不做处理。`);
                    continue;
                }
            }
            let mainVideoDuration = tailDetection.hasTail ? tailDetection.tailStartTime : config["videoInfo"]["duration"];
            const todayDate = new Date();
            const todayString = todayDate.getFullYear().toString() + (todayDate.getMonth() + 1).toString().padStart(2, '0') + todayDate.getDate().toString().padStart(2, '0');
            const naming = buildConfigs.naming || '{纯扒}-{鱼儿组}-{adx}';
            const match = naming.match(/^\{(.+?)\}-\{(.+?)\}-\{(.+?)\}$/);
            const typeText = match ? match[1] : '纯扒';
            const groupText = match ? match[2] : '鱼儿组';
            const platformText = match ? match[3] : 'adx';
            const dramaName = path.basename(elementsRootPath);
            for (let i = 1; i <= buildConfigs.batchSize; i++) {
                const realOutputName = `短剧分销-点众-${dramaName}-${typeText}-${groupText}-机产-${todayString}-竖版-${platformText}-${index}-${i}.mp4`;
                const realOutputPath = path.join(elementsOutputFolder, realOutputName);
                const titles = [];
                const stickers = [];
                const postVideos = [];
                const mosaicAreas = [];
                const suggestion = getRandomElement(analysisResult.positionSuggestions.suggestions);
                if (!suggestion) {
                    console.log(`video ${f} has no suggestion`);
                    continue;
                }
                ;
                if (!elementStatus.title.exists || !elementStatus.title.inPlayArea) {
                    if (!suggestion.title) {
                        console.log(`video ${f} has no title suggestion`);
                        continue;
                    }
                    const titleElementConfig = buildConfigs.elements?.find((el) => el.name === '剧名');
                    let shouldAddTitle = true;
                    if (titleElementConfig) {
                        if (titleElementConfig.required === true) {
                            shouldAddTitle = true;
                        }
                        else {
                            const rate = typeof titleElementConfig.occurRate === 'number' ? titleElementConfig.occurRate : 1;
                            shouldAddTitle = getRandomResult(rate);
                        }
                    }
                    if (!shouldAddTitle) {
                        console.log(`skip adding title for video ${f} due to buildConfigs.elements setting`);
                        continue;
                    }
                    const titleConfigPath = path.join(configForder, "剧名", materialConfigName);
                    const titleConfigMap = await readJsonIfExists(titleConfigPath);
                    const titleConfig = titleConfigMap["config"];
                    const titleText = `《${dramaName}》`;
                    if ((titleConfig !== null) && suggestion.title) {
                        const titleConfigItem = getRandomElement(titleConfig);
                        if (!titleText || !titleConfigItem) {
                            console.log(`video ${f} has no title text or config`);
                        }
                        else {
                            titles.push({
                                text: titleText,
                                fontPath: escapeUnescapedColons(titleConfigItem.fontPath),
                                x: Math.floor(suggestion.title.bbox[0]),
                                y: Math.floor(suggestion.title.bbox[1]),
                                direction: suggestion.title.orientation,
                                fontSize: Math.floor(suggestion.title.fontSize),
                                fillColor: titleConfigItem.fillColor || 'white',
                                strokeColor: titleConfigItem.strokeColor || 'black',
                                strokeWidth: titleConfigItem.strokeWidth || 0,
                                backgroundColor: titleConfigItem.backgroundColor,
                            });
                        }
                    }
                    else {
                        console.log(`video ${f} title config or context is empty`);
                    }
                }
                if (!elementStatus.corner_mark.exists || !elementStatus.corner_mark.inPlayArea) {
                    if (!suggestion.corner_mark) {
                        console.log(`video ${f} has no corner_mark suggestion`);
                        continue;
                    }
                    const markElementConfig = buildConfigs.elements?.find((el) => el.name === '角标');
                    let shouldAddMark = true;
                    if (markElementConfig) {
                        if (markElementConfig.required === true) {
                            shouldAddMark = true;
                        }
                        else {
                            const rate = typeof markElementConfig.occurRate === 'number' ? markElementConfig.occurRate : 1;
                            shouldAddMark = getRandomResult(rate);
                        }
                    }
                    if (!shouldAddMark) {
                        console.log(`skip adding corner_mark for video ${f} due to buildConfigs.elements setting`);
                        continue;
                    }
                    if (!Object.keys(stickerPosition).includes(suggestion.corner_mark.position)) {
                        console.log(`video ${f} corner_mark position ${suggestion.corner_mark.position} is not supported`);
                        continue;
                    }
                    const cornerMarkFolder = path.join(configForder, "角标", stickerPosition[suggestion.corner_mark.position]);
                    if (!fs.existsSync(cornerMarkFolder)) {
                        console.log(`video ${f} corner_mark folder ${cornerMarkFolder} not exists; skipping`);
                    }
                    else {
                        const cornerMarkFiles = await getFilePathFromFolder(cornerMarkFolder, ['.png', '.jpg', '.jpeg']);
                        if (cornerMarkFiles.length === 0) {
                            console.log(`video ${f} has no corner_mark files in folder ${cornerMarkFolder}`);
                        }
                        else {
                            const cornerMarkFile = getRandomElement(cornerMarkFiles);
                            stickers.push({
                                filepath: cornerMarkFile || '',
                                x: 0,
                                y: 0,
                                width: buildConfigs.width,
                                height: buildConfigs.height,
                            });
                        }
                    }
                }
                if (!elementStatus.warning.exists || !elementStatus.warning.inPlayArea) {
                    if (!suggestion.warning) {
                        console.log(`video ${f} has no warning suggestion`);
                        continue;
                    }
                    const warningElementConfig = buildConfigs.elements?.find((el) => el.name === '警示语');
                    let shouldAddWarning = true;
                    if (warningElementConfig) {
                        if (warningElementConfig.required === true) {
                            shouldAddWarning = true;
                        }
                        else {
                            const rate = typeof warningElementConfig.occurRate === 'number' ? warningElementConfig.occurRate : 1;
                            shouldAddWarning = getRandomResult(rate);
                        }
                    }
                    if (!shouldAddWarning) {
                        console.log(`skip adding warning for video ${f} due to buildConfigs.elements setting`);
                    }
                    else {
                        const warningConfigPath = path.join(configForder, "警示语", materialConfigName);
                        const warningConfigMap = await readJsonIfExists(warningConfigPath);
                        const warningConfig = warningConfigMap["config"];
                        const warningContextFilePath = path.join(configForder, "警示语", "context.txt");
                        const warningContextArray = await readTxtFileLinesAsync(warningContextFilePath);
                        if ((warningConfig !== null) && warningContextArray.length > 0 && suggestion.warning) {
                            const warningText = getRandomElement(warningContextArray);
                            const warningConfigItem = getRandomElement(warningConfig);
                            if (!warningText || !warningConfigItem) {
                                console.log(`video ${f} has no warning text or config`);
                            }
                            else {
                                titles.push({
                                    text: warningText,
                                    fontPath: escapeUnescapedColons(warningConfigItem.fontPath),
                                    x: Math.floor(suggestion.warning.bbox[0]),
                                    y: Math.floor(suggestion.warning.bbox[1]),
                                    direction: suggestion.warning.orientation,
                                    fontSize: Math.floor(suggestion.warning.fontSize),
                                    fillColor: warningConfigItem.fillColor || 'white',
                                    strokeColor: warningConfigItem.strokeColor || 'black',
                                    strokeWidth: warningConfigItem.strokeWidth || 0,
                                    backgroundColor: warningConfigItem.backgroundColor,
                                });
                            }
                        }
                        else {
                            console.log(`video ${f} warning config or context is empty`);
                        }
                    }
                }
                const postVideoPath = path.join(configForder, "引导尾帧");
                const postVideoFiles = await getFilePathFromFolder(postVideoPath, ['.mp4', '.mov', '.mkv', '.avi', '.webm']);
                if (postVideoFiles.length > 0) {
                    let postVideoOccurTime = mainVideoDuration;
                    if (tailDetection.hasTail) {
                        postVideoOccurTime = tailDetection.tailStartTime;
                    }
                    const postVideoFile = getRandomElement(postVideoFiles);
                    postVideos.push({
                        filePath: postVideoFile || '',
                        occurTime: postVideoOccurTime,
                    });
                }
                results.push({
                    videoPath,
                    mainVideoDuration,
                    playAreaAnalysis,
                    outputPath: realOutputPath,
                    outputWidth: buildConfigs.width,
                    outputHeight: buildConfigs.height,
                    titles,
                    stickers,
                    mosaicAreas,
                    postVideos
                });
                console.log(`${videoPath}生成视频参数添加成功，准备生成视频：${realOutputPath}`);
            }
            index++;
        }
    }
    catch (e) {
        throw (e);
    }
    return results;
}
function getFfmpegPathInfo() {
    const ffmpegPath = getAvailableFfmpegPath();
    return {
        path: ffmpegPath,
        source: ffmpegPath ? '自动检测' : '未找到'
    };
}
