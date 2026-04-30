import { IconComponents } from './icons.js';
import { TaskModule } from './constants.js';
import { ReadinessPanel } from './components.js';
import { fetchQiancangDataWithCache } from './dataSourceUtils.js';
import { invokeIpc, triggerEvent, unwrapIpcResponse } from './ipc.js';
import { showToast } from './Prompt.js';
import { TrackingEvent, TrackingPage, trackClick } from './tracking.js';

const { h, ref, onMounted, watch } = Vue;

export const RemixTool = {
  props: ['assets', 'onShowTasks'],
  emits: ['add-task', 'show-tasks'],
  setup(props, { emit }) {
    const loadState = (key, defaultValue) => {
      try {
        const saved = localStorage.getItem('remix-' + key);
        return saved !== null ? JSON.parse(saved) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    const saveState = (key, value) => {
      try {
        localStorage.setItem('remix-' + key, JSON.stringify(value));
      } catch (e) {
        console.error('保存状态失败:', e);
      }
    };

    const selectedScriptIds = Vue.ref(new Set());
    const autoSchedule = Vue.ref(loadState('autoSchedule', false));
    const localScript = Vue.ref(loadState('localScript', null));
    const isLibraryOpen = Vue.ref(false);
    const outputPath = Vue.ref(loadState('outputPath', 'D:/ShortDrama'));
    const processCount = Vue.ref(loadState('processCount', 5));
    const overlayModes = Vue.ref(loadState('overlayModes', { hook: true, post: false }));
    const hookSeconds = Vue.ref(loadState('hookSeconds', 3));

    Vue.watch(autoSchedule, (val) => saveState('autoSchedule', val));
    Vue.watch(outputPath, (val) => saveState('outputPath', val));
    Vue.watch(processCount, (val) => saveState('processCount', val));
    Vue.watch(overlayModes, (val) => saveState('overlayModes', val), { deep: true });
    Vue.watch(hookSeconds, (val) => saveState('hookSeconds', val));
    Vue.watch(localScript, (val) => saveState('localScript', val));

    const scripts = () => (props.assets || []).filter((a) => a.category === 'scripts');

    // 动态管理 readinessItems
    const readinessItems = ref([]);

    // 加载千仓数据（使用公共方法，带缓存）
    const loadQiancangData = async () => {
      const response = await fetchQiancangDataWithCache();

      if (response.success) {
        console.log('[RemixTool] 千仓数据加载成功，使用缓存:', response.useCache);
        return response.result;
      } else {
        console.error('[RemixTool] 千仓数据加载失败:', response.error);
        return null;
      }
    };

    // 加载复刻片段数据（从最新的爆款复刻任务）
    const loadReplicationClipsData = async () => {
      try {
        console.log('[RemixTool] 开始加载复刻片段数据...');
        const dataPath = 'appdata://plugins-demo/smart-short-drama-data.json';
        const result = await invokeIpc('read-json-file', dataPath);

        if (!result || !result.success || !result.data || !result.data.tasks || result.data.tasks.length === 0) {
          console.log('[RemixTool] 没有找到任何任务');
          return {
            id: 'repClips',
            name: '复刻片段',
            status: 'not_ready',
            readyTime: '-',
            folderPath: '',
            details: { readyList: [], missingList: ['未找到爆款复刻任务'] }
          };
        }

        // 筛选 module 为 "爆款复刻" 的任务，按 id 降序排列
        const replicationTasks = result.data.tasks.filter((t) => t.module === '爆款复刻').sort((a, b) => parseInt(b.id) - parseInt(a.id));

        if (replicationTasks.length === 0) {
          console.log('[RemixTool] 没有找到爆款复刻任务');
          return {
            id: 'repClips',
            name: '复刻片段',
            status: 'not_ready',
            readyTime: '-',
            folderPath: '',
            details: { readyList: [], missingList: ['未找到爆款复刻任务'] }
          };
        }

        const latestTask = replicationTasks[0];
        console.log('[RemixTool] 最新的爆款复刻任务:', latestTask);

        // 检查任务状态和 outputPath
        const isCompleted = latestTask.status === '已完成';
        const hasOutputPath = latestTask.outputPath && latestTask.outputPath.trim() !== '';

        if (!isCompleted) {
          return {
            id: 'repClips',
            name: '复刻片段',
            status: 'partial',
            readyTime: latestTask.completedAt?.split(' ')[1] || '-',
            folderPath: latestTask.outputPath || '',
            details: { readyList: [], missingList: [`任务状态: ${latestTask.status}`] }
          };
        }

        if (!hasOutputPath) {
          return {
            id: 'repClips',
            name: '复刻片段',
            status: 'not_ready',
            readyTime: latestTask.completedAt?.split(' ')[1] || '-',
            folderPath: '',
            details: { readyList: [], missingList: ['输出路径为空'] }
          };
        }

        // 构建 readyList（从 bytegrowth.succDramas）
        const readyList = (latestTask.bytegrowth?.succDramas || []).map((name) => {
          const count = latestTask.bytegrowth?.fragmentCounts?.[name];
          return count ? `${name} (${count}个片段)` : name;
        });

        return {
          id: 'repClips',
          name: '复刻片段',
          status: 'ready',
          readyTime: latestTask.completedAt?.split(' ')[1] || '-',
          folderPath: latestTask.outputPath,
          details: {
            readyList: readyList,
            missingList: latestTask.bytegrowth?.failedDramas || []
          }
        };
      } catch (error) {
        console.error('[RemixTool] 加载复刻片段数据失败:', error);
        return {
          id: 'repClips',
          name: '复刻片段',
          status: 'not_ready',
          readyTime: '-',
          folderPath: '',
          details: { readyList: [], missingList: ['加载失败: ' + error.message] }
        };
      }
    };

    // 更新录屏话术状态
    const updateScriptsStatus = () => {
      const hasScript = localScript.value && localScript.value.trim() !== '';

      return {
        id: 'scripts',
        name: '录屏话术',
        status: hasScript ? 'ready' : 'not_ready',
        readyTime: hasScript ? new Date().toTimeString().split(' ')[0] : '-',
        folderPath: localScript.value || '',
        details: {
          readyList: hasScript ? ['本地话术文件夹'] : [],
          missingList: hasScript ? [] : ['未选择录屏话术']
        }
      };
    };

    // 加载所有数据源
    const loadAllDataSources = async () => {
      console.log('[RemixTool] 开始加载所有数据源...');

      const qiancangData = await loadQiancangData();
      const replicationClipsData = await loadReplicationClipsData();
      const scriptsData = updateScriptsStatus();

      const items = [];
      if (qiancangData) {
        items.push(qiancangData);
      }
      items.push(replicationClipsData);
      items.push(scriptsData);

      readinessItems.value = items;
      console.log('[RemixTool] 所有数据源加载完成:', items);
    };

    // 监听 localScript 变化，更新录屏话术状态
    watch(localScript, () => {
      const items = [...readinessItems.value];
      const scriptsIndex = items.findIndex((item) => item.id === 'scripts');

      if (scriptsIndex !== -1) {
        items[scriptsIndex] = updateScriptsStatus();
        readinessItems.value = items;
      }
    });

    // 页面加载时触发
    onMounted(() => {
      loadAllDataSources();
    });

    const handleBrowsePath = () => {
      const p = prompt('请输入混剪成品存储路径', outputPath.value);
      if (p) outputPath.value = p;
    };

    const handleLocalUpload = async () => {
      try {
        const result = await invokeIpc('select-folder');
        console.log('[RemixTool] select-folder 返回结果:', result);
        if (result && result.trim() !== '') {
          localScript.value = result;
          console.log('[RemixTool] 选择本地话术文件夹:', localScript.value);
        } else {
          console.log('[RemixTool] 用户取消选择或返回空路径');
        }
      } catch (error) {
        console.error('[RemixTool] 选择文件夹失败:', error);
      }
    };

    const handleStart = async () => {
      trackClick(TrackingEvent.REMIX_START, TrackingPage.REMIX);

      try {
        console.log('[RemixTool] 启动批量混剪任务');

        // 1. 验证数据源是否就绪
        const replicationClips = readinessItems.value.find((item) => item.id === 'repClips');
        const scripts = readinessItems.value.find((item) => item.id === 'scripts');

        if (!replicationClips || replicationClips.status !== 'ready') {
          console.error('[RemixTool] 复刻片段数据源未就绪');
          showToast({ message: '复刻片段数据源未就绪，请先完成爆款复刻任务', type: 'warning', duration: 3000 });
          return;
        }

        if (!scripts || scripts.status !== 'ready') {
          console.error('[RemixTool] 录屏话术未选择');
          showToast({ message: '请先选择录屏话术文件夹', type: 'warning', duration: 3000 });
          return;
        }

        // 2. 准备参数（确保所有参数都是可序列化的）
        const replicationClipsPath = replicationClips.folderPath;
        const scriptsPath = localScript.value;
        const outputPathValue = outputPath.value;
        const processCountValue = processCount.value;
        // 将 overlayModes 转换为普通对象
        const overlayModesValue = JSON.parse(JSON.stringify(overlayModes.value));
        const hookSecondsValue = hookSeconds.value;
        const isScheduledTask = false;

        console.log('[RemixTool] 调用后端参数:', {
          replicationClipsPath,
          scriptsPath,
          outputPath: outputPathValue,
          processCount: processCountValue,
          overlayModes: overlayModesValue,
          hookSeconds: hookSecondsValue,
          isScheduledTask
        });

        // 3. 调用后端 IPC
        const result = await triggerEvent('mix-edit-auto-start', {
          args: [
            replicationClipsPath,
            scriptsPath,
            outputPathValue,
            processCountValue,
            overlayModesValue,
            hookSecondsValue,
            isScheduledTask
          ]
        });

        console.log('[RemixTool] 后端返回结果:', result);

        const biz = unwrapIpcResponse(result);

        if (biz && biz.success) {
          console.log('[RemixTool] 任务提交成功:', biz.taskId);
          console.log('[RemixTool] 消息:', biz.message);
          showToast({ message: `任务已提交！任务ID: ${biz.taskId}，队列长度: ${biz.queueLength || 0}`, type: 'success', duration: 3000 });

          // 切换到任务列表页面查看
          if (props.onShowTasks) {
            props.onShowTasks();
          }
        } else {
          console.error('[RemixTool] 任务提交失败:', biz?.message || '未知错误');
          console.error('[RemixTool] 详细信息:', biz);
          showToast({ message: '任务提交失败: ' + (biz?.message || '未知错误'), type: 'error', duration: 3000 });
        }
      } catch (error) {
        console.error('[RemixTool] handleStart 失败:', error);
        console.error('[RemixTool] 错误堆栈:', error.stack);
        showToast({ message: '任务提交失败: ' + error.message, type: 'error', duration: 3000 });
      }
    };
    const toggleSelection = (id) => {
      const s = new Set(selectedScriptIds.value);
      if (s.has(id)) s.delete(id);
      else {
        s.add(id);
        localScript.value = null;
      }
      selectedScriptIds.value = s;
    };

    return () =>
      h('div', { class: 'p-8 max-w-5xl mx-auto bg-background animate-fade-in pb-24' }, [
        h('div', { class: 'mb-8' }, [h('h2', { class: 'text-xl font-bold text-gray-800' }, '爆款混剪任务'), h('p', { class: 'text-sm text-gray-500 mt-1' }, '选择录屏话术与素材进行自动混剪。')]),
        h('div', { class: 'mb-8' }, [h(ReadinessPanel, { items: readinessItems.value })]),
        h('div', { class: 'bg-white rounded-lg border border-gray-200 shadow-sm p-8' }, [
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '任务配置')]),
            h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' }, [
              h('div', { class: 'relative' }, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2 flex items-center' }, [
                  '处理剧目数量 (部)',
                  h('span', { class: 'ml-2 text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20' }, '重要配置')
                ]),
                h('div', { class: 'relative rounded-md shadow-sm' }, [
                  h('input', {
                    type: 'number',
                    min: 1,
                    max: 100,
                    value: processCount.value,
                    onInput: (e) => (processCount.value = Number(e.target.value)),
                    class:
                      'w-full border-2 border-warning/30 bg-orange-50/30 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-warning focus:border-warning text-gray-900 font-medium transition-colors'
                  }),
                  h('div', { class: 'absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none' }, [h(IconComponents.AlertCircle, { class: 'h-4 w-4 text-warning' })])
                ]),
                h('p', { class: 'mt-1 text-xs text-gray-400' }, '需确保扒产/复刻/混剪配置一致。')
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '成品存储路径'),
                h('div', { class: 'flex gap-2' }, [
                  h('input', { type: 'text', value: outputPath.value, readonly: true, class: 'flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 focus:outline-none' }),
                  h('button', { onClick: handleBrowsePath, class: 'px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50' }, '更改')
                ])
              ])
            ])
          ]),
          // 素材选择部分
          h('div', { class: 'mb-8 pb-8 border-b border-gray-200' }, [
            h('div', { class: 'flex items-center mb-4' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '素材选择')]),
            h('div', {}, [
              h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '录屏话术本地选择'),
              h('div', { class: 'flex gap-2 items-center' }, [
                h('input', {
                  type: 'text',
                  value: localScript.value || '',
                  placeholder: '未选择文件夹',
                  readonly: true,
                  class: 'flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 focus:outline-none'
                }),
                h(
                  'button',
                  {
                    onClick: handleLocalUpload,
                    class: 'inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors'
                  },
                  [h(IconComponents.Upload, { class: 'w-4 h-4' }), '本地上传']
                )
              ]),
              h('p', { class: 'mt-2 text-xs text-gray-400' }, '选择包含录屏话术文件的文件夹')
            ])
          ]),
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '叠加策略')]),
            h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' }, [
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2 flex items-center' }, [
                  '叠加模式 (可多选)',
                  h('span', { class: 'ml-2 text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20' }, '重要配置')
                ]),
                h('div', { class: 'flex flex-col gap-3 p-3 border-2 border-warning/20 bg-orange-50/30 rounded-md' }, [
                  h('label', { class: 'flex items-start cursor-pointer p-2 rounded hover:bg-white/50 transition-colors' }, [
                    h('input', {
                      type: 'checkbox',
                      checked: overlayModes.value.hook,
                      onChange: () => (overlayModes.value.hook = !overlayModes.value.hook),
                      class: 'mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary flex-shrink-0'
                    }),
                    h('span', { class: 'ml-2 text-sm text-gray-800 leading-snug' }, [
                      h('span', { class: 'font-semibold' }, '留钩子叠加'),
                      h('br'),
                      h('span', { class: 'text-gray-500 text-xs' }, '原片结尾独立播放 X 秒，不被话术覆盖 (保留剧情悬念)')
                    ])
                  ]),
                  h('label', { class: 'flex items-start cursor-pointer p-2 rounded hover:bg-white/50 transition-colors' }, [
                    h('input', {
                      type: 'checkbox',
                      checked: overlayModes.value.post,
                      onChange: () => (overlayModes.value.post = !overlayModes.value.post),
                      class: 'mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary flex-shrink-0'
                    }),
                    h('span', { class: 'ml-2 text-sm text-gray-800 leading-snug' }, [
                      h('span', { class: 'font-semibold' }, '纯后置叠加'),
                      h('br'),
                      h('span', { class: 'text-gray-500 text-xs' }, '话术视频与原片结尾对齐，完全覆盖原片结尾')
                    ])
                  ])
                ])
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '钩子保留时长 (秒)'),
                h('input', {
                  type: 'number',
                  min: 1,
                  max: 10,
                  value: hookSeconds.value,
                  onInput: (e) => (hookSeconds.value = Number(e.target.value)),
                  disabled: !overlayModes.value.hook,
                  class: [
                    'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors',
                    !overlayModes.value.hook ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                  ]
                })
              ])
            ])
          ]),
          h('div', { class: 'mt-6 flex justify-end gap-3' }, [
            h('button', { onClick: handleStart, class: ['px-8 py-2 text-white text-sm font-medium rounded transition-all shadow-sm', 'bg-primary hover:bg-blue-600'] }, '启动批量任务')
          ])
        ])
      ]);
  }
};
