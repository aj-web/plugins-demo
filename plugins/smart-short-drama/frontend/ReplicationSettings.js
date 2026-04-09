import { IconComponents } from './icons.js';
import { TaskModule, REPLICATION_READINESS, TaskStatus } from './constants.js';
import { ReadinessPanel } from './components.js';
import { fetchQiancangDataWithCache } from './dataSourceUtils.js';
import { triggerEvent, invokeIpc, unwrapIpcResponse } from './ipc.js';
import { showToast } from './Prompt.js';

const { h, ref, onMounted, watch } = Vue;

export const ReplicationSettings = {
  props: [],
  emits: ['show-tasks'], // 移除了 add-task 和 execute-task
  setup(props, { emit }) {
    const loadState = (key, defaultValue) => {
      try {
        const saved = localStorage.getItem('replication-' + key);
        return saved !== null ? JSON.parse(saved) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    const saveState = (key, value) => {
      try {
        localStorage.setItem('replication-' + key, JSON.stringify(value));
      } catch (e) {
        console.error('保存状态失败:', e);
      }
    };

    const autoSchedule = ref(loadState('autoSchedule', false));
    const processCount = ref(loadState('processCount', 5));
    const homepageSource = ref(loadState('homepageSource', '短剧原声 (系统默认)'));
    const outputPath = ref(loadState('outputPath', 'D:/ShortDrama'));
    const isUsergrowthLoggedIn = ref(loadState('isUsergrowthLoggedIn', false));

    watch(autoSchedule, async (val) => {
      saveState('autoSchedule', val);
      // 当开关变化时，处理定时任务
      await handleScheduleToggle(val);
    });
    watch(processCount, (val) => saveState('processCount', val));
    watch(homepageSource, (val) => saveState('homepageSource', val));
    watch(outputPath, (val) => saveState('outputPath', val));
    watch(isUsergrowthLoggedIn, (val) => saveState('isUsergrowthLoggedIn', val));

    // 动态管理 readinessItems
    const readinessItems = ref([...REPLICATION_READINESS]);

    // 加载千仓数据（使用公共方法，带缓存）
    const loadQiancangData = async () => {
      const response = await fetchQiancangDataWithCache();

      if (response.success) {
        // 只更新第一个数据源（千仓数据平台），不覆盖整个数组
        const items = [...readinessItems.value];
        items[0] = response.result;
        readinessItems.value = items;

        console.log('[ReplicationSettings] 千仓数据加载成功，使用缓存:', response.useCache);
      } else {
        console.error('[ReplicationSettings] 千仓数据加载失败:', response.error);
      }
    };

    // 加载最新爆款复刻任务数据
    const loadLatestTaskData = async () => {
      try {
        console.log('[ReplicationSettings] 开始加载最新任务数据...');

        // 读取 JSON 文件
        const dataPath = 'appdata://plugins-demo/smart-short-drama-data.json';
        const result = await invokeIpc('read-json-file', dataPath);

        if (!result.success || !result.data) {
          console.warn('[ReplicationSettings] 读取任务数据失败');
          return;
        }

        const tasks = result.data.tasks || [];

        // 过滤爆款复刻任务，按 id 降序排序，取最新的一个
        const replicationTasks = tasks.filter((t) => t.module === '爆款复刻').sort((a, b) => parseInt(b.id) - parseInt(a.id));

        if (replicationTasks.length === 0) {
          console.log('[ReplicationSettings] 没有找到爆款复刻任务，显示未就绪');
          // 显示未就绪状态
          updateReadinessWithNoTask();
          return;
        }

        const latestTask = replicationTasks[0];
        console.log('[ReplicationSettings] 找到最新任务:', latestTask.id, '状态:', latestTask.status);

        // 根据任务状态更新就绪面板
        updateReadinessPanel(latestTask);
      } catch (error) {
        console.error('[ReplicationSettings] 加载任务数据失败:', error);
      }
    };

    // 根据任务状态更新就绪面板
    const updateReadinessPanel = (task) => {
      console.log('[ReplicationSettings] 开始更新就绪面板，任务数据:', task);

      const items = [...readinessItems.value];

      // 状态映射
      const statusMap = {
        待执行: 'not_ready',
        执行中: 'partial',
        已完成: 'ready',
        失败: 'not_ready'
      };

      const panelStatus = statusMap[task.status] || 'not_ready';

      // 提取时间（优先使用 completedAt，否则使用 createdAt）
      const timeStr = task.completedAt || task.createdAt || '';
      const readyTime = timeStr.split(' ')[1] || '00:00:00'; // 提取时间部分

      console.log('[ReplicationSettings] ByteGrowth 数据:', task.bytegrowth);
      console.log('[ReplicationSettings] UserGrowth 数据:', task.usergrowth);

      // 更新"跑量片段"（index 1）
      const byteGrowthReadyList = (task.bytegrowth?.succDramas || []).map((name) => {
        const count = task.bytegrowth?.fragmentCounts?.[name];
        console.log(`[ReplicationSettings] ByteGrowth - ${name}: 片段数 = ${count}`);
        return count ? `${name} (${count}个片段)` : name;
      });

      // 从 bytegrowth.outputPaths 中提取第一个路径，然后提取父目录
      let byteGrowthFolderPath = task.bytegrowth?.outputPaths ? task.bytegrowth.outputPaths.split(';')[0].trim() : '';
      if (byteGrowthFolderPath) {
        // 提取父目录（去掉具体剧目文件夹）
        const pathParts = byteGrowthFolderPath.replace(/\\/g, '/').split('/');
        pathParts.pop(); // 移除最后一部分（剧目文件夹）
        byteGrowthFolderPath = pathParts.join('\\');
      }
      console.log('[ReplicationSettings] ByteGrowth 父文件夹路径:', byteGrowthFolderPath);

      items[1] = {
        id: 'runs',
        name: '跑量片段',
        status: panelStatus,
        readyTime: readyTime,
        folderPath: byteGrowthFolderPath, // 使用父目录路径
        details: {
          readyList: byteGrowthReadyList,
          missingList: task.bytegrowth?.failedDramas || []
        }
      };

      // 更新"短剧原片"（index 2）
      const userGrowthReadyList = (task.usergrowth?.succDramas || []).map((name) => {
        const count = task.usergrowth?.originalCounts?.[name];
        console.log(`[ReplicationSettings] UserGrowth - ${name}: 集数 = ${count}`);
        return count ? `${name} (${count}集)` : name;
      });

      // 从 usergrowth.outputPaths 中提取第一个路径，然后提取父目录
      let userGrowthFolderPath = task.usergrowth?.outputPaths ? task.usergrowth.outputPaths.split(';')[0].trim() : '';
      if (userGrowthFolderPath) {
        // 提取父目录（去掉具体剧目文件夹）
        const pathParts = userGrowthFolderPath.replace(/\\/g, '/').split('/');
        pathParts.pop(); // 移除最后一部分（剧目文件夹）
        userGrowthFolderPath = pathParts.join('\\');
      }
      console.log('[ReplicationSettings] UserGrowth 父文件夹路径:', userGrowthFolderPath);

      items[2] = {
        id: 'dramaOriginal',
        name: '短剧原片',
        status: panelStatus,
        readyTime: readyTime,
        folderPath: userGrowthFolderPath, // 使用 usergrowth.outputPaths 的第一个路径
        details: {
          readyList: userGrowthReadyList,
          missingList: task.usergrowth?.failedDramas || []
        }
      };

      readinessItems.value = items;
      console.log('[ReplicationSettings] 就绪面板已更新，最终数据:', items[1], items[2]);
    };

    // 没有任务时的状态
    const updateReadinessWithNoTask = () => {
      const items = [...readinessItems.value];

      items[1] = {
        id: 'runs',
        name: '跑量片段',
        status: 'not_ready',
        readyTime: '--:--:--',
        folderPath: '',
        details: { readyList: [], missingList: [] }
      };

      items[2] = {
        id: 'dramaOriginal',
        name: '短剧原片',
        status: 'not_ready',
        readyTime: '--:--:--',
        folderPath: '',
        details: { readyList: [], missingList: [] }
      };

      readinessItems.value = items;
    };

    // 页面加载时触发
    onMounted(async () => {
      // 先加载任务数据（更新 index 1 和 2）
      await loadLatestTaskData();
      // 再加载千仓数据（更新 index 0）
      await loadQiancangData();
    });

    // 格式化日期时间
    const formatDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // 立即执行任务
    const handleRunNow = async () => {
      console.log('[ReplicationSettings] 立即执行任务');

      // 前端判断登录状态
      if (!isUsergrowthLoggedIn.value) {
        showToast({ message: '请先登录墨攻平台', type: 'warning', duration: 3000 });
        return;
      }

      try {
        // 显示提示
        showToast({ message: '正在提交任务...', type: 'info', duration: 2000 });

        // 调用后端接口，提交任务到队列
        const res = await triggerEvent('replication-auto-start', {
          args: [
            outputPath.value, // outputPath
            processCount.value, // processCount
            {}, // exportConfig
            30, // dedupeExpireDays
            false // isScheduledTask
          ]
        });

        const biz = unwrapIpcResponse(res);

        if (biz && biz.success) {
          console.log('[ReplicationSettings] 任务已提交:', biz);
          showToast({
            message: `任务已提交！任务ID: ${biz.taskId}，队列长度: ${biz.queueLength || 0}`,
            type: 'success',
            duration: 3000
          });

          // 切换到任务列表页面查看
          emit('show-tasks');
        } else {
          showToast({ message: '任务提交失败: ' + (biz.message || '未知错误'), type: 'error', duration: 3000 });
        }
      } catch (error) {
        console.error('[ReplicationSettings] 提交任务失败:', error);
        showToast({ message: '任务提交失败: ' + error.message, type: 'error', duration: 3000 });
      }
    };

    // 处理定时任务开关变化
    const handleScheduleToggle = async (enabled) => {
      try {
        if (enabled) {
          // 开启定时任务前，先校验登录状态
          if (!isUsergrowthLoggedIn.value) {
            showToast({ message: '请先登录墨攻平台', type: 'warning', duration: 3000 });
            autoSchedule.value = false; // 重置开关状态
            return;
          }

          // 校验输出路径
          if (!outputPath.value) {
            showToast({ message: '请先配置资源存储路径', type: 'warning', duration: 2000 });
            autoSchedule.value = false; // 重置开关状态
            return;
          }

          const cronExpression = '00 02 * * *'; // 每天凌晨2点
          const result = await invokeIpc('start-scheduled-task', {
            pluginName: '短剧智造',
            eventType: 'replication-auto-start',
            params: {
              args: [
                outputPath.value,
                processCount.value,
                {}, // exportConfig
                30, // dedupeExpireDays
                true // isScheduledTask
              ]
            },
            cronExpression,
            enabled: true
          });

          if (result.success) {
            // 解析cron表达式，展示小时和分钟
            let cronDesc = '';
            try {
              const [min, hour] = cronExpression.split(' ');
              cronDesc = `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
            } catch (e) {
              cronDesc = cronExpression;
            }
            showToast({ message: `定时任务已启动（计划执行时间: ${cronDesc}）`, type: 'success', duration: 3000 });
          }
        } else {
          await invokeIpc('stop-scheduled-task', '短剧智造:replication-auto-start');
          showToast({ message: '定时任务已停止', type: 'info', duration: 2000 });
        }
      } catch (e) {
        console.error('定时任务操作失败:', e);
        showToast({ message: '定时任务操作失败: ' + (e?.message || String(e)), type: 'danger', duration: 3000 });
        autoSchedule.value = !enabled;
      }
    };

    // 墨攻平台登录处理
    const handleUsergrowthLogin = async () => {
      try {
        // 如果已登录，直接提示已登录
        if (isUsergrowthLoggedIn.value) {
          showToast({ message: '墨攻平台已登录', type: 'success', duration: 2000 });
          return;
        }

        // 显示提示：正在打开浏览器
        showToast({ message: '正在打开浏览器，准备登录墨攻平台...', type: 'info', duration: 3000 });

        // 调用后端登录流程
        const res = await triggerEvent('usergrowth-login', {});
        const biz = unwrapIpcResponse(res);

        if (biz && biz.success) {
          isUsergrowthLoggedIn.value = true;
          showToast({ message: '墨攻平台登录成功：' + (biz.message || ''), type: 'success', duration: 3000 });
        } else {
          showToast({ message: biz?.message || '墨攻平台登录失败', type: 'danger', duration: 4000 });
        }
      } catch (e) {
        console.error('[ReplicationSettings] 墨攻平台登录异常:', e);
        showToast({ message: '墨攻平台登录异常：' + (e?.message || String(e)), type: 'danger', duration: 4000 });
      }
    };

    // 保存配置
    const handleSave = () => {
      showToast({ message: '配置已保存', type: 'success', duration: 2000 });
    };

    // 更改路径
    const handleChangePath = async () => {
      try {
        showToast({ message: '请选择下载文件夹', type: 'info', duration: 2000 });
        const result = await invokeIpc('select-folder');
        if (result) {
          outputPath.value = result;
          showToast({ message: '已选择文件夹: ' + result, type: 'success', duration: 2500 });
        } else {
          showToast({ message: '未选择文件夹', type: 'warning', duration: 2000 });
        }
      } catch (e) {
        console.error('[ReplicationSettings] 选择路径失败:', e);
        showToast({ message: '选择文件夹失败: ' + (e?.message || String(e)), type: 'error', duration: 3000 });
      }
    };

    return () =>
      h('div', { class: 'p-8 max-w-5xl mx-auto animate-fade-in' }, [
        h('div', { class: 'mb-8' }, [
          h('h2', { class: 'text-xl font-bold text-gray-800' }, '爆款复刻任务'),
          h('p', { class: 'text-sm text-gray-500 mt-1' }, '基于素材库中的复刻片段进行批量自动化复刻生产。')
        ]),
        h('div', { class: 'mb-8' }, [h(ReadinessPanel, { items: readinessItems.value })]),
        h('div', { class: 'bg-white rounded-lg shadow-sm border border-gray-200 p-8' }, [
          // 基础配置标题
          h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '基础配置')]),

      // 平台登录
      h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6' }, [
            // 查询平台
              h('div', { class: 'flex flex-col' }, [
              h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '查询平台'),
              h('div', { class: 'flex items-center gap-2' }, [
                h('input', {
                  type: 'text',
                  value: '墨攻平台',
                  disabled: true,
                  class: 'flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500'
                }),
                h(
                  'button',
                  {
                    onClick: handleUsergrowthLogin,
                    class: [
                      'px-3 py-2 md:px-4 md:py-2 border rounded text-sm font-medium transition-colors shadow-sm flex items-center gap-1 md:gap-2 whitespace-nowrap',
                      isUsergrowthLoggedIn.value ? 'bg-success text-white border-success' : 'bg-white border-gray-300 hover:border-primary hover:text-primary text-gray-700'
                    ]
                  },
                  [h('span', '→'), h('span', '登录')]
                )
              ])
            ])
          ]),
          // 首页合成来源
          h('div', { class: 'mb-6' }, [
            h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '首页合成来源'),
            h(
              'select',
              {
                value: homepageSource.value,
                onChange: (e) => (homepageSource.value = e.target.value),
                class: 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary'
              },
              [h('option', { value: '短剧原声 (系统默认)' }, '短剧原声 (系统默认)')]
            )
          ]),

          // 处理剧数量
          h('div', { class: 'mb-6' }, [
            h('label', { class: 'block text-sm font-medium text-gray-700 mb-2 flex items-center' }, [
              '处理剧数量 (部)',
              h('span', { class: 'ml-2 text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20' }, '重要配置')
            ]),
            h('input', {
              type: 'number',
              min: 1,
              max: 100,
              value: processCount.value,
              onInput: (e) => (processCount.value = Number(e.target.value)),
              class: 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary'
            }),
            h('p', { class: 'mt-1 text-xs text-gray-400' }, '需确保爆款扒产、复刻、混剪三个环节的剧目处理数量配置一致。')
          ]),

          // 资源存储路径
          h('div', { class: 'mb-8 pb-8 border-b border-gray-200' }, [
            h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '资源存储路径'),
            h('div', { class: 'flex items-center gap-2' }, [
              h('input', {
                type: 'text',
                value: outputPath.value,
                onInput: (e) => (outputPath.value = e.target.value),
                class: 'flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary'
              }),
              h(
                'button',
                {
                  onClick: handleChangePath,
                  class: 'px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded text-sm font-medium transition-colors hover:border-primary hover:text-primary text-gray-700'
                },
                '更改'
              )
            ])
          ]),
          // 监听模式
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center justify-between' }, [
              h('div', [h('h3', { class: 'text-sm font-semibold text-gray-800' }, '监听模式'), h('p', { class: 'text-xs text-gray-500 mt-1' }, '监控复刻片段文件夹，有新文件时自动处理')]),
              h(
                'button',
                {
                  onClick: async () => {
                    // 切换状态，watch 会自动触发 handleScheduleToggle
                    autoSchedule.value = !autoSchedule.value;
                  },
                  class: ['relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none', autoSchedule.value ? 'bg-primary' : 'bg-gray-200']
                },
                [h('span', { class: ['inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200', autoSchedule.value ? 'translate-x-6' : 'translate-x-1'] })]
              )
            ])
          ]),

          // 底部按钮
          h('div', { class: 'flex justify-end gap-3' }, [
            h(
              'button',
              {
                class: 'px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 transition-colors',
                onClick: handleSave
              },
              '保存配置'
            ),
            h(
              'button',
              {
                onClick: handleRunNow,
                class: 'px-8 py-2.5 bg-primary hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors shadow-sm'
              },
              '立即执行任务'
            )
          ])
        ])
      ]);
  }
};
