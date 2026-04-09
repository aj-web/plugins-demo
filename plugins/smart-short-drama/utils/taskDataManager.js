/**
 * 任务数据管理器
 * 统一管理任务数据的读取和写入
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class TaskDataManager {
  /**
   * 构造函数
   * @param {string} fileName - JSON 文件名（例如：'smart-short-drama-data.json'）
   */
  constructor(fileName) {
    this.fileName = fileName;
    this.userDataPath = process.env.APPDATA || os.homedir();
    this.dirPath = path.join(this.userDataPath, 'plugins-demo');
    this.filePath = path.join(this.dirPath, fileName);
  }

  /**
   * 读取任务数据
   * @returns {Object} 任务数据对象，格式：{ version: '1.0', tasks: [], lastUpdate: '' }
   */
  readTaskData() {
    try {
      if (fs.existsSync(this.filePath)) {
        console.log('[TaskDataManager] 读取任务数据:', this.filePath);
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }

      console.log('[TaskDataManager] 任务数据文件不存在，返回空数据');
      return { version: '1.0', tasks: [] };
    } catch (error) {
      console.error('[TaskDataManager] 读取任务数据失败:', error);
      return { version: '1.0', tasks: [] };
    }
  }

  /**
   * 写入任务数据
   * @param {Object} data - 任务数据对象
   */
  writeTaskData(data) {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
        console.log('[TaskDataManager] 创建目录:', this.dirPath);
      }

      // 写入文件
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('[TaskDataManager] 任务数据已写入:', this.filePath);
    } catch (error) {
      console.error('[TaskDataManager] 写入任务数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有任务
   * @returns {Array} 任务列表
   */
  getTasks() {
    const data = this.readTaskData();
    return data.tasks || [];
  }

  /**
   * 添加任务（插入到列表头部）
   * @param {Object} task - 任务对象
   */
  addTask(task) {
    const data = this.readTaskData();
    const tasks = data.tasks || [];
    tasks.unshift(task);
    data.tasks = tasks;
    data.lastUpdate = new Date().toISOString();
    this.writeTaskData(data);
    console.log('[TaskDataManager] 任务已添加:', task.id);
  }

  /**
   * 更新任务（如果不存在则添加）
   * @param {Object} task - 任务对象
   */
  saveTask(task) {
    const data = this.readTaskData();
    const tasks = data.tasks || [];
    const index = tasks.findIndex((t) => t.id === task.id);

    if (index >= 0) {
      tasks[index] = task;
      console.log('[TaskDataManager] 任务已更新:', task.id);
    } else {
      tasks.unshift(task);
      console.log('[TaskDataManager] 任务已添加:', task.id);
    }

    data.tasks = tasks;
    data.lastUpdate = new Date().toISOString();
    this.writeTaskData(data);
  }

  /**
   * 删除任务
   * @param {string} taskId - 任务 ID
   * @returns {boolean} 是否删除成功
   */
  deleteTask(taskId) {
    const data = this.readTaskData();
    const tasks = data.tasks || [];
    const index = tasks.findIndex((t) => t.id === taskId);

    if (index >= 0) {
      tasks.splice(index, 1);
      data.tasks = tasks;
      data.lastUpdate = new Date().toISOString();
      this.writeTaskData(data);
      console.log('[TaskDataManager] 任务已删除:', taskId);
      return true;
    }

    console.log('[TaskDataManager] 任务不存在:', taskId);
    return false;
  }

  /**
   * 获取文件路径
   * @returns {string} 文件完整路径
   */
  getFilePath() {
    return this.filePath;
  }
}

module.exports = TaskDataManager;
