<template>
  <div class="plugin-view">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载插件...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <el-icon class="error-icon">
        <Warning />
      </el-icon>
      <h3>插件加载失败</h3>
      <p>{{ error }}</p>
      <el-button @click="reloadPlugin" type="primary">重试</el-button>
    </div>

    <div class="plugin-container" v-show="!loading && !error">
      <div id="plugin-container" ref="pluginContainer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElIcon, ElButton } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

const route = useRoute()
const pluginContainer = ref<HTMLElement>()
const loading = ref(true)
const error = ref('')
const currentPlugin = ref('')
let currentIframe: HTMLIFrameElement | null = null
let messageListener: ((event: MessageEvent) => void) | null = null

// 允许的通用IPC通道白名单
let IPC_ALLOWLIST = new Set<string>()

const setupMessageBridge = (pluginName: string, iframe: HTMLIFrameElement) => {
  teardownMessageBridge()
  messageListener = async (event: MessageEvent) => {
    const data = event.data || {}
    if (!data || data.source !== 'plugin-frontend' || !data.action) return

    try {
      if (data.action === 'trigger-event') {
        const { eventType, params } = data.payload || {}
        const result = await (window as any).electronAPI.triggerEvent(pluginName, eventType, params)
        iframe.contentWindow?.postMessage({ source: 'host', id: data.id, success: true, result }, '*')
      } else if (data.action === 'ipc-invoke') {
        const { channel, args = [] } = data.payload || {}
        if (!IPC_ALLOWLIST.has(channel)) {
          iframe.contentWindow?.postMessage({ source: 'host', id: data.id, success: false, error: 'Channel not allowed' }, '*')
          return
        }
        //进行参数展开invoke调用
        const result = await (window as any).electronAPI.invoke(channel, args)
        iframe.contentWindow?.postMessage({ source: 'host', id: data.id, success: true, result }, '*')
      }
    } catch (e: any) {
      iframe.contentWindow?.postMessage({ source: 'host', id: data.id, success: false, error: e?.message || String(e) }, '*')
    }
  }
  window.addEventListener('message', messageListener)
}

const teardownMessageBridge = () => {
  if (messageListener) {
    window.removeEventListener('message', messageListener)
    messageListener = null
  }
}

const loadPlugin = async (pluginName: string) => {
  console.log('[PluginView] loadPlugin called with pluginName:', pluginName)
  loading.value = true
  error.value = ''

  try {
    if (pluginContainer.value) {
      pluginContainer.value.innerHTML = ''
    }
    currentIframe = null

    // 拉取允许通道的最新配置
    try {
      const list: string[] = await (window as any).electronAPI.invoke('get-ipc-allowlist')
      IPC_ALLOWLIST = new Set(list || [])
    } catch { }

    const res = await (window as any).electronAPI.startPluginProcess(pluginName)
    if (!res?.success) {
      throw new Error(res?.error || '无法读取插件 manifest')
    }
    const manifest = res.manifest || {}
    const frontend = manifest.frontend || {}

    let src = ''
    if (process.env.NODE_ENV === 'development' && frontend.devServerUrl) {
      src = frontend.devServerUrl
    } else if (frontend.entry) {
      // 通过内置静态服务器使用 http 访问
      src = await (window as any).electronAPI.getPluginHttpUrl(pluginName, frontend.entry)
    } else {
      throw new Error('未配置插件前端入口(frontend)')
    }

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0'
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin')

    iframe.onload = () => {
      console.log('[PluginView] iframe loaded:', src)
      loading.value = false
      setupMessageBridge(pluginName, iframe)
    }
    iframe.onerror = (e) => {
      console.error('[PluginView] iframe load error:', e)
      error.value = '插件页面加载失败'
      loading.value = false
    }

    pluginContainer.value?.appendChild(iframe)
    currentIframe = iframe
  } catch (err) {
    console.error('[PluginView] loadPlugin failed:', err)
    error.value = err instanceof Error ? err.message : '未知错误'
    loading.value = false
  }
}

const reloadPlugin = () => {
  if (currentPlugin.value) {
    loadPlugin(currentPlugin.value)
  }
}

watch(() => route.params.name, (newPluginName) => {
  console.log('[PluginView] watch route.params.name changed to:', newPluginName)
  if (newPluginName && newPluginName !== currentPlugin.value) {
    currentPlugin.value = newPluginName as string
    loadPlugin(currentPlugin.value)
  }
}, { immediate: true })

onUnmounted(() => {
  teardownMessageBridge()
  if (pluginContainer.value) {
    pluginContainer.value.innerHTML = ''
  }
})
</script>

<style scoped>
.plugin-view {
  height: 100%;
  width: 100%;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.loading-container p {
  color: #888888;
  font-size: 14px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #3a3a3a;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  color: #f56c6c;
}

.error-container h3 {
  color: #ffffff;
  font-size: 18px;
  margin: 0;
}

.error-container p {
  color: #888888;
  font-size: 14px;
  margin: 0;
}

.plugin-container {
  height: 100%;
  width: 100%;
}

#plugin-container {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#plugin-container * {
  box-sizing: border-box;
}
</style>