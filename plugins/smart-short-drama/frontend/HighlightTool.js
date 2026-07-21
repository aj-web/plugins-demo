import { IconComponents } from './icons.js';
import { TaskModule, STATUS_TEXTS } from './constants.js';
import { ReadinessPanel } from './components.js';
import { invokeIpc, triggerEvent, unwrapIpcResponse } from './ipc.js';
import { showToast } from './Prompt.js';
import { TrackingEvent, TrackingPage, trackClick } from './tracking.js';
import { normalizeOutputPaths, parentFolderOfFirstPath } from './taskPathUtils.js';

const { h } = Vue;

export const HighlightTool = {
  props: ['assets', 'onShowTasks'],
  emits: ['add-task'],
  setup(props, { emit }) {
    const loadState = (key, defaultValue) => {
      try {
        const saved = localStorage.getItem('highlight-' + key);
        return saved !== null ? JSON.parse(saved) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    const saveState = (key, value) => {
      try {
        localStorage.setItem('highlight-' + key, JSON.stringify(value));
      } catch (e) {
        console.error('保存状态失败:', e);
      }
    };

    const fileName = Vue.ref(loadState('fileName', ''));
    const dramaListFilePath = Vue.ref(loadState('dramaListFilePath', ''));
    const localEndFrame = Vue.ref(loadState('localEndFrame', null));
    const imageOverlay = Vue.ref(loadState('imageOverlay', null));
    const outputPath = Vue.ref(loadState('outputPath', 'D:/ShortDrama'));
    const endRetentionSeconds = Vue.ref(loadState('endRetentionSeconds', 10));
    const stitchEpisodeCount = Vue.ref(loadState('stitchEpisodeCount', 3));
    
    // 添加响应式的 readinessItems
    const readinessItems = Vue.ref([]);

    Vue.watch(fileName, (val) => saveState('fileName', val));
    Vue.watch(dramaListFilePath, (val) => saveState('dramaListFilePath', val));
    Vue.watch(localEndFrame, (val) => saveState('localEndFrame', val));
    Vue.watch(imageOverlay, (val) => saveState('imageOverlay', val));
    Vue.watch(outputPath, (val) => saveState('outputPath', val));
    Vue.watch(endRetentionSeconds, (val) => saveState('endRetentionSeconds', val));
    Vue.watch(stitchEpisodeCount, (val) => saveState('stitchEpisodeCount', val));

    const getOriginalSourceFromTask = (task) => {
      if (task.module === '爆款复刻') {
        return task.materials?.originals?.mogong || null;
      }
      if (task.module === '高光混剪') {
        return task.usergrowth || null;
      }
      return null;
    };

    const getOriginalCounts = (task, source) => {
      if (task.module === '爆款复刻') {
        return source?.episodeCounts || {};
      }
      return source?.originalCounts || {};
    };

    // 加载短剧原片数据（从爆款复刻任务中读取）
    const loadDramaOriginalData = async () => {
      try {
        console.log('[HighlightTool] 开始加载短剧原片数据...');

        // 读取 JSON 文件获取所有任务
        const dataPath = 'appdata://plugins-demo/smart-short-drama-data.json';
        const result = await invokeIpc('read-json-file', dataPath);
        console.log('[HighlightTool] 获取到的任务数据:', result);

        if (!result || !result.success || !result.data || !result.data.tasks || result.data.tasks.length === 0) {
          console.warn('[HighlightTool] 未获取到任务列表');
          return {
            id: 'dramaOriginal',
            name: '短剧原片',
            status: 'not_ready',
            readyTime: '-',
            folderPath: '',
            details: { readyList: [], missingList: ['未找到任务数据'] }
          };
        }

        // 筛选出 module 为 "高光混剪" 或 "爆款复刻" 的任务，按创建时间倒序排列
        const highlightTasks = result.data.tasks
          .filter((task) => task.module === '高光混剪' || task.module === '爆款复刻')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('[HighlightTool] 筛选出的高光混剪任务:', highlightTasks);

        if (highlightTasks.length === 0) {
          return {
            id: 'dramaOriginal',
            name: '短剧原片',
            status: 'not_ready',
            readyTime: '-',
            folderPath: '',
            details: { readyList: [], missingList: ['未找到高光混剪或爆款复刻任务'] }
          };
        }

        // 辅助函数：从候选任务列表中，从最新往回找，找到第一个有可用原片数据的任务
        const findFirstUsableTask = (tasks) => {
          for (const task of tasks) {
            const source = getOriginalSourceFromTask(task);
            const paths = normalizeOutputPaths(source?.outputPaths);
            if (task.status === '已完成' && paths.length > 0) {
              return task;
            }
          }
          return null;
        };

        const latestTask = findFirstUsableTask(highlightTasks);
        console.log('[HighlightTool] 有可用原片数据的最新任务:', latestTask);

        if (!latestTask) {
          // 没有找到任何有可用数据的任务，尝试给出一个友好提示
          const firstTask = highlightTasks[0];
          let hintMsg = '最近的任务均未成功下载短剧原片';
          if (firstTask) {
            if (firstTask.status === '执行中') hintMsg = '最近任务正在执行中，请稍候...';
            else if (firstTask.status === '待执行') hintMsg = '最近任务正在排队等待执行';
            else if (firstTask.status === '已失败') hintMsg = '最近任务执行失败，请重试或检查原因';
            else hintMsg = '最近任务未包含可用的短剧原片数据';
          }
          return {
            id: 'dramaOriginal',
            name: '短剧原片',
            status: 'not_ready',
            readyTime: firstTask?.completedAt?.split(' ')[1] || '-',
            folderPath: '',
            details: { readyList: [], missingList: [hintMsg] }
          };
        }

        const originalSource = getOriginalSourceFromTask(latestTask);
        const originalFolderPaths = Array.from(new Set(normalizeOutputPaths(originalSource.outputPaths).map((p) => parentFolderOfFirstPath([p])).filter(Boolean))).map((p) => ({
          label: '短剧原片',
          path: p
        }));
        const folderPath = originalFolderPaths[0]?.path || '';
        console.log('[HighlightTool] 短剧原片父文件夹路径:', folderPath);

        // 构建 readyList
        const originalCounts = getOriginalCounts(latestTask, originalSource);
        const readyList = Object.keys(originalCounts).map((dramaName) => {
          const count = originalCounts[dramaName];
          return count ? `${dramaName} (${count}集)` : dramaName;
        });

        // 历史任务就绪 → 提取 params 回填表单
        if (latestTask.params) {
          const p = latestTask.params;
          if (p.imageOverlayFolderPath && !imageOverlay.value) imageOverlay.value = p.imageOverlayFolderPath;
          if (p.endFrameFolderPath && !localEndFrame.value) localEndFrame.value = p.endFrameFolderPath;
          if (p.outputPath && !outputPath.value) outputPath.value = p.outputPath.replace(/\//g, '\\');
          if ((p.endRetentionSeconds != null) && !endRetentionSeconds.value) endRetentionSeconds.value = p.endRetentionSeconds;
          if (p.stitchEpisodeCount != null && !stitchEpisodeCount.value) stitchEpisodeCount.value = p.stitchEpisodeCount;
          if (p.dramaListFilePath && !dramaListFilePath.value) {
            dramaListFilePath.value = p.dramaListFilePath;
            fileName.value = p.dramaListFilePath.split(/[/\\]/).pop();
          }
          console.log('[HighlightTool] 已从历史任务自动回填表单参数');
        }

        return {
          id: 'dramaOriginal',
          name: '短剧原片',
          status: 'ready',
          readyTime: latestTask.completedAt?.split(' ')[1] || '-',
          folderPath: folderPath,  // 使用父目录路径
          folderPaths: originalFolderPaths,
          details: {
            readyList: readyList,
            missingList: []
          },
          latestTask: latestTask  // 携带完整任务供外部使用
        };
      } catch (error) {
        console.error('[HighlightTool] 加载短剧原片数据失败:', error);
        return {
          id: 'dramaOriginal',
          name: '短剧原片',
          status: 'not_ready',
          readyTime: '-',
          folderPath: '',
          details: { readyList: [], missingList: ['加载失败: ' + error.message] }
        };
      }
    };

    // 加载所有数据源
    const loadAllDataSources = async () => {
      console.log('[HighlightTool] 开始加载所有数据源...');

      const dramaOriginalData = await loadDramaOriginalData();

      readinessItems.value = [dramaOriginalData];
      console.log('[HighlightTool] 所有数据源加载完成:', readinessItems.value);
    };

    // 页面加载时触发
    Vue.onMounted(() => {
      loadAllDataSources();
    });

    const handleFileUpload = async () => {
      try {
        const result = await invokeIpc('select-file');
        console.log('[HighlightTool] select-file 返回结果:', result);
        if (result && result.trim() !== '') {
          dramaListFilePath.value = result;
          fileName.value = result.split(/[/\\]/).pop();
          console.log('[HighlightTool] 选择剧目列表文件:', dramaListFilePath.value);
        } else {
          console.log('[HighlightTool] 用户取消选择或返回空路径');
        }
      } catch (error) {
        console.error('[HighlightTool] 选择文件失败:', error);
      }
    };
    
    // 下载剧目列表模板
    const handleDownloadDramaTemplate = async () => {
      try {
        console.log('[HighlightTool] 下载剧目列表模板');
        
        // 1. 弹出文件夹选择对话框，让用户选择保存位置
        const targetFolder = await invokeIpc('select-folder');
        console.log('[HighlightTool] 用户选择的保存位置:', targetFolder);
        
        if (!targetFolder || targetFolder.trim() === '') {
          console.log('[HighlightTool] 用户取消了选择');
          return;
        }
        
        // 2. 调用 copy-template-file 接口，传入模板类型和保存位置
        const result = await triggerEvent('copy-template-file', {
          args: ['drama', targetFolder]
        });
        
        console.log('[HighlightTool] 复制结果:', result);
        
        const biz = unwrapIpcResponse(result);
        
        if (biz && biz.success) {
          console.log('[HighlightTool] 模板已保存到:', biz.filePath);
          showToast({ message: '模板下载成功！', type: 'success', duration: 3000 });
        } else {
          console.error('[HighlightTool] 下载失败:', biz?.message);
          showToast({ message: '下载失败: ' + (biz?.message || '未知错误'), type: 'error', duration: 3000 });
        }
      } catch (error) {
        console.error('[HighlightTool] 下载剧目列表模板失败:', error);
        showToast({ message: '下载失败: ' + error.message, type: 'error', duration: 3000 });
      }
    };
    
    // 本地上传：选择尾帧文件夹
    const handleLocalUpload = async () => {
      try {
        const result = await invokeIpc('select-folder');
        console.log('[HighlightTool] select-folder 返回结果:', result);
        if (result && result.trim() !== '') {
          localEndFrame.value = result;
          console.log('[HighlightTool] 选择本地尾帧文件夹:', localEndFrame.value);
        } else {
          console.log('[HighlightTool] 用户取消选择或返回空路径');
        }
      } catch (error) {
        console.error('[HighlightTool] 选择文件夹失败:', error);
      }
    };
    
    // 图片叠加：选择图片文件夹
    const handleImageOverlayUpload = async () => {
      try {
        const result = await invokeIpc('select-folder');
        console.log('[HighlightTool] select-folder 返回结果:', result);
        if (result && result.trim() !== '') {
          imageOverlay.value = result;
          console.log('[HighlightTool] 选择图片叠加文件夹:', imageOverlay.value);
        } else {
          console.log('[HighlightTool] 用户取消选择或返回空路径');
        }
      } catch (error) {
        console.error('[HighlightTool] 选择文件夹失败:', error);
      }
    };
    
    // 更改成品存储路径：选择文件夹
    const handleBrowsePath = async () => {
      try {
        const result = await invokeIpc('select-folder');
        console.log('[HighlightTool] select-folder 返回结果:', result);
        if (result && result.trim() !== '') {
          outputPath.value = result;
          console.log('[HighlightTool] 选择成品存储路径:', outputPath.value);
        } else {
          console.log('[HighlightTool] 用户取消选择或返回空路径');
        }
      } catch (error) {
        console.error('[HighlightTool] 选择文件夹失败:', error);
      }
    };
    
    // 开始解析并爬取剧目（仅下载原片，不进行混剪）
    const handleParseAndDownload = async () => {
      trackClick(TrackingEvent.HIGHLIGHT_PARSE_DOWNLOAD_START, TrackingPage.HIGHLIGHT);

      try {
        console.log('[HighlightTool] 开始解析并爬取剧目');

        // 1. 验证必填条件
        
        // 1.1 检查剧目列表 Excel 是否已上传
        if (!dramaListFilePath.value || dramaListFilePath.value.trim() === '') {
          showToast({ message: '请选择剧目列表 Excel 文件', type: 'warning', duration: 3000 });
          return;
        }

        // 1.2 检查成品存储路径是否有值
        if (!outputPath.value || outputPath.value.trim() === '') {
          showToast({ message: '请设置成品存储路径', type: 'warning', duration: 3000 });
          return;
        }

        console.log('[HighlightTool] 验证通过，开始提交解析并爬取任务');

        // 2. 准备参数（只需要 dramaListFilePath 和 outputPath）
        const dramaListFilePathValue = dramaListFilePath.value;
        const outputPathValue = outputPath.value;

        console.log('[HighlightTool] 调用后端参数:', {
          dramaListFilePath: dramaListFilePathValue,
          outputPath: outputPathValue,
          downloadOnly: true
        });

        // 3. 调用后端 IPC（使用新的事件名）
        const result = await triggerEvent('highlight-parse-and-download', {
          args: [
            dramaListFilePathValue,
            outputPathValue
          ]
        });

        console.log('[HighlightTool] 后端返回结果:', result);

        const biz = unwrapIpcResponse(result);

        if (biz && biz.success) {
          console.log('[HighlightTool] 任务提交成功:', biz.taskId);
          showToast({
            message: `解析并爬取任务已提交！任务ID: ${biz.taskId}`,
            type: 'success',
            duration: 3000
          });
          
          // 跳转到任务列表页面
          if (props.onShowTasks) {
            setTimeout(() => {
              props.onShowTasks();
            }, 500);
          }
        } else {
          showToast({ 
            message: '任务提交失败: ' + (biz?.message || '未知错误'), 
            type: 'error', 
            duration: 3000 
          });
        }
      } catch (error) {
        console.error('[HighlightTool] handleParseAndDownload 失败:', error);
        showToast({ 
          message: '任务提交失败: ' + error.message, 
          type: 'error', 
          duration: 3000 
        });
      }
    };

    const handleStartTask = async () => {
      trackClick(TrackingEvent.HIGHLIGHT_START, TrackingPage.HIGHLIGHT);

      try {
        console.log('[HighlightTool] 启动高光混剪任务');

        // 1. 检查 Excel 是否已上传
        const hasExcel = dramaListFilePath.value && dramaListFilePath.value.trim() !== '';

        // 2. 启动批量任务必须使用 Excel 剧目列表，不再从历史数据源兜底取剧名。
        if (!hasExcel) {
          showToast({
            message: '请先上传剧目列表 Excel 文件',
            type: 'warning',
            duration: 3000
          });
          return;
        }

        // 4. 检查图片叠加文件夹是否已选择
        if (!imageOverlay.value || imageOverlay.value.trim() === '') {
          showToast({ message: '请选择图片叠加文件夹', type: 'warning', duration: 3000 });
          return;
        }

        // 4.2 检查尾帧文件夹是否已选择
        if (!localEndFrame.value || localEndFrame.value.trim() === '') {
          showToast({ message: '请选择尾帧文件夹', type: 'warning', duration: 3000 });
          return;
        }

        // 4.3 检查成品存储路径是否有值
        if (!outputPath.value || outputPath.value.trim() === '') {
          showToast({ message: '请设置成品存储路径', type: 'warning', duration: 3000 });
          return;
        }

        // 4.4 检查混剪末尾保留秒数是否有值
        if (endRetentionSeconds.value === null || endRetentionSeconds.value === undefined || endRetentionSeconds.value === '') {
          showToast({ message: '请设置混剪末尾保留秒数', type: 'warning', duration: 3000 });
          return;
        }

        const stitchEpisodeCountValue = Number(stitchEpisodeCount.value);
        if (![1, 2, 3].includes(stitchEpisodeCountValue)) {
          showToast({ message: '拼接集数只能选择 1、2、3', type: 'warning', duration: 3000 });
          return;
        }

        console.log('[HighlightTool] 所有验证通过，开始提交任务');

        // 2. 准备参数
        const dramaListFilePathValue = dramaListFilePath.value;
        const imageOverlayPath = imageOverlay.value;
        const endFrameFolderPath = localEndFrame.value;
        const outputPathValue = outputPath.value;
        const endRetentionSecondsValue = endRetentionSeconds.value;
        const isScheduledTask = false;

        console.log('[HighlightTool] 调用后端参数:', {
          dramaListFilePath: dramaListFilePathValue,
          imageOverlayPath,
          endFrameFolderPath,
          outputPath: outputPathValue,
          endRetentionSeconds: endRetentionSecondsValue,
          stitchEpisodeCount: stitchEpisodeCountValue,
          isScheduledTask
        });

        // 3. 调用后端 IPC
        const result = await triggerEvent('highlight-mix-edit-auto-start', {
          args: [
            dramaListFilePathValue,
            imageOverlayPath,
            endFrameFolderPath,
            outputPathValue,
            endRetentionSecondsValue,
            isScheduledTask,
            stitchEpisodeCountValue
          ]
        });

        console.log('[HighlightTool] 后端返回结果:', result);

        const biz = unwrapIpcResponse(result);

        if (biz && biz.success) {
          console.log('[HighlightTool] 任务提交成功:', biz.taskId);
          showToast({
            message: `任务已提交！任务ID: ${biz.taskId}，队列长度: ${biz.queueLength || 0}`,
            type: 'success',
            duration: 3000
          });
          
          // 跳转到任务列表页面
          if (props.onShowTasks) {
            setTimeout(() => {
              props.onShowTasks();
            }, 500); // 延迟500ms，让用户看到提示
          }
        } else {
          showToast({ 
            message: '任务提交失败: ' + (biz?.message || '未知错误'), 
            type: 'error', 
            duration: 3000 
          });
        }
      } catch (error) {
        console.error('[HighlightTool] handleStartTask 失败:', error);
        showToast({ 
          message: '任务提交失败: ' + error.message, 
          type: 'error', 
          duration: 3000 
        });
      }
    };

    return () =>
      h('div', { class: 'p-8 max-w-5xl mx-auto bg-background animate-fade-in pb-24' }, [
        h('div', { class: 'mb-8' }, [
          h('h2', { class: 'text-xl font-bold text-gray-800' }, '高光混剪任务'),
          h('p', { class: 'text-sm text-gray-500 mt-1' }, '批量导入剧目数据，自动生成AI文案并混剪。')
        ]),
        h('div', { class: 'mb-8' }, [h(ReadinessPanel, { items: readinessItems.value })]),
        h('div', { class: 'bg-white rounded-lg shadow-sm border border-gray-200 p-8' }, [
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '数据导入与爬取')]),
              h('div', {}, [
              h('div', { class: 'flex justify-between items-center mb-2' }, [
                h('label', { class: 'block text-sm font-medium text-gray-700' }, '剧目列表 Excel'),
                h('button', { onClick: handleDownloadDramaTemplate, class: 'text-xs text-primary hover:text-blue-600 flex items-center gap-1 transition-colors' }, [
                  h(IconComponents.Download, { class: 'w-3.5 h-3.5' }),
                  '下载模板'
                ])
              ]),
              h(
                'div',
                {
                  onClick: handleFileUpload,
                  class: [
                    'w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all bg-gray-50 cursor-pointer',
                    fileName.value ? 'border-primary/50 bg-blue-50/30' : 'border-gray-300 hover:border-primary/50 hover:bg-gray-100/50'
                  ]
                },
                fileName.value
                  ? [
                      h(IconComponents.Download, { class: 'w-8 h-8 text-primary mb-2' }),
                      h('span', { class: 'text-sm font-medium text-gray-800 truncate max-w-[80%] px-2' }, fileName.value),
                      h('span', { class: 'text-xs text-primary mt-1' }, '点击更换文件')
                    ]
                  : [
                      h(IconComponents.Upload || IconComponents.Download, { class: 'w-8 h-8 text-gray-400 mb-2' }),
                      h('span', { class: 'text-sm text-gray-600' }, '点击选择剧目列表'),
                      h('span', { class: 'text-xs text-gray-400 mt-1' }, '支持 .xlsx, .xls')
                    ]
              ),
              // 只有当用户上传了Excel后，才显示"开始解析并爬取剧目"按钮
              fileName.value ? h('div', { class: 'mt-4' }, [
                h('button', {
                  onClick: handleParseAndDownload,
                  class: 'w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg transition-colors text-sm font-medium shadow-sm'
                }, '开始解析并爬取剧目')
              ]) : null
            ])
          ]),
          h('div', { class: 'mb-8' }, [
            h('div', { class: 'flex items-center mb-6' }, [h('div', { class: 'w-1 h-4 bg-primary rounded mr-2' }), h('h3', { class: 'text-base font-semibold text-gray-800' }, '混剪配置')]),
            h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' }, [
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '尾帧选择'),
                h('div', { class: 'flex gap-2' }, [
                  h('input', {
                    type: 'text',
                    placeholder: '未选择文件夹',
                    value: localEndFrame.value || '',
                    readonly: true,
                    class: 'flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none bg-gray-50'
                  }),
                  h(
                    'button',
                    { 
                      onClick: handleLocalUpload, 
                      class: 'inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors whitespace-nowrap' 
                    },
                    [
                      h(IconComponents.Upload || IconComponents.Download, { class: 'w-4 h-4' }),
                      '本地上传'
                    ]
                  )
                ])
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '图片叠加'),
                h('div', { class: 'flex gap-2' }, [
                  h('input', {
                    type: 'text',
                    placeholder: '未选择图片文件',
                    value: imageOverlay.value || '',
                    readonly: true,
                    class: 'flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none bg-gray-50'
                  }),
                  h(
                    'button',
                    { 
                      onClick: handleImageOverlayUpload, 
                      class: 'inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors whitespace-nowrap' 
                    },
                    [
                      h(IconComponents.Upload || IconComponents.Download, { class: 'w-4 h-4' }),
                      '选择图片'
                    ]
                  )
                ])
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '成品存储路径'),
                h('div', { class: 'flex gap-2' }, [
                  h('input', { type: 'text', value: outputPath.value, readonly: true, class: 'flex-1 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 focus:outline-none' }),
                  h('button', { onClick: handleBrowsePath, class: 'px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 shadow-sm' }, '更改')
                ])
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '混剪末尾保留秒数'),
                h('div', { class: 'relative' }, [
                  h('input', {
                    type: 'number',
                    min: 0,
                    max: 60,
                    value: endRetentionSeconds.value,
                    onInput: (e) => (endRetentionSeconds.value = Number(e.target.value)),
                    class: 'w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors bg-white'
                  }),
                  h('div', { class: 'absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none' }, [h('span', { class: 'text-gray-400 text-xs' }, '秒')])
                ])
              ]),
              h('div', {}, [
                h('label', { class: 'block text-sm font-medium text-gray-700 mb-2' }, '拼接集数'),
                h(
                  'select',
                  {
                    value: stitchEpisodeCount.value,
                    onChange: (e) => (stitchEpisodeCount.value = Number(e.target.value)),
                    class: 'w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors bg-white'
                  },
                  [
                    h('option', { value: 1 }, '1集'),
                    h('option', { value: 2 }, '2集'),
                    h('option', { value: 3 }, '3集')
                  ]
                )
              ])
            ])
          ]),
          h('div', { class: 'mt-6 flex justify-end gap-3' }, [
            h(
              'button',
              {
                onClick: handleStartTask,
                class: 'px-8 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded transition-all shadow-sm'
              },
              '启动批量任务'
            )
          ])
        ])
      ]);
  }
};
