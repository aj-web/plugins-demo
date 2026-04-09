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
exports.ExcelReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ExcelReader {
    constructor() {
        this.supportedFormats = ['.xlsx', '.xls'];
    }
    async readExcel(filePath, options = {}) {
        try {
            const { sheetIndex = 0, hasHeader = true, maxRows = 1000 } = options;
            if (!fs.existsSync(filePath)) {
                return { success: false, message: '文件不存在' };
            }
            const ext = path.extname(filePath).toLowerCase();
            if (!this.supportedFormats.includes(ext)) {
                return { success: false, message: '不支持的文件格式，请使用.xlsx或.xls文件' };
            }
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            if (sheetIndex >= sheetNames.length) {
                return { success: false, message: `工作表索引超出范围，共有${sheetNames.length}个工作表` };
            }
            const sheetName = sheetNames[sheetIndex];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: '',
                raw: false
            });
            let processedData = jsonData;
            let headers = [];
            if (hasHeader && jsonData.length > 0) {
                headers = jsonData[0];
                processedData = jsonData.slice(1);
            }
            if (processedData.length > maxRows) {
                processedData = processedData.slice(0, maxRows);
            }
            let result = processedData;
            if (hasHeader && headers.length > 0) {
                result = processedData.map((row) => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index] || '';
                    });
                    return obj;
                });
            }
            console.log(`成功读取Excel文件: ${filePath}`);
            console.log(`工作表: ${sheetName}`);
            console.log(`数据行数: ${result.length}`);
            if (hasHeader && headers.length > 0) {
                console.log(`表头: ${headers.join(', ')}`);
            }
            return {
                success: true,
                data: result,
                message: `成功读取${result.length}行数据`
            };
        }
        catch (error) {
            console.error('读取Excel文件失败:', error);
            return {
                success: false,
                message: `读取Excel文件失败: ${error.message}`
            };
        }
    }
    async getExcelInfo(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, message: '文件不存在' };
            }
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const info = {
                fileName: path.basename(filePath),
                sheetCount: sheetNames.length,
                sheetNames: sheetNames,
                fileSize: fs.statSync(filePath).size
            };
            return {
                success: true,
                info: info,
                message: `文件包含${sheetNames.length}个工作表`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `获取文件信息失败: ${error.message}`
            };
        }
    }
}
exports.ExcelReader = ExcelReader;
