import { IconComponents } from './icons.js';
import { TaskModule, ADX_READINESS, TaskStatus } from './constants.js';
import { ReadinessPanel } from './components.js';
import { triggerEvent, invokeIpc, unwrapIpcResponse } from './ipc.js';
import { showToast, showPrompt } from './Prompt.js';
import { fetchQiancangDataWithCache } from './dataSourceUtils.js';
import { TrackingEvent, TrackingPage, trackClick } from './tracking.js';

const { h } = Vue;

export const AdxScraper = {
  props: [],
  emits: ['show-tasks'], // 移除了 add-task 和 execute-task
  setup(props, { emit }) {
    // 从 localStorage 加载状态
    const loadState = (key, defaultValue) => {
      try {
        const saved = localStorage.getItem('adx-scraper-' + key);
        return saved !== null ? JSON.parse(saved) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    const saveState = (key, value) => {
      try {
        localStorage.setItem('adx-scraper-' + key, JSON.stringify(value));
      } catch (e) {
        console.error('保存状态失败:', e);
      }
    };

    const autoSchedule = Vue.ref(loadState('autoSchedule', false));
    const processCount = Vue.ref(loadState('processCount', 5));
    const outputPath = Vue.ref(loadState('outputPath', 'D:/ShortDrama'));
    const isLoggedIn = Vue.ref(loadState('isLoggedIn', false));

    // 监听状态变化并保存
    Vue.watch(autoSchedule, (val) => saveState('autoSchedule', val));
    Vue.watch(processCount, (val) => saveState('processCount', val));
    Vue.watch(outputPath, (val) => saveState('outputPath', val));
    Vue.watch(isLoggedIn, (val) => saveState('isLoggedIn', val));

    const defaultQiancang = {
      id: 'qiancang',
      name: '千沧数据平台',
      status: 'not_ready',
      readyTime: '--:--',
      details: {
        groups: [
          {
            title: '平台接口与数据状态',
            items: [
              { content: '数据API链接未知', status: 'not_ready' },
              { content: '昨日跑量数据未知', status: 'not_ready' }
            ]
          },
          { title: '待扒产剧目清单 (千仓提取)', items: [] }
        ]
      }
    };
    const readinessItems = Vue.ref(ADX_READINESS && ADX_READINESS.length > 0 ? ADX_READINESS : [defaultQiancang]);

    const expandedId = Vue.ref(null);
    const toggleExpand = (id) => {
      expandedId.value = expandedId.value === id ? null : id;
    };
    const isProcessing = Vue.ref(false);

    // 加载千仓数据（使用公共方法，带缓存）
    const loadQiancangData = async () => {
      // 设置 loading 状态
      try {
        const riLoading = JSON.parse(JSON.stringify(readinessItems.value[0] || defaultQiancang));
        riLoading.status = 'loading';
        riLoading.readyTime = '加载中...';
        readinessItems.value = [riLoading];
      } catch (e) {
        // ignore
      }

      // 调用公共方法获取千仓数据
      const response = await fetchQiancangDataWithCache();

      if (response.success) {
        // 成功：更新 readinessItems
        readinessItems.value = [response.result];

        if (response.useCache) {
          console.log('[AdxScraper] 使用缓存的千仓数据');
        } else {
          console.log('[AdxScraper] 使用新组装的千仓数据');
        }
      } else {
        // 失败：显示错误状态
        const riFailed = JSON.parse(JSON.stringify(defaultQiancang));
        riFailed.status = 'not_ready';
        riFailed.readyTime = '--:--';
        riFailed.details.groups[0].items = [
            { content: '数据API链接异常', status: 'not_ready' },
            { content: '昨日跑量数据不可用', status: 'not_ready' }
          ];
        readinessItems.value = [riFailed];
        console.error('[AdxScraper] 加载千仓数据失败:', response.error);
      }
    };

    // 页面加载时触发
    loadQiancangData();

    const handleRunNow = async () => {
      trackClick(TrackingEvent.ADX_START, TrackingPage.ADX_SCRAPER);

      try {
        // assemble dramaData from readinessItems (group 1 items) if available
        const platform = readinessItems.value && readinessItems.value[0];
        let dramas = [];
        if (platform && platform.details && Array.isArray(platform.details.groups) && platform.details.groups[1]) {
          const items = platform.details.groups[1].items || [];
          dramas = items.map((it) => ({ dramaName: it.content, count: processCount.value }));
        }

        if (!dramas || dramas.length === 0) {
          showToast({ message: '未找到待处理的剧目，请先从热榜或 Excel 中获取剧目列表', type: 'warning', duration: 3000 });
          return;
        }
        // Require ADX login before processing
        if (!isLoggedIn.value) {
          showToast({ message: '请先登录 ADX 平台', type: 'warning', duration: 3000 });
          return;
        }

        const confirm = await showPrompt({
          title: '确认开始处理',
          message: `将处理热榜前 5 部短剧，每部下载 ${processCount.value} 集\n保存路径：${outputPath.value}\n\n确定继续？`,
          confirmText: '开始',
          cancelText: '取消',
          showCancel: true
        });

        if (!confirm || confirm.action !== 'confirm') {
          showToast({ message: '已取消处理', type: 'info', duration: 2000 });
          return;
        }

        isProcessing.value = true;

        // 显示提示
        showToast({ message: '正在提交任务...', type: 'info', duration: 2000 });

        // 调用后端接口，提交任务到队列
        const res = await triggerEvent('adx-auto-start', {
          args: [
            outputPath.value, // outputPath
            processCount.value, // 每部短剧下载集数 (videoCount)
            {}, // exportConfig
            30, // dedupeExpireDays
            false // isScheduledTask
          ]
        });

        const biz = unwrapIpcResponse(res);

        if (biz && biz.success) {
          console.log('[AdxScraper] 任务已提交:', biz);
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

        isProcessing.value = false;
      } catch (e) {
        console.error('[AdxScraper] 提交任务失败:', e);
        showToast({ message: '任务提交失败: ' + e.message, type: 'error', duration: 3000 });
        isProcessing.value = false;
      }
    };

    const handleBrowsePath = async () => {
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
        console.error('select-folder error:', e);
        showToast({ message: '选择文件夹失败: ' + (e?.message || String(e)), type: 'danger', duration: 4000 });
      }
    };

    // 处理定时任务开关变化
    const handleScheduleToggle = async (enabled) => {
      try {
        if (enabled) {
          // 开启定时任务前，先校验登录状态
          if (!isLoggedIn.value) {
            showToast({ message: '请先登录 ADX 平台', type: 'warning', duration: 3000 });
            autoSchedule.value = false; // 重置开关状态
            return;
          }

          // 校验输出路径
          if (!outputPath.value) {
            showToast({ message: '请先选择下载路径', type: 'warning', duration: 2000 });
            autoSchedule.value = false; // 重置开关状态
            return;
          }

          const cronExpression = '01 00 * * *'; // 每天凌晨0点
          const result = await invokeIpc('start-scheduled-task', {
            pluginName: '短剧智造',
            eventType: 'adx-auto-start',
            params: {
              args: [
                outputPath.value,
                processCount.value, // 每部短剧下载集数 (videoCount)
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
          await invokeIpc('stop-scheduled-task', '短剧智造:adx-auto-start');
          showToast({ message: '定时任务已停止', type: 'info', duration: 2000 });
        }
      } catch (e) {
        console.error('定时任务操作失败:', e);
        showToast({ message: '定时任务操作失败: ' + (e?.message || String(e)), type: 'danger', duration: 3000 });
        autoSchedule.value = !enabled;
      }
    };

    return () =>
      h('div', { class: 'p-8 max-w-5xl mx-auto animate-fade-in' }, [
        h('div', { class: 'mb-8' }, [
          h('h2', { class: 'text-xl font-bold text-gray-800' }, '爆款扒产任务'),
          h('p', { class: 'text-sm text-gray-500 mt-1' }, '配置全网短剧数据抓取规则，支持定时自动化执行。')
        ]),
        h('div', { class: 'mb-8' }, [h(ReadinessPanel, { items: readinessItems.value })]),
        h('div', { class: 'bg-white rounded-lg shadow-sm border border-gray-200 p-8' }, [
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '基础配置')]),
            h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' }, [
              h('div', [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '数据源平台'),
                h('div', { class: 'flex gap-2' }, [
                  h('div', { class: 'flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 cursor-not-allowed flex items-center' }, 'ADX平台'),
                  h(
                    'button',
                    {
                      onClick: async () => {
                        try {
                          // 如果已登录，直接提示已登录
                          if (isLoggedIn.value) {
                            showToast({ message: '已登录', type: 'success', duration: 2000 });
                            return;
                          }

                          // 显示提示：正在打开浏览器
                          showToast({ message: '正在打开浏览器，准备登录...', type: 'info', duration: 3000 });
                          // 调用宿主触发后端登录流程（ADX 插件中的 adx-login event）
                          const res = await triggerEvent('adx-login', {});
                          const biz = unwrapIpcResponse(res); // biz 是插件业务对象
                          if (biz && biz.success) {
                            isLoggedIn.value = true;
                            showToast({ message: '登录成功：' + (biz.message || ''), type: 'success', duration: 3000 });
                          } else {
                            // 当业务层返回 success: false 时，直接把后端返回的 message 展示给用户
                            showToast({ message: biz?.message || '登录失败', type: 'danger', duration: 4000 });
                          }
                        } catch (e) {
                          console.error('adx login error:', e);
                          showToast({ message: '登录异常：' + (e?.message || String(e)), type: 'danger', duration: 4000 });
                        }
                      },
                      class: [
                        'px-4 py-2 border rounded text-sm font-medium transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap',
                        isLoggedIn.value ? 'bg-success text-white border-success' : 'bg-white border border-gray-300 hover:border-primary hover:text-primary text-gray-700'
                      ]
                    },
                    [h('span', isLoggedIn.value ? '已登录' : '登录')]
                  )
                ])
              ]),
              h('div', { class: 'relative' }, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '每部短剧下载集数'),
                h('div', { class: 'relative rounded-md shadow-sm' }, [
                  h('input', {
                    type: 'number',
                    min: 1,
                    max: 20,
                    value: processCount.value,
                    onInput: (e) => (processCount.value = Number(e.target.value)),
                    class:
                      'w-full border border-gray-300 bg-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-gray-900 transition-colors'
                  }),
                  h('div', { class: 'absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none' }, [h(IconComponents.AlertCircle, { class: 'h-4 w-4 text-gray-400' })])
                ]),
                h('p', { class: 'mt-1 text-xs text-gray-400' }, '需确保爆款扒产、复刻、混剪三个环节的剧目集数配置一致。')
              ]),
              h('div', { class: 'md:col-span-2' }, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '资源存储路径'),
                h('div', { class: 'flex gap-2' }, [
                  h('input', { type: 'text', value: outputPath.value, readOnly: true, class: 'flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 focus:outline-none' }),
                  h('button', { onClick: handleBrowsePath, class: 'px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors' }, '更改')
                ])
              ])
            ])
          ]),
          h('div', { class: 'border-t border-gray-100 pt-8' }, [
            h('div', { class: 'flex items-center justify-between' }, [
              h('div', [h('h3', { class: 'text-sm font-semibold text-gray-800' }, '定时自动执行'), h('p', { class: 'text-xs text-gray-500 mt-1' }, '自动根据千沧数据平台自动抓取平台中爆款视频')]),
              h(
                'button',
                {
                  onClick: () => {
                    const newValue = !autoSchedule.value;
                    autoSchedule.value = newValue;
                    handleScheduleToggle(newValue);
                  },
                  class: ['relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none', autoSchedule.value ? 'bg-primary' : 'bg-gray-200']
                },
                [h('span', { class: ['inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200', autoSchedule.value ? 'translate-x-6' : 'translate-x-1'] })]
              )
            ])
          ])
        ]),
        h('div', { class: 'mt-6 flex justify-end gap-3' }, [
          h(
            'button',
            {
              class: 'px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors',
              onClick: () => console.log('[AdxScraper] 设置已重置')
            },
            '重置'
          ),
          h(
            'button',
            {
              onClick: handleRunNow,
              class: 'px-8 py-2 bg-primary hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors shadow-sm'
            },
            '立即执行任务'
          )
        ])
      ]);
  }
};
