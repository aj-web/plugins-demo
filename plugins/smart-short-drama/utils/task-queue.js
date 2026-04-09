/**
 * 任务队列管理器（单例）
 * 负责管理所有任务的串行执行
 */
class TaskQueue {
  constructor() {
    this.queue = []; // 任务队列
    this.isProcessing = false; // 是否正在处理任务
    this.taskManager = null; // TaskDataManager 实例
  }

  /**
   * 懒加载初始化
   * @param {Object} taskManager - TaskDataManager 实例
   */
  init(taskManager) {
    if (!this.taskManager) {
      this.taskManager = taskManager;
      console.log('[TaskQueue] 任务队列已初始化');

      // 重置状态，防止插件切换后状态异常
      this.isProcessing = false;

      // 检查是否有遗留的"执行中"任务（插件重启导致的孤儿任务）
      this.recoverOrphanTasks();
    }
  }

  /**
   * 恢复孤儿任务（插件重启时"执行中"的任务）
   */
  recoverOrphanTasks() {
    try {
      const data = this.taskManager.readTaskData();
      let hasOrphans = false;

      data.tasks.forEach((task) => {
        if (task.status === '执行中' || task.status === '待执行') {
          console.warn(`[TaskQueue] 发现孤儿任务: ${task.id} (${task.module}) - 状态: ${task.status}`);
          // 将"执行中"的任务标记为"失败"
          if (task.status === '执行中') {
            task.status = '失败';
            if (task.module === '爆款复刻') {
              task.bytegrowth.message = '插件重启，任务中断';
              task.usergrowth.message = '插件重启，任务中断';
            } else if (task.module === '爆款扒产') {
              task.result.message = '插件重启，任务中断';
            }
            hasOrphans = true;
          }
        }
      });

      if (hasOrphans) {
        this.taskManager.writeTaskData(data);
        console.log('[TaskQueue] 孤儿任务已处理');
      }
    } catch (error) {
      console.error('[TaskQueue] 恢复孤儿任务失败:', error);
    }
  }

  /**
   * 添加任务到队列
   * @param {Object} task - 完整的 Task 对象
   * @param {Function} executor - 执行函数，接收 task.params 作为参数
   * @returns {Promise<string>} 返回 taskId
   */
  async addTask(task, executor) {
    try {
      console.log(`[TaskQueue] 准备添加任务: ${task.id} (${task.module})`);
      console.log(`[TaskQueue] 当前队列状态 - 长度: ${this.queue.length}, 正在处理: ${this.isProcessing}`);

      // 1. 写入 JSON（状态：待执行）
      await this.saveTaskToJson(task, '待执行');

      // 2. 加入队列
      this.queue.push({ task, executor });
      console.log(`[TaskQueue] 任务已加入队列: ${task.id}, 当前队列长度: ${this.queue.length}`);

      // 3. 触发处理
      this.processNext();

      return task.id;
    } catch (error) {
      console.error(`[TaskQueue] 添加任务失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 处理队列中的下一个任务
   */
  async processNext() {
    // 如果正在处理或队列为空，直接返回
    if (this.isProcessing) {
      console.log(`[TaskQueue] 正在处理任务，跳过 processNext`);
      return;
    }

    if (this.queue.length === 0) {
      console.log(`[TaskQueue] 队列为空，无任务可处理`);
      return;
    }

    this.isProcessing = true;
    const { task, executor } = this.queue.shift();
    console.log(`[TaskQueue] 从队列中取出任务: ${task.id}, 剩余队列长度: ${this.queue.length}`);

    try {
      console.log(`[TaskQueue] ========== 开始执行任务: ${task.id} (${task.module}) ==========`);

      // 1. 更新状态为"执行中"
      await this.updateTaskStatus(task.id, '执行中');

      // 2. 执行任务（传入 params）
      const result = await executor(task.params);

      // 3. 更新状态为"已完成"，并保存结果
      await this.updateTaskResult(task.id, '已完成', result);

      console.log(`[TaskQueue] ========== 任务执行成功: ${task.id} ==========`);
    } catch (error) {
      console.error(`[TaskQueue] ========== 任务执行失败: ${task.id} ==========`, error);

      // 更新状态为"失败"
      await this.updateTaskResult(task.id, '失败', this.createFailureResult(task.module, error));
    } finally {
      this.isProcessing = false;

      // 继续处理下一个任务
      if (this.queue.length > 0) {
        console.log(`[TaskQueue] 准备处理下一个任务，剩余 ${this.queue.length} 个任务`);
        // 稍微延迟一下，避免任务之间冲突
        setTimeout(() => this.processNext(), 1000);
      } else {
        console.log(`[TaskQueue] 队列已清空`);
      }
    }
  }

  /**
   * 保存任务到 JSON（创建新任务）
   */
  async saveTaskToJson(task, status) {
    try {
      const data = this.taskManager.readTaskData();
      task.status = status;
      data.tasks.unshift(task); // 插入到最前面
      this.taskManager.writeTaskData(data);
      console.log(`[TaskQueue] 任务已写入 JSON: ${task.id} (状态: ${status})`);
    } catch (error) {
      console.error(`[TaskQueue] 写入 JSON 失败: ${task.id}`, error);
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId, status) {
    try {
      const data = this.taskManager.readTaskData();
      const task = data.tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = status;
        this.taskManager.writeTaskData(data);
        console.log(`[TaskQueue] 任务状态已更新: ${taskId} -> ${status}`);
      } else {
        console.warn(`[TaskQueue] 未找到任务: ${taskId}`);
      }
    } catch (error) {
      console.error(`[TaskQueue] 更新状态失败: ${taskId}`, error);
    }
  }

  /**
   * 更新任务结果
   */
  async updateTaskResult(taskId, status, result) {
    try {
      const data = this.taskManager.readTaskData();
      const task = data.tasks.find((t) => t.id === taskId);

      if (task) {
        task.status = status;

        // 记录完成时间（已完成或失败时）
        if (status === '已完成' || status === '失败') {
          const now = new Date();
          task.completedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }

        // 根据 module 类型更新不同的字段
        if (task.module === '爆款复刻') {
          task.bytegrowth = result.bytegrowth || {
            message: '',
            outputPaths: '',
            succDramas: [],
            failedDramas: [],
            fragmentCounts: {}
          };
          task.usergrowth = result.usergrowth || {
            message: '',
            outputPaths: '',
            succDramas: [],
            failedDramas: [],
            originalCounts: {}
          };
        } else if (task.module === '高光混剪') {
          // 高光混剪的结果结构
          task.usergrowth = result.usergrowth || {
            message: '',
            outputPaths: [],
            originalCounts: {}
          };
          
          // 更新 outputPath
          if (result.mixResult && result.mixResult.outputPath) {
            // 完整任务：使用混剪后的实际路径
            task.outputPath = result.mixResult.outputPath;
          } else if (task.params.downloadOnly && result.usergrowth && result.usergrowth.outputPaths && result.usergrowth.outputPaths.length > 0) {
            // 仅下载模式：提取下载目录的父文件夹路径
            // 例如：D:\ShortDrama\短剧原片\2026-02-04\剧名 → D:\ShortDrama\短剧原片\2026-02-04
            const firstPath = result.usergrowth.outputPaths[0];
            const pathParts = firstPath.replace(/\\/g, '/').split('/');
            pathParts.pop(); // 移除最后一部分（剧名）
            task.outputPath = pathParts.join('\\');
          }
          
          // 保存简化的 result
          task.result = {
            success: result.success,
            message: result.message
          };
        } else if (task.module === '爆款扒产') {
          // 爆款扒取的结果结构
          task.result = result.result || {
            successCount: 0,
            failCount: 0,
            message: result.message || ''
          };
          // 更新 dramas 字段（选中的剧目列表）
          if (result.dramas) {
            task.dramas = result.dramas;
          }
        } else {
          // 其他模块的结果处理
          task.result = result;
        }

        this.taskManager.writeTaskData(data);
        console.log(`[TaskQueue] 任务结果已更新: ${taskId} (状态: ${status})`);
      } else {
        console.warn(`[TaskQueue] 未找到任务: ${taskId}`);
      }
    } catch (error) {
      console.error(`[TaskQueue] 更新结果失败: ${taskId}`, error);
    }
  }

  /**
   * 创建失败结果对象
   */
  createFailureResult(module, error) {
    const errorMessage = error.message || '未知错误';

    if (module === '爆款复刻') {
      return {
        bytegrowth: {
          message: errorMessage,
          outputPaths: '',
          succDramas: [],
          failedDramas: [],
          fragmentCounts: {}
        },
        usergrowth: {
          message: errorMessage,
          outputPaths: '',
          succDramas: [],
          failedDramas: [],
          originalCounts: {}
        }
      };
    } else if (module === '爆款扒产') {
      return {
        result: {
          successCount: 0,
          failCount: 0,
          message: errorMessage
        },
        dramas: []
      };
    } else if (module === '爆款混剪') {
      return {
        success: false,
        message: errorMessage,
        successCount: 0,
        failedCount: 0,
        successDramas: [],
        failedDramas: [],
        details: {}
      };
    } else if (module === '高光混剪') {
      return {
        success: false,
        message: errorMessage,
        processedCount: 0,
        outputPath: ''
      };
    } else {
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * 检查是否正在处理任务
   */
  isProcessingTask() {
    return this.isProcessing;
  }

  /**
   * 获取队列状态（用于调试）
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      tasks: this.queue.map((item) => ({ id: item.task.id, module: item.task.module }))
    };
  }

  /**
   * 强制恢复队列执行（用于异常情况）
   */
  forceResume() {
    console.warn('[TaskQueue] 强制恢复队列执行');
    if (this.queue.length > 0 && !this.isProcessing) {
      console.log('[TaskQueue] 队列有任务但未在执行，尝试恢复...');
      this.processNext();
    } else if (this.isProcessing) {
      console.warn('[TaskQueue] 任务正在执行中，无法强制恢复');
    } else {
      console.log('[TaskQueue] 队列为空，无需恢复');
    }
  }
}

// 导出单例
module.exports = new TaskQueue();
