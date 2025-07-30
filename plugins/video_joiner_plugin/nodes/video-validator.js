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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoValidatorNode = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob = __importStar(require("glob"));
class VideoValidatorNode {
    /**
     * 分析文件夹，返回配对和未配对信息，并为每个配对生成任务
     */
    analyzeFolders(baseDir) {
        const allFolders = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
        const introFoldersDict = {};
        const mainFoldersDict = {};
        for (const folder of allFolders) {
            if (folder.includes('前贴')) {
                const numbers = folder.match(/\d+/g);
                if (numbers)
                    introFoldersDict[parseInt(numbers[numbers.length - 1], 10)] = folder;
            }
            else if (!folder.endsWith('结果')) {
                const numbers = folder.match(/\d+/g);
                if (numbers)
                    mainFoldersDict[parseInt(numbers[numbers.length - 1], 10)] = folder;
            }
        }
        const matchedPairs = [];
        for (const number of Object.keys(introFoldersDict).map(Number)) {
            if (mainFoldersDict[number]) {
                matchedPairs.push({ number, intro: introFoldersDict[number], main: mainFoldersDict[number] });
            }
        }
        const unmatchedIntro = Object.keys(introFoldersDict).map(Number).filter(n => !mainFoldersDict[n]).map(n => introFoldersDict[n]);
        const unmatchedMain = Object.keys(mainFoldersDict).map(Number).filter(n => !introFoldersDict[n]).map(n => mainFoldersDict[n]);
        // 生成所有任务
        const allTasks = this.createTasks(baseDir, matchedPairs);
        // 将任务分配到每个配对
        matchedPairs.forEach(pair => {
            pair.tasks = allTasks.filter(task => task.outputPath && task.outputPath.includes(pair.main));
        });
        const result = {
            introFolders: Object.values(introFoldersDict),
            mainFolders: Object.values(mainFoldersDict),
            matchedPairs,
            unmatchedIntro,
            unmatchedMain
        };
        return result;
    }
    /**
     * 根据配对情况创建处理任务
     */
    createTasks(baseDir, matchedPairs) {
        const videoPatterns = ['*.mp4', '*.avi', '*.mov', '*.mkv', '*.wmv', '*.flv'];
        const allTasks = [];
        for (const { number, intro, main } of matchedPairs) {
            const introFolderPath = path.join(baseDir, intro);
            const mainFolderPath = path.join(baseDir, main);
            // 获取视频文件
            let introVideos = [];
            let mainVideos = [];
            for (const pattern of videoPatterns) {
                const introPattern = `${introFolderPath.replace(/\\/g, '/')}/${pattern}`;
                const mainPattern = `${mainFolderPath.replace(/\\/g, '/')}/${pattern}`;
                const introMatches = glob.sync(introPattern);
                const mainMatches = glob.sync(mainPattern);
                introVideos.push(...introMatches);
                mainVideos.push(...mainMatches);
            }
            if (!introVideos.length || !mainVideos.length) {
                console.log('跳过此配对：缺少视频文件');
                continue;
            }
            // 创建结果文件夹
            const resultFolderName = `${main}结果`;
            const resultFolderPath = path.join(baseDir, resultFolderName);
            if (!fs.existsSync(resultFolderPath)) {
                fs.mkdirSync(resultFolderPath);
            }
            // 为每个正片视频配对前贴视频
            for (const mainVideo of mainVideos) {
                const selectedIntro = introVideos[Math.floor(Math.random() * introVideos.length)];
                const v1Path = selectedIntro;
                const v2Path = mainVideo;
                const taskInfo = `[${number}] ${path.basename(selectedIntro, path.extname(selectedIntro))}+${path.basename(mainVideo, path.extname(mainVideo))}`;
                console.log('创建任务:', {
                    v1Path,
                    v2Path,
                    outputPath: resultFolderPath,
                    taskInfo
                });
                allTasks.push({ v1Path, v2Path, outputPath: resultFolderPath, taskInfo });
            }
        }
        return allTasks;
    }
}
exports.VideoValidatorNode = VideoValidatorNode;
