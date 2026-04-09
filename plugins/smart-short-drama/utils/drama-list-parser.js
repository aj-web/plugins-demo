/**
 * 剧目列表解析器
 * 负责解析剧目列表 Excel 文件
 */

const fs = require('fs');
const path = require('path');

class DramaListParser {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls'];
  }

  /**
   * 解析剧目列表 Excel 文件
   * @param {string} filePath - Excel 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseDramaList(filePath) {
    try {
      console.log('[DramaListParser] 开始解析剧目列表:', filePath);

      // 验证文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error('[DramaListParser] 文件不存在:', filePath);
        return {
          success: false,
          message: '剧目列表文件不存在',
          dramaNames: []
        };
      }

      // 验证文件格式
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        console.error('[DramaListParser] 不支持的文件格式:', ext);
        return {
          success: false,
          message: '不支持的文件格式，请使用 .xlsx 或 .xls 文件',
          dramaNames: []
        };
      }

      // 读取 Excel 文件
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);

      // 获取 Sheet1
      const sheetNames = workbook.SheetNames;
      console.log('[DramaListParser] 工作表列表:', sheetNames);

      if (sheetNames.length === 0) {
        console.error('[DramaListParser] Excel 文件中没有工作表');
        return {
          success: false,
          message: 'Excel 文件中没有工作表',
          dramaNames: []
        };
      }

      // 读取第一个工作表（Sheet1）
      const sheet1Name = sheetNames[0];
      const worksheet = workbook.Sheets[sheet1Name];
      console.log('[DramaListParser] 读取工作表:', sheet1Name);

      // 将工作表转换为 JSON 数据（带表头）
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,  // 返回数组形式
        defval: '', // 空单元格默认值
        raw: false  // 将数字转换为字符串
      });

      console.log('[DramaListParser] 工作表数据行数:', jsonData.length);

      if (jsonData.length === 0) {
        console.warn('[DramaListParser] 工作表为空');
        return {
          success: true,
          message: '工作表为空，没有剧目数据',
          dramaNames: []
        };
      }

      // 提取剧名列表
      const dramaNames = this.extractDramaNames(jsonData);

      console.log('[DramaListParser] 解析完成');
      console.log('[DramaListParser] 提取到的剧名数量:', dramaNames.length);
      console.log('[DramaListParser] 提取到的所有剧名:', dramaNames);

      return {
        success: true,
        message: `成功解析 ${dramaNames.length} 个剧目`,
        dramaNames: dramaNames
      };
    } catch (error) {
      console.error('[DramaListParser] 解析剧目列表失败:', error);
      return {
        success: false,
        message: `解析剧目列表失败: ${error.message}`,
        dramaNames: []
      };
    }
  }

  /**
   * 从 Excel 数据中提取剧名
   * @param {Array} jsonData - Excel 数据（二维数组）
   * @returns {Array<string>} 剧名列表
   */
  extractDramaNames(jsonData) {
    const dramaNames = [];

    // 假设第一行是表头，从第二行开始读取
    // 假设剧名在第一列（A列，索引0）
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // 跳过空行
      if (!row || row.length === 0) {
        continue;
      }

      // 获取第一列的值（剧名）
      const dramaName = row[0];

      // 跳过空值
      if (!dramaName || dramaName.toString().trim() === '') {
        continue;
      }

      // 添加到剧名列表（去除首尾空格）
      const cleanName = dramaName.toString().trim();
      dramaNames.push(cleanName);
    }

    return dramaNames;
  }

  /**
   * 验证 Excel 文件
   * @param {string} filePath - Excel 文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async validateExcelFile(filePath) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: '文件不存在'
        };
      }

      // 检查文件格式
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        return {
          success: false,
          message: '不支持的文件格式'
        };
      }

      // 检查文件是否可读
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        return {
          success: false,
          message: '文件无法读取，请检查文件权限'
        };
      }

      return {
        success: true,
        message: '文件验证通过'
      };
    } catch (error) {
      return {
        success: false,
        message: `文件验证失败: ${error.message}`
      };
    }
  }
}

module.exports = new DramaListParser();

