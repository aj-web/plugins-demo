import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Plugin {
  name: string
  status: 'ready' | 'loading' | 'error'
  icon?: string
  description?: string
}

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<Plugin[]>([])
  const loading = ref(false)

  const loadPlugins = async () => {
    loading.value = true
    try {
      // 调用主进程获取插件状态
      const pluginStatus = await window.electronAPI?.getPluginsStatus()
      plugins.value = pluginStatus || []
    } catch (error) {
      console.error('加载插件失败:', error)
      plugins.value = []
    } finally {
      loading.value = false
    }
  }

  const getPluginByName = (name: string) => {
    return plugins.value.find(plugin => plugin.name === name)
  }

  return {
    plugins,
    loading,
    loadPlugins,
    getPluginByName
  }
}) 