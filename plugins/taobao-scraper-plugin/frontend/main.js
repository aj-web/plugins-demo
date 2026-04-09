import { executeKeyWordTaoBaoSearch, executeImageTaoBaoSearch, executeKeyWordXhsSearch, executeImage1688Search, executeKeyWordJDSearch, executeSKUJDSearch } from './platformExecutors.js';

import { triggerEvent, invokeIpc } from './ipc.js';

const { createApp, ref, reactive, computed } = Vue;

const PLATFORM_LIST = [
  { key: 'xiaohongshu', name: '小红书', supports: ['关键词'] },
  { key: 'taobao', name: '淘宝', supports: ['关键词', 'SKU', '图片'] },
  { key: '1688', name: '1688', supports: ['SKU', '图片'] },
  { key: 'jd', name: '京东', supports: ['关键词', 'SKU'] }
];

const PLATFORM_FILTER_CONFIG = {
  xiaohongshu: [
    {
      key: 'contentType',
      label: '素材类型',
      options: [
        { label: '默认', value: 0 },
        { label: '视频', value: 1 },
        { label: '图片', value: 2 }
      ]
    },
    {
      key: 'sortMode',
      label: '排序方式',
      options: [
        { label: '默认', value: 'general' },
        { label: '最受欢迎', value: 'popularity_descending' },
        { label: '最新发布', value: 'time_descending' }
      ]
    }
  ]
};

const createInitialPlatformState = (key) => {
  const state = {
        isLoggedIn: false,
    searchMode: 'keyword',
    taskForm: {
      name: '',
      keywords: '',
      skus: '',
      imageFiles: []
    },
    filters: {},
    searchResults: [],
    lastSearchSummary: '',
    isLoggingIn: false
  };

  if (key === 'xiaohongshu') {
    state.filters = {
      contentType: 0,
      sortMode: 'general'
    };
  }

  if (key === '1688') {
    state.searchMode = 'sku'; // 1688 默认使用 SKU 搜索
  }

  return state;
};

const app = createApp({
  setup() {
    const activeTab = ref('tasks'); // 'tasks' | 平台 key
    const viewingTask = ref(null);
    const selectedMedia = ref([]); // 存储已选素材（图/视频）的 id
    const draggedMedia = ref(null);

    const platformState = reactive(
      PLATFORM_LIST.reduce((acc, platform) => {
        acc[platform.key] = createInitialPlatformState(platform.key);
        return acc;
      }, {})
    );

    const notifications = ref([]);
    let notificationId = 0;

    // 任务失败弹窗状态
    const failureDialog = reactive({
      visible: false,
      title: '任务执行失败',
      message: ''
    });

    // 任务队列与自增 id（全动态，无 mock）
    const taskIdCounter = ref(1);
    const itemIdCounter = ref(1);
    const tasks = ref([]);
    const isExecutorRunning = ref(false);

    const fallbackTaskForm = reactive({
      name: '',
      keywords: '',
      skus: '',
      imageFiles: []
    });

    const platforms = PLATFORM_LIST;

    const getStatusConfig = (status) => {
      const configs = {
        pending: { text: '待执行', color: 'bg-gray-100 text-gray-600' },
        running: { text: '执行中', color: 'bg-blue-100 text-blue-600' },
        completed: { text: '已完成', color: 'bg-green-100 text-green-600' },
        failed: { text: '失败', color: 'bg-red-100 text-red-600' }
      };
      return configs[status] || configs.pending;
    };

    const isPlatformTab = computed(() => activeTab.value !== 'tasks');
    const activePlatformState = computed(() => (isPlatformTab.value ? platformState[activeTab.value] : null));

    const isLoggedIn = computed({
      get: () => (activePlatformState.value ? activePlatformState.value.isLoggedIn : false),
      set: (value) => {
        if (activePlatformState.value) {
          activePlatformState.value.isLoggedIn = value;
        }
      }
    });

    const isLoggingIn = computed({
      get: () => (activePlatformState.value ? activePlatformState.value.isLoggingIn : false),
      set: (value) => {
        if (activePlatformState.value) {
          activePlatformState.value.isLoggingIn = value;
        }
      }
    });

    const searchMode = computed({
      get: () => (activePlatformState.value ? activePlatformState.value.searchMode : 'keyword'),
      set: (value) => {
        if (activePlatformState.value) {
          activePlatformState.value.searchMode = value;
        }
      }
    });

    const taskForm = computed(() => (activePlatformState.value ? activePlatformState.value.taskForm : fallbackTaskForm));

    const currentFilters = computed(() => (activePlatformState.value ? activePlatformState.value.filters || {} : {}));
    const currentFilterConfig = computed(() => (isPlatformTab.value ? PLATFORM_FILTER_CONFIG[activeTab.value] || [] : []));

    // 通过宿主直接返回 data URL（支持多选）
    const pickImagesFromHost = async () => {
      const res = await invokeIpc('select-file-url');
      const files = Array.isArray(res?.files) ? res.files : [];
      if (!files.length && res?.filePath) files.push({ filePath: res.filePath, dataUrl: res.dataUrl });
      if (!files.length) throw new Error('未返回文件');
      const incomplete = files.find((f) => !f?.filePath || !f?.dataUrl);
      if (incomplete) throw new Error('返回的图片数据不完整');
      return files;
    };

    // 通过宿主 select-file-url 选择本地图片（单次可多张）
    const handleImageUpload = async () => {
      if (!activePlatformState.value) return;
      try {
        const files = await pickImagesFromHost();
        const now = Date.now();
        const images = files.map((file, idx) => {
          const name = file.filePath.split(/[/\\]/).pop() || '未命名图片';
      return {
            id: now + idx,
            path: file.filePath,
            preview: file.dataUrl,
            name
          };
        });
        activePlatformState.value.taskForm.imageFiles = [...activePlatformState.value.taskForm.imageFiles, ...images];
      } catch (err) {
        console.error('[handleImageUpload:error]', err);
        pushNotification(err?.message || '选择图片失败，请重试', 'error');
      }
    };

    const removeImage = (id) => {
      if (!activePlatformState.value) return;
      activePlatformState.value.taskForm.imageFiles = activePlatformState.value.taskForm.imageFiles.filter((img) => img.id !== id);
    };

    const currentPlatformName = computed(() => {
      if (activeTab.value === 'tasks') return '任务列表';
      const p = platforms.find((p) => p.key === activeTab.value);
      return p ? p.name : '';
    });

    const currentPlatformSupports = (type) => {
      const p = platforms.find((p) => p.key === activeTab.value);
      return p ? p.supports.includes(type) : false;
    };

    const pushNotification = (message, type = 'info') => {
      const id = ++notificationId;
      notifications.value.push({ id, message, type });
      setTimeout(() => dismissNotification(id), 3000);
    };

    const dismissNotification = (id) => {
      notifications.value = notifications.value.filter((n) => n.id !== id);
    };

    const parseLines = (text) =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // 统一的媒体数据结构：mediaData
    // { id, type: 'image' | 'video', url, coverUrl, title, name, link, source, rank }
    // 便于前端同时渲染图片和视频

    const loginEventMap = {
      taobao: 'taobao-login',
      xiaohongshu: 'xhs-login',
      1688: '1688-login',
      jd: 'jd-login'
    };

    // triggerEvent 与 invokeIpc 已经抽取到独立的 ipc.js 中，这里直接使用导入的方法

    const buildItemsFromForm = (mode, form) => {
      if (mode === 'keyword') {
        return parseLines(form.keywords).map((keyword) => ({
          id: itemIdCounter.value++,
          type: 'keyword',
          input: keyword,
          status: 'pending',
          error: null,
          result: null
        }));
      }
      if (mode === 'sku') {
        return parseLines(form.skus).map((sku) => ({
          id: itemIdCounter.value++,
          type: 'sku',
          input: sku,
          status: 'pending',
          error: null,
          result: null
        }));
      }
      if (mode === 'image') {
        // 与后端约定保持兼容：item.file 保留上传时的完整对象结构（包含 file、preview、name 等）
        return (form.imageFiles || []).map((img) => ({
          id: itemIdCounter.value++,
          type: 'image',
          input: img.name || '未命名图片',
          filePath: img.path || img.file?.path || img.file?.file?.path || null,
          file: img, // 这里保留外层对象，后续从 filePath 或 file.path 中取真实路径
          status: 'pending',
          error: null,
          result: null
        }));
      }
      return [];
    };

    const handleLogin = async () => {
      if (!isPlatformTab.value || !activePlatformState.value) {
        pushNotification('请先选择具体平台', 'warning');
        return;
      }

      const platformKey = activeTab.value;
      const startEvent = loginEventMap[platformKey];
      if (!startEvent) {
        pushNotification('当前平台未配置登录事件', 'warning');
        return;
      }

      if (isLoggingIn.value) return;
      isLoggingIn.value = true;
      pushNotification(`正在启动 ${currentPlatformName.value} 登录...`, 'info');

      try {
        console.log('[login:start]', platformKey);
        const res = await triggerEvent(startEvent, {});
        if (res?.success && res?.result?.success) {
          isLoggedIn.value = true;
          pushNotification(`${currentPlatformName.value} 登录成功`, 'success');
          console.log('[login:success]', platformKey);
        } else {
          const msg = res?.result?.message || res?.error || '登录失败';
          isLoggedIn.value = false;
          pushNotification(msg, 'error');
          console.warn('[login:failed]', platformKey, msg);
        }
      } catch (err) {
        isLoggedIn.value = false;
        pushNotification('登录过程出现异常', 'error');
        console.error('[login:error]', platformKey, err);
      } finally {
        isLoggingIn.value = false;
      }
    };

    const handleCreateTask = () => {
      if (!activePlatformState.value) {
        pushNotification('请选择具体平台后再创建任务', 'warning');
        return;
      }
      const form = activePlatformState.value.taskForm;
      if (!form.name.trim()) {
        pushNotification('请输入任务名称', 'warning');
        return;
      }
      if (!isLoggedIn.value) {
        pushNotification(`请先登录 ${currentPlatformName.value}`, 'warning');
          return;
        }
      const platform = platforms.find((p) => p.key === activeTab.value);
      const mode = searchMode.value;
      const searchType = mode === 'keyword' ? '关键词' : mode === 'sku' ? 'SKU' : '图片';

      if (platform?.key === '1688' && mode === 'keyword') {
        pushNotification('1688 不支持关键词搜索，请改用 SKU 搜索', 'warning');
          return;
        }

      const items = buildItemsFromForm(mode, form);
      if (items.length === 0) {
        pushNotification('请输入有效的任务内容', 'warning');
          return;
      }

      const newTaskId = taskIdCounter.value++;
      const newTask = {
        id: newTaskId,
        name: form.name.trim(),
        platform: platform ? platform.name : '',
        platformKey: platform ? platform.key : '',
        searchType,
        mode,
        createdAt: new Date().toLocaleString('zh-CN'),
        count: items.length,
        status: 'pending',
        cursor: 0,
        items,
        lastUpdatedAt: null
      };

      tasks.value = [...tasks.value, newTask];
      console.log('[task:create]', {
        id: newTask.id,
        platformKey: newTask.platformKey,
        searchType,
        mode
      });

      form.name = '';
      form.keywords = '';
      form.skus = '';
      form.imageFiles = [];
      pushNotification('任务创建成功', 'success');
      startExecutor();
    };

    const findNextPendingTaskIndex = () => tasks.value.findIndex((t) => t.status === 'pending');

    // 包装执行函数，若返回失败则重置对应平台登录态，强制用户重新登录
    const runWithLoginReset = async (platformKey, executor) => {
      const res = await executor();
      if (!res?.success && platformState[platformKey]) {
        platformState[platformKey].isLoggedIn = false;
        console.warn('[task:login-reset]', { platformKey, reason: 'execute failed' });
      }
      return res;
    };

    const executeItem = async (task, item) => {
      console.log('[task:executeItem:start]', {
        taskId: task.id,
        itemId: item.id,
        platformKey: task.platformKey,
        itemType: item.type
      });

      const taskPlatformState = platformState[task.platformKey] || {};

      switch (task.platformKey) {
        case 'taobao': {
          switch (item.type) {
            case 'keyword': {
              const args = [item.input];
              return await runWithLoginReset(task.platformKey, () => executeKeyWordTaoBaoSearch('keyword-search', args, '搜索失败'));
            }
            case 'sku': {
              const args = [null, item.input]; // runSearch(filePath, skuId)
              return await runWithLoginReset(task.platformKey, () => executeImageTaoBaoSearch('image-search', args, '图片搜索失败'));
            }
            case 'image': {
              const filePath = item.filePath;
              const args = [filePath, null]; // runSearch(filePath, skuId)
              return await runWithLoginReset(task.platformKey, () => executeImageTaoBaoSearch('image-search', args, '图片搜索失败'));
            }
          }
          break;
        }

        case 'xiaohongshu': {
          switch (item.type) {
            case 'keyword': {
              const filters = taskPlatformState.filters || {};
              const noteType = filters.contentType ?? 0;
              const sort = filters.sortMode ?? 'general';
              const args = [item.input, noteType, sort];
              return await runWithLoginReset(task.platformKey, () => executeKeyWordXhsSearch('xhs-keyword-search', args, '小红书搜索失败'));
            }
          }
          break;
        }

        case '1688': {
          switch (item.type) {
            case 'keyword': {
              const errorMsg = '1688 不支持关键词搜索，请改用 SKU 搜索';
              console.warn('[task:executeItem:invalid-type]', { platform: '1688', type: 'keyword', item });
              return { success: false, error: errorMsg };
            }
            case 'sku': {
              const args = [null, item.input]; // startSearch(filePath, skuId)
              return await runWithLoginReset(task.platformKey, () => executeImage1688Search('1688-image-search', args, '1688搜索失败'));
            }
            case 'image': {
              const filePath = item.filePath;
              const args = [filePath, null]; // startSearch(filePath, skuId?)
              return await runWithLoginReset(task.platformKey, () => executeImage1688Search('1688-image-search', args, '1688图片搜索失败'));
            }
          }
          break;
        }

        case 'jd': {
          switch (item.type) {
            case 'keyword': {
              const args = [item.input];
              return await runWithLoginReset(task.platformKey, () => executeKeyWordJDSearch('jd-keyword-search', args, '京东搜索失败'));
            }
            case 'sku': {
              const args = [item.input];
              return await runWithLoginReset(task.platformKey, () => executeSKUJDSearch('jd-sku-search', args, '京东SKU搜索失败'));
            }
          }
          break;
        }
      }

      const msg = `未找到可用的后端事件: platform=${task.platformKey}, type=${item.type}`;
      console.warn('[task:executeItem:no-event]', { taskId: task.id, itemId: item.id, msg });
      return { success: false, error: msg };
    };

    const processTask = async (task) => {
      task.status = 'running';
      task.lastUpdatedAt = new Date().toLocaleString('zh-CN');

      for (let i = 0; i < task.items.length; i++) {
        const item = task.items[i];
        if (item.status === 'success') continue;

        const result = await executeItem(task, item);
        if (result.success) {
          item.status = 'success';
          item.error = null;
          item.result = result.data || null;
          const total = result?.data?.total;
          if (typeof total === 'number' && !Number.isNaN(total)) {
            task.count = total;
          }
          task.cursor = i + 1;
          task.lastUpdatedAt = new Date().toLocaleString('zh-CN');
        } else {
          item.status = 'failed';
          item.error = result.error || '未知错误';
          task.status = 'failed';
          task.lastUpdatedAt = new Date().toLocaleString('zh-CN');
          console.warn('[task:failed]', {
            taskId: task.id,
            itemId: item.id,
            error: item.error
          });

          // 显示任务失败弹窗（需用户手动关闭）
          failureDialog.visible = true;
          failureDialog.title = '任务执行失败';
          failureDialog.message = `任务「${task.name || task.id}」在处理「${item.input || item.type || ''}」时失败：` + (item.error || '未知错误');

          return;
        }
      }

      task.status = 'completed';
      task.lastUpdatedAt = new Date().toLocaleString('zh-CN');
      console.log('[task:completed]', { taskId: task.id });
    };

    const startExecutor = async () => {
      if (isExecutorRunning.value) return;
      isExecutorRunning.value = true;

      while (true) {
        const idx = findNextPendingTaskIndex();
        if (idx === -1) break;
        const task = tasks.value[idx];
        await processTask(task);
      }

      isExecutorRunning.value = false;
    };

    const handleSwitchTab = (key) => {
      activeTab.value = key;
      viewingTask.value = null;
      selectedMedia.value = [];
    };

    const handleViewTask = (task) => {
      viewingTask.value = task;
      selectedMedia.value = [];
    };

    const handleBackToTaskList = () => {
      viewingTask.value = null;
      selectedMedia.value = [];
    };

    const getSearchTypeLabel = (type) => {
      if (type === 'keyword') return '关键词';
      if (type === 'sku') return 'SKU';
      if (type === 'image') return '图片';
      return '';
    };

    // 判断任务是否有失败或待执行的 items（用于显示"继续执行"按钮）
    const hasFailedOrPendingItems = (task) => {
      if (!task || !task.items) return false;
      return task.items.some((item) => item.status === 'failed' || item.status === 'pending');
    };

    // 计算任务中成功的 items
    const successfulItems = computed(() => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      return viewingTask.value.items.filter((item) => item.status === 'success');
    });

    // 计算任务中真正失败的 items（status === 'failed'）
    const failedItems = computed(() => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      return viewingTask.value.items.filter((item) => item.status === 'failed');
    });

    // 计算任务中待执行的 items（status === 'pending'）
    const pendingItems = computed(() => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      return viewingTask.value.items.filter((item) => item.status === 'pending');
    });

    // 计算失败和未执行的 items（用于继续执行，只在 failed 状态时使用）
    const failedOrPendingItems = computed(() => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      return viewingTask.value.items.filter((item) => item.status === 'failed' || item.status === 'pending');
    });

    // 计算任务中所有图片的总数（从成功的 items 中统计）
    const totalMediaInTask = computed(() => {
      if (!viewingTask.value || !viewingTask.value.items) return 0;
      return successfulItems.value.reduce((sum, item) => {
        if (item.result && Array.isArray(item.result.mediaData)) {
          return sum + item.result.mediaData.length;
        }
        return sum;
      }, 0);
    });

    const selectAllMedia = () => {
      if (!viewingTask.value || !viewingTask.value.items) return;
      const allIds = successfulItems.value.flatMap((item) => {
        if (item.result && Array.isArray(item.result.mediaData)) {
          return item.result.mediaData.map((media) => media.id);
        }
        return [];
      });
      if (selectedMedia.value.length === allIds.length) {
        selectedMedia.value = [];
      } else {
        selectedMedia.value = allIds;
      }
    };

    const toggleSelectAllInItem = (item) => {
      if (!item.result || !Array.isArray(item.result.mediaData)) return;
      const itemMediaIds = item.result.mediaData.map((media) => media.id);
      const allSelected = itemMediaIds.every((id) => selectedMedia.value.includes(id));
      if (allSelected) {
        selectedMedia.value = selectedMedia.value.filter((id) => !itemMediaIds.includes(id));
        } else {
        selectedMedia.value = Array.from(new Set([...selectedMedia.value, ...itemMediaIds]));
      }
    };

    const getSelectedMediaByCategory = () => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      const result = [];
      successfulItems.value.forEach((item) => {
        if (item.result && Array.isArray(item.result.mediaData)) {
          const medias = item.result.mediaData.filter((m) => selectedMedia.value.includes(m.id));
          if (medias.length > 0) {
            result.push({
              type: item.type,
              value: item.input,
              media: medias.sort((a, b) => selectedMedia.value.indexOf(a.id) - selectedMedia.value.indexOf(b.id))
            });
          }
        }
      });
      return result;
    };

    // 将当前选中的 mediaId 转换为后端 download-images-as-zip 所需的结构
    // 每一项: { url, index, platform, productTitle }
    const buildDownloadImagesPayload = () => {
      if (!viewingTask.value || !viewingTask.value.items) return [];
      const platformLabel = viewingTask.value.platform || viewingTask.value.platformKey || '';
      const images = [];

      // 按照 selectedMedia 的顺序构建 payload
      selectedMedia.value.forEach((mediaId, globalIndex) => {
        let found = null;

        for (const item of successfulItems.value) {
          if (!item.result || !Array.isArray(item.result.mediaData)) continue;
          const media = item.result.mediaData.find((m) => m.id === mediaId);
          if (media) {
            found = { item, media };
            break;
          }
        }

        if (found && found.media?.url) {
          const { item, media } = found;
          images.push({
            url: media.url,
            index: globalIndex,
            platform: platformLabel,
            productTitle: media.title || media.name || `${item.type || ''}-${item.input || ''}`.trim()
          });
        }
      });

      return images;
    };

    // 继续执行任务：将未完成的任务置为 pending，移到队尾
    const handleResumeTask = (taskId) => {
      const idx = tasks.value.findIndex((t) => t.id === taskId);
      if (idx === -1) {
        pushNotification('任务不存在', 'error');
        return;
      }
      const task = tasks.value[idx];
      if (!task.items || task.items.length === 0) {
        pushNotification('任务无可执行条目', 'warning');
        return;
      }

      let cursor = task.items.findIndex((item) => item.status !== 'success');
      if (cursor === -1) {
        pushNotification('该任务已全部完成', 'info');
        return;
      }

      // 重置非 success 的条目为 pending，清理错误和结果
      const resetItems = task.items.map((item) => {
        if (item.status === 'success') return item;
        return {
          ...item,
          status: 'pending',
          error: null,
          result: null
        };
      });

      const resumedTask = {
        ...task,
        items: resetItems,
        status: 'pending',
        cursor,
        lastUpdatedAt: new Date().toLocaleString('zh-CN')
      };

      // 将任务移到队尾
      const newQueue = [...tasks.value];
      newQueue.splice(idx, 1);
      newQueue.push(resumedTask);
      tasks.value = newQueue;

      pushNotification(`任务已移动至队尾，待继续执行（从第 ${cursor + 1} 个条目）`, 'info');
      startExecutor();
    };

    const handleDownload = async () => {
      if (selectedMedia.value.length === 0) {
        pushNotification('请先选择要下载的素材', 'warning');
        return;
      }
      const images = buildDownloadImagesPayload();
      if (!images.length) {
        pushNotification('选中的素材数据异常，无法下载', 'error');
        return;
      }

      pushNotification(`已选择 ${selectedMedia.value.length} 个素材，开始打包下载...`, 'success');

      try {
        const result = await invokeIpc('download-images-as-zip', images);
        if (result && result.success) {
          pushNotification('ZIP 文件下载完成！', 'success');
        } else {
          pushNotification(`ZIP 打包下载失败: ${result?.error || '未知错误'}`, 'error');
        }
      } catch (error) {
        console.error('[handleDownload:error]', error);
        pushNotification(`ZIP 打包下载失败: ${error?.message || '未知错误'}`, 'error');
      }
    };

    const handleDragStart = (e, mediaId) => {
      draggedMedia.value = mediaId;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    };

    const handleDrop = (e, targetMediaId) => {
      e.preventDefault();
      if (draggedMedia.value === targetMediaId) return;
      const draggedIndex = selectedMedia.value.indexOf(draggedMedia.value);
      const targetIndex = selectedMedia.value.indexOf(targetMediaId);
      if (draggedIndex === -1 || targetIndex === -1) return;
      const newArr = [...selectedMedia.value];
      newArr.splice(draggedIndex, 1);
      newArr.splice(targetIndex, 0, draggedMedia.value);
      selectedMedia.value = newArr;
      draggedMedia.value = null;
    };

    const resetTaskForm = () => {
      if (!activePlatformState.value) return;
      activePlatformState.value.taskForm.name = '';
      activePlatformState.value.taskForm.keywords = '';
      activePlatformState.value.taskForm.skus = '';
      activePlatformState.value.taskForm.imageFiles = [];
      const filters = activePlatformState.value.filters;
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          const filterConfig = currentFilterConfig.value.find((config) => config.key === key);
          if (filterConfig) {
            filters[key] = filterConfig.options[0].value;
        } else {
            filters[key] = value;
          }
        });
      }
    };

    const updatePlatformFilter = (filterKey, value) => {
      if (!activePlatformState.value) return;
      if (!activePlatformState.value.filters) {
        activePlatformState.value.filters = {};
      }
      activePlatformState.value.filters[filterKey] = value;
    };

    return {
      // state
      activeTab,
      viewingTask,
      selectedMedia,
      draggedMedia,
      tasks,
      platforms,
      notifications,
      failureDialog,

      // computed
      isLoggedIn,
      searchMode,
      taskForm,
      currentPlatformName,
      totalMediaInTask,
      currentPlatformSupports,
      currentFilterConfig,
      currentFilters,
      successfulItems,
      failedItems,
      pendingItems,
      failedOrPendingItems,

      // methods
      getStatusConfig,
      handleImageUpload,
      removeImage,
      handleCreateTask,
      handleSwitchTab,
      handleViewTask,
      handleBackToTaskList,
      handleLogin,
      getSearchTypeLabel,
      hasFailedOrPendingItems,
      toggleMediaSelection: (mediaId) => {
        if (selectedMedia.value.includes(mediaId)) {
          selectedMedia.value = selectedMedia.value.filter((id) => id !== mediaId);
        } else {
          selectedMedia.value = [...selectedMedia.value, mediaId];
        }
      },
      selectAllMedia,
      toggleSelectAllInItem,
      getSelectedMediaByCategory,
      handleResumeTask,
      handleDownload,
      handleDragStart,
      handleDragOver,
      handleDrop,
      resetTaskForm,
      updatePlatformFilter,
      dismissNotification,
      closeFailureDialog: () => {
        failureDialog.visible = false;
      }
    };
  }
});

app.mount('#app');
