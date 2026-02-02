import * as cron from 'node-cron';
import { pluginManager } from './plugin-manager';
import { logger } from '../logger';

/**
 * 通用调度器配置接口
 */
interface SchedulerConfig {
  pluginName: string; // 插件名称
  eventType: string; // 要触发的事件类型
  params: any; // 事件参数（任意结构）
  cronExpression: string; // Cron 表达式
  enabled: boolean; // 是否启用
}

class SchedulerService {
  private tasks = new Map<string, cron.ScheduledTask>();
  private configs = new Map<string, SchedulerConfig>();

  /**
   * 启动通用定时任务
   * @param config 任务配置
   * @returns 启动结果
   */
  startPluginScheduledTask(config: SchedulerConfig) {
    const taskKey = `${config.pluginName}:${config.eventType}`;

    logger.log('[Scheduler] 启动定时任务:', { taskKey, config });

    // 停止已有任务
    if (this.tasks.has(taskKey)) {
      this.tasks.get(taskKey)?.stop();
      logger.log('[Scheduler] 停止旧任务:', taskKey);
    }

    if (!config.enabled) {
      logger.log('[Scheduler] 任务未启用，跳过');
      return { success: false, message: '任务未启用' };
    }

    // 创建定时任务（通用实现）
    const task = cron.schedule(config.cronExpression, async () => {
      logger.log(`[Scheduler] 定时任务触发: ${taskKey} at ${new Date().toISOString()}`);

      try {
        // 通用调用：调度器不关心具体业务逻辑
        const result = await pluginManager.triggerEvent(config.pluginName, config.eventType, config.params);

        logger.log('[Scheduler] 定时任务执行完成:', result);
      } catch (error) {
        logger.error('[Scheduler] 定时任务执行失败:', error);
      }
    });

    this.tasks.set(taskKey, task);
    this.configs.set(taskKey, config);

    logger.log('[Scheduler] 定时任务已启动:', taskKey);

    return {
      success: true,
      taskKey,
      message: `定时任务已启动 (${config.cronExpression})`
    };
  }

  /**
   * 停止定时任务
   */
  stopTask(taskKey: string) {
    if (this.tasks.has(taskKey)) {
      this.tasks.get(taskKey)?.stop();
      this.tasks.delete(taskKey);
      this.configs.delete(taskKey);
      logger.log('[Scheduler] 定时任务已停止:', taskKey);
      return { success: true };
    }
    return { success: false, message: '任务不存在' };
  }

  /**
   * 获取任务列表
   */
  listTasks() {
    const taskList: any[] = [];
    this.configs.forEach((config, key) => {
      taskList.push({
        key,
        ...config,
        running: this.tasks.has(key)
      });
    });
    return taskList;
  }

  /**
   * 清理所有任务
   */
  cleanup() {
    this.tasks.forEach((task, key) => {
      task.stop();
      logger.log('[Scheduler] 停止任务:', key);
    });
    this.tasks.clear();
    this.configs.clear();
    logger.log('[Scheduler] 所有定时任务已清理');
  }
}

export const scheduler = new SchedulerService();
