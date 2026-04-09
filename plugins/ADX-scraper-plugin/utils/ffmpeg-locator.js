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
exports.findLocalFfmpeg = findLocalFfmpeg;
exports.findLocalFfprobe = findLocalFfprobe;
exports.findFfmpegInDir = findFfmpegInDir;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function findLocalFfmpeg() {
    const possiblePaths = [
        path.join(process.resourcesPath || '', 'ffmpeg.exe'),
        '/usr/bin/ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'D:\\ffmpeg\\bin\\ffmpeg.exe'
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    try {
        let ffmpegPath = null;
        try {
            const which = require('which');
            ffmpegPath = which.sync('ffmpeg', { nothrow: true });
        }
        catch (e) {
            const { execSync } = require('child_process');
            if (process.platform === 'win32') {
                ffmpegPath = execSync('where ffmpeg').toString().split(/\r?\n/)[0];
            }
            else {
                ffmpegPath = execSync('which ffmpeg').toString().split(/\r?\n/)[0];
            }
        }
        if (ffmpegPath && fs.existsSync(ffmpegPath.trim())) {
            return ffmpegPath.trim();
        }
    }
    catch (e) {
    }
    return null;
}
function findLocalFfprobe() {
    const possiblePaths = [
        path.join(process.resourcesPath || '', 'ffprobe.exe'),
        '/usr/bin/ffprobe',
        'C:\\ffmpeg\\bin\\ffprobe.exe',
        'D:\\ffmpeg\\bin\\ffprobe.exe'
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    try {
        let ffprobePath = null;
        try {
            const which = require('which');
            ffprobePath = which.sync('ffprobe', { nothrow: true });
        }
        catch (e) {
            const { execSync } = require('child_process');
            if (process.platform === 'win32') {
                ffprobePath = execSync('where ffprobe').toString().split(/\r?\n/)[0];
            }
            else {
                ffprobePath = execSync('which ffprobe').toString().split(/\r?\n/)[0];
            }
        }
        if (ffprobePath && fs.existsSync(ffprobePath.trim())) {
            return ffprobePath.trim();
        }
    }
    catch (e) {
    }
    return null;
}
function findFfmpegInDir(dir) {
    if (!dir || typeof dir !== 'string')
        return null;
    const candidates = ['ffmpeg', 'ffmpeg.exe'];
    for (const name of candidates) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}
