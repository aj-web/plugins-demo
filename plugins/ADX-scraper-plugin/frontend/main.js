const { createApp, ref, computed } = window.Vue;

// 平台枚举
const PLATFORMS = {
  ADX: 'adx',
  YOUMI: 'youmi',
  REYUN: 'reyun',
  DOUYIN: 'douyin'
};

// 简易 postMessage 事件触发器（与淘宝插件一致的约定）
let seq = 0;
const triggerEvent = async (eventType, params = {}) => {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 6000000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
        if (data.success) resolve(data.result);
        else reject(new Error(data.error || '未知错误'));
      }
    };
    window.addEventListener('message', messageHandler);
    window.parent.postMessage(
      {
        source: 'plugin-frontend',
        action: 'trigger-event',
        id,
        payload: { eventType, params }
      },
      '*'
    );
  });
};

const invokeIpc = async (channel, args = []) => {
  console.log('[invokeIpc] Calling channel:', channel, 'with args:', args);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => {
      reject(new Error('请求超时'));
    }, 6000000);

    const messageHandler = (event) => {
      const data = event.data || {};
      if (data.source === 'host' && data.id === id) {
        console.log('[invokeIpc] Received response for id:', id, 'data:', data);
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);

        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || '未知错误'));
        }
      }
    };
    window.addEventListener('message', messageHandler);
    window.parent.postMessage(
      {
        source: 'plugin-frontend',
        action: 'ipc-invoke',
        id,
        payload: { channel, args }
      },
      '*'
    );
  });
};

const App = {
  setup() {
    // 平台选择 - 默认ADX
    const selectedPlatform = ref(PLATFORMS.ADX);

    // 登录状态 - 自动根据PLATFORMS枚举初始化
    const loginStatus = ref(
      Object.values(PLATFORMS).reduce((acc, platform) => {
        acc[platform] = false;
        return acc;
      }, {})
    );

    // 登录中状态
    const isLoggingIn = ref(false);

    // 当前平台的登录状态
    const isLoggedIn = computed(() => {
      return loginStatus.value[selectedPlatform.value] || false;
    });

    // 存储Excel数据
    const excelData = ref([]); // 存储Excel数据

    // 文件选择相关
    const selectedFileName = ref('');
    const isSelectingFile = ref(false);

    // 元素配置
    const showElements = ref(false);
    // 采用 { mode: 'required'|'random', probability: number(0-100) } 结构
    const elementConfig = ref({
      badge: { mode: 'required', probability: 100 },
      guide: { mode: 'random', probability: 70 },
      title: { mode: 'random', probability: 80 },
      ending: { mode: 'random', probability: 70 }
    });

    // 导出配置
    const exportConfig = ref({
      resolution: '720x1280',
      fileSize: '500mb',
      naming: '{纯扒}-{鱼儿组}-{adx}',
      batchSize: 1 // 视频裂变次数
    });

    // 处理相关
    const splitCount = ref(3);
    const isProcessing = ref(false);

    // 设置弹窗相关
    const showSettings = ref(false);
    const selectedDownloadFolder = ref('');
    const selectedConfigFolderName = ref('');
    const isSelectingDownloadFolder = ref(false);
    const isSelectingConfigFolder = ref(false);

    // 模板配置路径（全局变量）
    const templateConfigPath = ref('');

    // 显示消息的辅助函数
    const showMessage = (message, type = 'info') => {
      if (window.ElementPlus && window.ElementPlus.ElMessage) {
        window.ElementPlus.ElMessage({
          message,
          type,
          duration: 3000
        });
      } else {
        // 如果ElementPlus不可用，使用console输出
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    };

    // 登录处理函数
    const handleLogin = async () => {
      if (isLoggingIn.value) return;

      isLoggingIn.value = true;
      try {
        const platform = selectedPlatform.value;

        if (platform === PLATFORMS.ADX) {
          console.log('触发 ADX 登录...');
          const res = await triggerEvent('adx-login', {});
          console.log('登录返回:', res);

          // 修复：检查嵌套的result.success字段
          if (res && res.result && res.result.success === true) {
            loginStatus.value[platform] = true;
            console.log('ADX 登录成功');
          } else {
            loginStatus.value[platform] = false;
            console.log('ADX 登录失败或取消:', res?.result?.message || '未知原因');
          }
        } else if (platform === PLATFORMS.DOUYIN) {
          showMessage('抖音平台登录功能暂未实现', 'warning');
        } else {
          showMessage(`${platform} 平台登录功能暂未实现`, 'warning');
        }
      } catch (e) {
        console.error('登录失败', e);
        // 登录出错时也要重置状态
        loginStatus.value[selectedPlatform.value] = false;
      } finally {
        isLoggingIn.value = false;
      }
    };

    // 文件选择相关方法
    const selectExcelFile = async () => {
      isSelectingFile.value = true;
      try {
        console.log('开始选择Excel文件...');

        // 直接调用框架的selectFile方法
        const result = await invokeIpc('select-file');

        // 修正判断条件：result可能是字符串路径，也可能是对象
        if (result) {
          let filePath, fileName;

          if (typeof result === 'string') {
            // 如果result是字符串路径
            filePath = result;
            fileName = result.split('\\').pop() || result.split('/').pop() || '未知文件';
          } else if (result.filePath) {
            // 如果result是对象
            filePath = result.filePath;
            fileName = result.fileName || '未知文件';
          }

          if (filePath) {
            selectedFileName.value = fileName;
            showMessage(`已选择文件: ${fileName}`, 'success');

            // 调用Excel读取方法
            const res = await triggerEvent('adx-read-excel', {
              args: [filePath]
            });
            console.log('Excel读取返回:', res);

            // 存储Excel数据
            if (res && res.result && res.result.data) {
              console.log('Excel数据已存储，共', res.result.data.length, '行');
              showMessage(`Excel文件读取成功，共 ${res.result.data.length} 行数据`, 'success');
              excelData.value = res.result.data;
            } else {
              console.log('Excel读取失败或数据为空');
              showMessage('Excel文件读取失败或数据为空', 'warning');
              excelData.value = [];
            }
          } else {
            console.log('未获取到有效文件路径');
            showMessage('未获取到有效文件路径', 'error');
          }
        } else {
          console.log('未选择文件');
          showMessage('未选择文件', 'info');
        }
      } catch (error) {
        console.error('选择文件失败:', error);
        showMessage('选择文件失败: ' + error.message, 'error');
      } finally {
        isSelectingFile.value = false;
      }
    };

    const generateTemplate = async () => {
      try {
        console.log('开始生成配置模板...');

        // 1. 让用户选择文件夹路径
        const result = await invokeIpc('select-folder');
        console.log('选择的模板文件夹:', result);

        if (!result) {
          showMessage('未选择文件夹', 'info');
          return;
        }

        // 2. 创建固定的文件夹结构
        const folderStructure = ['警示语', '引导语', '标题', '角标', '引导尾帧'];

        // 角标文件夹下的子文件夹
        const badgeSubFolders = ['左上', '右上', '左下', '右下'];

        console.log('开始创建文件夹结构...');

        // 调用后端创建文件夹结构
        const createResult = await triggerEvent('create-template-folders', {
          args: [result, folderStructure, badgeSubFolders]
        });

        console.log('创建文件夹结果:', createResult);

        if (createResult && createResult.result && createResult.result.success) {
          // 3. 保存模板配置路径到全局变量（使用返回的配置文件夹路径）
          const configFolderPath = createResult.result.configFolderPath;
          templateConfigPath.value = configFolderPath;

          // 4. 同步更新设置中的配置文件路径（显示文件夹名称）
          selectedConfigFolderName.value = configFolderPath.split('\\').pop() || configFolderPath.split('/').pop() || '配置文件';

          showMessage(`配置模板生成成功！路径: ${configFolderPath}`, 'success');
          console.log('模板配置路径已保存:', templateConfigPath.value);
        } else {
          showMessage('创建文件夹失败: ' + (createResult?.result?.message || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('生成配置模板失败:', error);
        showMessage('生成配置模板失败: ' + error.message, 'error');
      }
    };

    // 选择下载文件夹
    const selectDownloadFolder = async () => {
      isSelectingDownloadFolder.value = true;
      try {
        console.log('开始选择下载文件夹...');
        const result = await invokeIpc('select-folder');
        console.log('选择的文件夹:', result);

        if (result) {
          selectedDownloadFolder.value = result;
          showMessage(`已选择下载文件夹: ${result}`, 'success');
        } else {
          console.log('未选择文件夹');
          showMessage('未选择文件夹', 'info');
        }
      } catch (error) {
        console.error('选择文件夹失败:', error);
        showMessage('选择文件夹失败: ' + error.message, 'error');
      } finally {
        isSelectingDownloadFolder.value = false;
      }
    };

    // 选择配置文件夹
    const selectConfigFolder = async () => {
      isSelectingConfigFolder.value = true;
      try {
        console.log('开始选择配置文件夹...');
        const result = await invokeIpc('select-folder');
        console.log('选择的配置文件夹:', result);

        if (result) {
          // 保存完整路径到模板配置路径
          templateConfigPath.value = result;
          // 显示文件夹名称
          selectedConfigFolderName.value = result.split('\\').pop() || result.split('/').pop() || '配置文件夹';
          showMessage(`已选择配置文件夹: ${result}`, 'success');
        } else {
          console.log('未选择配置文件夹');
          showMessage('未选择配置文件夹', 'info');
        }
      } catch (error) {
        console.error('选择配置文件夹失败:', error);
        showMessage('选择配置文件夹失败: ' + error.message, 'error');
      } finally {
        isSelectingConfigFolder.value = false;
      }
    };

    const toggleElements = () => {
      showElements.value = !showElements.value;
    };

    const insertVariable = (variable) => {
      console.log('插入变量:', variable);
      // TODO: 实现变量插入逻辑
    };

    // 保存设置
    const saveSettings = () => {
      console.log('保存设置:', {
        downloadFolder: selectedDownloadFolder.value,
        configFolder: selectedConfigFolderName.value
      });
      showMessage('设置已保存', 'success');
      showSettings.value = false;
    };

    const startProcessing = async () => {
      isProcessing.value = true;

      try {
        // 检查登录状态
        if (!isLoggedIn.value) {
          showMessage('请先登录当前平台', 'warning');
          return;
        }

        // 检查必要的数据
        if (!selectedDownloadFolder.value) {
          showMessage('请先选择下载文件夹', 'warning');
          return;
        }

        if (!excelData.value || excelData.value.length === 0) {
          showMessage('请先选择并读取Excel文件', 'warning');
          return;
        }

        console.log('开始处理任务，参数:', {
          selectedFolderPath: selectedDownloadFolder.value,
          dramaData: excelData.value,
          configFolder: selectedConfigFolderName.value
        });

        // 提取剧名数据 - 直接使用Excel返回的对象数组格式
        const dramaData = excelData.value
          .filter((item) => item.dramaName && item.dramaName.trim() !== '')
          .map((item) => ({
            dramaName: item.dramaName,
            count: item.count
          }));

        console.log('开始处理剧名数据:', dramaData);

        const safeExportConfig = JSON.parse(JSON.stringify(exportConfig.value));
        // 确保elementConfig被正确传递（使用深拷贝避免响应式对象问题）
        safeExportConfig.elementConfig = JSON.parse(JSON.stringify(elementConfig.value));
        // 添加配置文件路径
        safeExportConfig.configPath = templateConfigPath.value;
        const res = await triggerEvent('adx-start-processing', {
          args: [selectedDownloadFolder.value, dramaData, safeExportConfig]
        });

        console.log('处理完成:', res);

        if (res.success) {
          alert(`处理完成！成功处理 ${res.successCount} 个剧目，失败 ${res.failCount} 个`);
        } else {
          alert(`处理失败: ${res.message}`);
        }
      } catch (error) {
        console.error('处理任务失败:', error);
        showMessage('处理任务失败: ' + error.message, 'error');
      } finally {
        isProcessing.value = false;
      }
    };

    return {
      selectedPlatform,
      isLoggedIn,
      isLoggingIn,
      selectedFileName,
      isSelectingFile,
      showElements,
      splitCount,
      elementConfig,
      exportConfig,
      isProcessing,
      showSettings,
      selectedDownloadFolder,
      selectedConfigFolderName,
      isSelectingDownloadFolder,
      isSelectingConfigFolder,
      templateConfigPath,
      excelData,
      handleLogin,
      selectExcelFile,
      generateTemplate,
      selectDownloadFolder,
      selectConfigFolder,
      saveSettings,
      toggleElements,
      insertVariable,
      startProcessing
    };
  }
};

const app = createApp(App);
if (window.ElementPlus) app.use(window.ElementPlus);
app.mount('#app');
