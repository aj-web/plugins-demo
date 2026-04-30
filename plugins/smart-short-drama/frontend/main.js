import { Sidebar } from './Sidebar.js';
import { TaskDashboard } from './TaskDashboard.js';
import { AdxScraper } from './AdxScraper.js';
import { ReplicationSettings } from './ReplicationSettings.js';
import { RemixTool } from './RemixTool.js';
import { HighlightTool } from './HighlightTool.js';
import { ViewState, AssetCategory, TaskModule, TaskStatus } from './constants.js';
import { triggerEvent, invokeIpc, unwrapIpcResponse } from './ipc.js';
import { showToast } from './Prompt.js';

const { createApp, ref, h, watch, onMounted } = Vue;

// ==================== 任务管理 ====================
// 通过 IPC 读取 JSON 文件
const loadTasksFromJson = async () => {
  try {
    // 使用 appdata:// 前缀，主进程会自动解析为实际路径
    const dataPath = 'appdata://plugins-demo/smart-short-drama-data.json';

    // 使用 invokeIpc 调用 read-json-file（直接传参数，不传数组）
    const result = await invokeIpc('read-json-file', dataPath);

    if (result.success && result.data) {
      const tasks = result.data.tasks || [];
      return tasks;
    } else {
      console.warn('[loadTasksFromJson] 读取失败:', result.error);
      return [];
    }
  } catch (e) {
    console.error('[loadTasksFromJson] 加载任务列表失败:', e);
    return [];
  }
};

// 任务保存统一由后端处理，前端直接读取 JSON 文件任务列表已加载

const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// ==================== App 组件 ====================
const App = {
  setup() {
    const currentView = ref(ViewState.DASHBOARD);
    const currentAssetCategory = ref(AssetCategory.RUNS);
    const tasks = ref([]);

    // 加载任务列表
    const loadTasks = async () => {
      const loadedTasks = await loadTasksFromJson();
      tasks.value = loadedTasks;
      // 只在首次加载或任务数变化时打印日志
      if (loadTasks.lastCount !== tasks.value.length) {
        console.log('[App] 任务列表已更新，当前任务数:', tasks.value.length);
        loadTasks.lastCount = tasks.value.length;
      }
    };
    loadTasks.lastCount = 0;

    // 任务列表轮询管理
    let refreshTimer = null;

    const startTaskPolling = async () => {
      // 如果已经在轮询，先停止
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }

      // 立即加载一次
      await loadTasks();

      // 启动定时轮询（每 3 秒）
      refreshTimer = setInterval(async () => {
        await loadTasks();
      }, 3000);

      console.log('[App] 任务列表轮询已启动（每3秒）');
    };

    const stopTaskPolling = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        console.log('[App] 任务列表轮询已停止');
      }
    };

    // 组件挂载时初始化
    onMounted(async () => {
      console.log('[App] onMounted 触发');

      // 等待 PluginView 的 postMessage 桥接建立完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 首次加载任务列表
      await loadTasks();

      // 如果初始页面是任务列表，启动轮询
      if (currentView.value === ViewState.DASHBOARD) {
        await startTaskPolling();
      }
    });

    // 组件卸载时清理定时器
    Vue.onBeforeUnmount(() => {
      stopTaskPolling();
    });

    // 所有任务状态由后端队列管理，前端只负责展示

    // 重试任务（重新提交任务到队列）
    const retryTask = async (taskId) => {
      const originalTask = tasks.value.find((t) => t.id === taskId);
      if (!originalTask) {
        console.warn('[App] 未找到任务:', taskId);
        showToast({ message: '未找到任务', type: 'warning', duration: 2000 });
        return;
      }

      console.log('[App] 准备重试任务:', originalTask);
      console.log('[App] 任务参数 (params):', originalTask.params);

      try {
        let eventType = null;
        let args = null;

        // 根据任务模块调用不同的后端接口
        if (originalTask.module === TaskModule.REPLICATION) {
          eventType = 'replication-auto-start';
          // 从 params 中提取参数并转换为数组
          // 使用 JSON.parse(JSON.stringify()) 确保对象可序列化
          const exportConfig = originalTask.params.exportConfig 
            ? JSON.parse(JSON.stringify(originalTask.params.exportConfig)) 
            : {};
          args = [
            originalTask.params.outputPath,
            originalTask.params.processCount,
            exportConfig,
            originalTask.params.dedupeExpireDays || 30,
            originalTask.params.isScheduledTask || false
          ];
        } else if (originalTask.module === TaskModule.ADX) {
          eventType = 'adx-auto-start';
          // 从 params 中提取参数并转换为数组
          // 使用 JSON.parse(JSON.stringify()) 确保对象可序列化
          const exportConfig = originalTask.params.exportConfig 
            ? JSON.parse(JSON.stringify(originalTask.params.exportConfig)) 
            : {};
          args = [
            originalTask.params.outputPath,
            originalTask.params.processCount,
            exportConfig,
            originalTask.params.dedupeExpireDays || 30,
            originalTask.params.isScheduledTask || false
          ];
        } else if (originalTask.module === '爆款混剪') {
          eventType = 'mix-edit-auto-start';
          // 验证必需参数
          if (!originalTask.params.replicationClipsPath || !originalTask.params.scriptsPath || !originalTask.params.outputPath) {
            console.error('[App] 爆款混剪任务参数不完整:', originalTask.params);
            showToast({ message: '任务参数不完整，无法重试', type: 'error', duration: 3000 });
            return;
          }
          // 从 params 中提取参数并转换为数组
          // 使用 JSON.parse(JSON.stringify()) 确保对象可序列化
          const overlayModes = originalTask.params.overlayModes 
            ? JSON.parse(JSON.stringify(originalTask.params.overlayModes)) 
            : { hook: true, post: false };
          args = [
            originalTask.params.replicationClipsPath,
            originalTask.params.scriptsPath,
            originalTask.params.outputPath,
            originalTask.params.processCount || 5,
            overlayModes,
            originalTask.params.hookSeconds || 3,
            false // 重试时设置为非定时任务
          ];
          console.log('[App] 爆款混剪重试参数:', args);
        } else if (originalTask.module === '高光混剪') {
          // 判断是否为"仅下载"模式
          if (originalTask.params.downloadOnly === true) {
            eventType = 'highlight-parse-and-download';
            // 验证必需参数
            if (!originalTask.params.dramaListFilePath || !originalTask.params.outputPath) {
              console.error('[App] 高光混剪（仅下载）任务参数不完整:', originalTask.params);
              showToast({ message: '任务参数不完整，无法重试', type: 'error', duration: 3000 });
              return;
            }
            // 从 params 中提取参数（仅下载模式）
            args = [
              originalTask.params.dramaListFilePath,
              originalTask.params.outputPath
            ];
            console.log('[App] 高光混剪（仅下载）重试参数:', args);
          } else {
            eventType = 'highlight-mix-edit-auto-start';
            // 验证必需参数
            if (!originalTask.params.endFrameFolderPath || !originalTask.params.outputPath) {
              console.error('[App] 高光混剪任务参数不完整:', originalTask.params);
              showToast({ message: '任务参数不完整，无法重试', type: 'error', duration: 3000 });
              return;
            }
            // 从 params 中提取参数并转换为数组
            args = [
              originalTask.params.dramaListFilePath || '',
              originalTask.params.imageOverlayFolderPath || '',
              originalTask.params.endFrameFolderPath,
              originalTask.params.outputPath,
              originalTask.params.endRetentionSeconds || 10,
              false // 重试时设置为非定时任务
            ];
            console.log('[App] 高光混剪重试参数:', args);
          }
        }

        if (eventType && args) {
          showToast({ message: '正在重新提交任务...', type: 'info', duration: 2000 });
          
          const res = await triggerEvent(eventType, { args });
          const biz = unwrapIpcResponse(res);

          if (biz && biz.success) {
            console.log(`[App] 重试任务已提交 (${originalTask.module}):`, biz.taskId);
            showToast({ 
              message: `任务已重新提交！新任务ID: ${biz.taskId}`, 
              type: 'success', 
              duration: 3000 
            });
            // 刷新任务列表
            await loadTasks();
          } else {
            console.error(`[App] 重试任务失败 (${originalTask.module}):`, biz?.message);
            showToast({ 
              message: '重试失败: ' + (biz?.message || '未知错误'), 
              type: 'error', 
              duration: 3000 
            });
          }
        } else {
          console.warn(`[App] 暂不支持重试模块: ${originalTask.module}`);
          showToast({ 
            message: `暂不支持重试模块: ${originalTask.module}`, 
            type: 'warning', 
            duration: 2000 
          });
        }
      } catch (error) {
        console.error('[App] 重试任务失败:', error);
        showToast({ 
          message: '重试失败: ' + error.message, 
          type: 'error', 
          duration: 3000 
        });
      }
    };

    // 打开文件夹
    const openTaskFolder = async (taskId) => {
      const task = tasks.value.find((t) => t.id === taskId);
      const folderPath = task?.outputPath;

      if (folderPath) {
        try {
          await invokeIpc('open-folder', folderPath);
        } catch (e) {
          console.error('打开文件夹失败:', e);
        }
      } else {
        console.warn('任务没有输出路径:', task);
      }
    };

    const setCurrentView = async (view) => {
      const previousView = currentView.value;
      currentView.value = view;

      // 切换到任务列表时启动轮询
      if (view === ViewState.DASHBOARD) {
        console.log('[App] 切换到任务列表，启动轮询...');
        await startTaskPolling();
      }
      // 离开任务列表时停止轮询
      else if (previousView === ViewState.DASHBOARD && view !== ViewState.DASHBOARD) {
        console.log('[App] 离开任务列表，停止轮询...');
        stopTaskPolling();
      }
    };

    const setCurrentAssetCategory = (category) => {
      currentAssetCategory.value = category;
    };

    return () =>
      h('div', { class: 'flex h-screen bg-background text-textMain font-sans overflow-hidden' }, [
        h(Sidebar, {
          currentView: currentView.value,
          currentAssetCategory: currentAssetCategory.value,
          onChangeView: setCurrentView,
          onChangeAssetCategory: setCurrentAssetCategory
        }),
        h('main', { class: 'flex-1 overflow-auto relative bg-background' }, [
          currentView.value === ViewState.DASHBOARD
            ? h(TaskDashboard, {
                tasks: tasks.value,
                onRetry: retryTask,
                onOpenFolder: openTaskFolder
              })
            : currentView.value === ViewState.ADX_SCRAPER
            ? h(AdxScraper, { onShowTasks: () => setCurrentView(ViewState.DASHBOARD) })
            : currentView.value === ViewState.REPLICATION
            ? h(ReplicationSettings, { onShowTasks: () => setCurrentView(ViewState.DASHBOARD) })
            : currentView.value === ViewState.REMIX
            ? h(RemixTool, { assets: [], onShowTasks: () => setCurrentView(ViewState.DASHBOARD) })
            : currentView.value === ViewState.HIGHLIGHT
            ? h(HighlightTool, { assets: [], onShowTasks: () => setCurrentView(ViewState.DASHBOARD) })
            : h('div', { class: 'p-8 text-center text-textSecondary' }, '页面开发中...')
        ])
      ]);
  }
};

// ==================== 创建应用并挂载 ====================
const app = createApp(App);
app.mount('#root');
