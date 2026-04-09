/**
 * 模板下载节点
 * 负责下载各种Excel模板
 */

const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Redirect console.* to logger methods for persistent file logging while preserving console output.
try {
  const _origConsoleLog = console.log.bind(console);
  console.log = (...args) => {
    try {
      logger.info(args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origConsoleLog(...args);
  };
  console.info = (...args) => {
    try {
      logger.info(args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
  };
  console.warn = (...args) => {
    try {
      logger.warn(args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origConsoleLog(...args);
  };
  console.error = (...args) => {
    try {
      logger.error(args[0], args.length > 1 ? args[1] : undefined);
    } catch (e) {}
    _origConsoleLog(...args);
  };
} catch (e) {
  // ignore
}

class TemplateDownloader {
  constructor() {
    console.log('[TemplateDownload] 节点已初始化');
  }

  /**
   * 复制文件到指定目录
   * @param {string} templateType - 模板类型 ('drama' 或 'sellingPoint')
   * @param {string} targetFolderPath - 目标文件夹路径（用户选择的保存位置）
   * @returns {Promise<Object>} 复制结果
   */
  async copyFile(templateType, targetFolderPath) {
    console.log('[TemplateDownload] 开始复制文件...');
    console.log('[TemplateDownload] 模板类型:', templateType);
    console.log('[TemplateDownload] 目标文件夹:', targetFolderPath);

    try {
      // 1. 确定模板文件名
      let templateFileName = '';
      if (templateType === 'drama') {
        templateFileName = '剧目列表模板.xlsx';
      } else {
        throw new Error(`不支持的模板类型: ${templateType}`);
      }

      // 2. 尝试多个可能的路径（兼容开发和打包环境）
      const possiblePaths = [
        // 开发环境：相对于当前文件的路径
        path.join(__dirname, '../templates', templateFileName),
        // 打包环境：从 resources 目录读取
        process.resourcesPath 
          ? path.join(process.resourcesPath, 'plugins', 'smart-short-drama', 'templates', templateFileName)
          : null
      ].filter(Boolean); // 过滤掉 null 值

      console.log('[TemplateDownload] 尝试查找模板文件，候选路径:', possiblePaths);

      // 3. 检查哪个路径存在
      let templatePath = null;
      for (const candidatePath of possiblePaths) {
        try {
          await fs.access(candidatePath);
          templatePath = candidatePath;
          console.log('[TemplateDownload] 找到模板文件:', templatePath);
          break;
        } catch (error) {
          console.log('[TemplateDownload] 路径不存在:', candidatePath);
        }
      }

      // 4. 如果所有路径都不存在，抛出错误
      if (!templatePath) {
        console.error('[TemplateDownload] 所有候选路径都不存在');
        throw new Error(`模板文件不存在: ${templateFileName}`);
      }

      // 5. 复制文件到目标文件夹
      const targetFilePath = path.join(targetFolderPath, templateFileName);
      console.log('[TemplateDownload] 目标文件路径:', targetFilePath);

      await fs.copyFile(templatePath, targetFilePath);
      console.log('[TemplateDownload] 文件复制成功');

      return {
        success: true,
        filePath: targetFilePath,
        message: '模板下载成功'
      };
    } catch (error) {
      console.error('[TemplateDownload] 复制文件失败:', error);
      return {
        success: false,
        message: `复制失败: ${error.message}`
      };
    }
  }
}

exports.TemplateDownloader = TemplateDownloader;