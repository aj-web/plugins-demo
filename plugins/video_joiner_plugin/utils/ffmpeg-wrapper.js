"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVideoMetadata = getVideoMetadata;
async function getVideoMetadata(filePath) {
    // ...实现...
    console.log(filePath);
    return {
        width: 1920,
        height: 1080,
        duration: 100,
        bitrate: 1000000,
        codec: 'h264',
        fps: 30,
    };
}
