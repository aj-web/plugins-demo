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
        console.log('=== VideoValidatorNode.analyzeFolders 开始 ===');
        console.log('当前工作目录:', process.cwd());
        console.log('baseDir:', baseDir);
        console.log('baseDir 存在:', fs.existsSync(baseDir));
        
        const allFolders = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
        console.log('所有文件夹:', allFolders);
        
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
        
        console.log('前贴文件夹:', introFoldersDict);
        console.log('正片文件夹:', mainFoldersDict);
        
        const matchedPairs = [];
        for (const number of Object.keys(introFoldersDict).map(Number)) {
            if (mainFoldersDict[number]) {
                matchedPairs.push({ number, intro: introFoldersDict[number], main: mainFoldersDict[number] });
            }
        }
        
        console.log('匹配的配对:', matchedPairs);
        
        const unmatchedIntro = Object.keys(introFoldersDict).map(Number).filter(n => !mainFoldersDict[n]).map(n => introFoldersDict[n]);
        const unmatchedMain = Object.keys(mainFoldersDict).map(Number).filter(n => !introFoldersDict[n]).map(n => mainFoldersDict[n]);
        
        // 生成所有任务
        const allTasks = this.createTasks(baseDir, matchedPairs);
        console.log('生成的任务数量:', allTasks.length);
        console.log('第一个任务示例:', allTasks[0] ? JSON.stringify(allTasks[0], null, 2) : '无任务');
        
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
        
        console.log('=== VideoValidatorNode.analyzeFolders 结束 ===');
        console.log('返回结果:', JSON.stringify(result, null, 2));
        
        return result;
    }
    /**
     * 根据配对情况创建处理任务
     */
    createTasks(baseDir, matchedPairs) {
        console.log('=== VideoValidatorNode.createTasks 开始 ===');
        console.log('baseDir:', baseDir);
        console.log('matchedPairs:', matchedPairs);
        
        const videoPatterns = ['*.mp4', '*.avi', '*.mov', '*.mkv', '*.wmv', '*.flv'];
        const allTasks = [];
        for (const { number, intro, main } of matchedPairs) {
            console.log(`\n--- 处理配对 ${number}: ${intro} + ${main} ---`);
            
            const introFolderPath = path.join(baseDir, intro);
            const mainFolderPath = path.join(baseDir, main);
            
            console.log('introFolderPath:', introFolderPath);
            console.log('mainFolderPath:', mainFolderPath);
            console.log('introFolderPath 存在:', fs.existsSync(introFolderPath));
            console.log('mainFolderPath 存在:', fs.existsSync(mainFolderPath));
            
            // 获取视频文件
            let introVideos = [];
            let mainVideos = [];
            for (const pattern of videoPatterns) {
                const introPattern = `${introFolderPath.replace(/\\/g, '/')}/${pattern}`;
                const mainPattern = `${mainFolderPath.replace(/\\/g, '/')}/${pattern}`;
                
                console.log('introPattern:', introPattern);
                console.log('mainPattern:', mainPattern);
                
                const introMatches = glob.sync(introPattern);
                const mainMatches = glob.sync(mainPattern);
                
                console.log('introMatches:', introMatches);
                console.log('mainMatches:', mainMatches);
                
                introVideos.push(...introMatches);
                mainVideos.push(...mainMatches);
            }
            
            console.log('introVideos 总数:', introVideos.length);
            console.log('mainVideos 总数:', mainVideos.length);
            
            if (!introVideos.length || !mainVideos.length) {
                console.log('跳过此配对：缺少视频文件');
                continue;
            }
            
            // 创建结果文件夹
            const resultFolderName = `${main}结果`;
            const resultFolderPath = path.join(baseDir, resultFolderName);
            
            console.log('resultFolderPath:', resultFolderPath);
            
            if (!fs.existsSync(resultFolderPath)) {
                fs.mkdirSync(resultFolderPath);
                console.log('创建结果文件夹:', resultFolderPath);
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
        
        console.log('=== VideoValidatorNode.createTasks 结束 ===');
        console.log('总任务数:', allTasks.length);
        
        return allTasks;
    }
}
exports.VideoValidatorNode = VideoValidatorNode;
