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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElIcon, ElButton } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'

const route = useRoute()
const pluginContainer = ref<HTMLElement>()
const loading = ref(true)
const error = ref('')
const currentPlugin = ref('')

// 样式隔离工具类
class StyleIsolator {
  private pluginName: string
  private styleElement: HTMLStyleElement | null = null
  private isolatedStyles = new Set()

  constructor(pluginName: string) {
    this.pluginName = pluginName
  }

  cleanup() {
    if (this.styleElement) {
      this.styleElement.remove()
      this.styleElement = null
    }
    this.isolatedStyles.clear()
  }

  createStyleElement() {
    this.styleElement = document.createElement('style')
    this.styleElement.setAttribute('data-plugin', this.pluginName)
    this.styleElement.setAttribute('data-isolated', 'true')
    document.head.appendChild(this.styleElement)
    return this.styleElement
  }

  isolateStyles(cssText: string): string {
    if (!cssText || typeof cssText !== 'string') return ''
    
    try {
      const tempStyle = document.createElement('style')
      tempStyle.textContent = cssText
      document.head.appendChild(tempStyle)
      
      const rules = Array.from(tempStyle.sheet?.cssRules || [])
      document.head.removeChild(tempStyle)
      
      const isolatedRules = rules.map(rule => {
        if (rule instanceof CSSStyleRule) {
          return this.isolateSelector(rule.selectorText, rule.cssText)
        } else if (rule instanceof CSSMediaRule) {
          return this.isolateMediaRule(rule)
        } else {
          return rule.cssText
        }
      })
      
      return isolatedRules.join('\n')
    } catch (err) {
      console.warn(`[StyleIsolator] Failed to isolate styles for plugin ${this.pluginName}:`, err)
      return cssText
    }
  }

  private isolateSelector(selector: string, cssText: string): string {
    const isolatedSelector = selector.split(',').map(sel => {
      const trimmed = sel.trim()
      if (trimmed.startsWith('#')) {
        return `#plugin-container ${trimmed}`
      }
      return `#plugin-container ${trimmed}`
    }).join(', ')
    
    return cssText.replace(selector, isolatedSelector)
  }

  private isolateMediaRule(mediaRule: CSSMediaRule): string {
    const mediaText = mediaRule.conditionText
    const rules = Array.from(mediaRule.cssRules).map(rule => {
      if (rule instanceof CSSStyleRule) {
        return this.isolateSelector(rule.selectorText, rule.cssText)
      }
      return rule.cssText
    })
    
    return `@media ${mediaText} {\n${rules.join('\n')}\n}`
  }

  async loadIsolatedCSS(cssPath: string): Promise<void> {
    try {
      const response = await fetch(cssPath, {
        // 添加超时和错误处理选项
        signal: AbortSignal.timeout(2000)
      })
      if (!response.ok) {
        console.log(`[StyleIsolator] CSS file not found: ${cssPath}`)
        return
      }
      const cssText = await response.text()
      const isolatedCSS = this.isolateStyles(cssText)
      
      if (this.styleElement) {
        this.styleElement.textContent = isolatedCSS
      }
    } catch (err) {
      // 静默处理文件不存在的情况，不显示错误
      console.log(`[StyleIsolator] CSS file not accessible: ${cssPath}`)
    }
  }

  processInlineStyles(container: HTMLElement) {
    const styleElements = container.querySelectorAll('style')
    styleElements.forEach(style => {
      const cssText = style.textContent || ''
      const isolatedCSS = this.isolateStyles(cssText)
      style.textContent = isolatedCSS
    })
  }

  processStyleTags(container: HTMLElement) {
    const linkElements = container.querySelectorAll('link[rel="stylesheet"]')
    linkElements.forEach(link => {
      const href = link.getAttribute('href')
      if (href) {
        this.loadIsolatedCSS(href)
      }
    })
  }
}

const loadPlugin = async (pluginName: string) => {
  console.log('[PluginView] loadPlugin called with pluginName:', pluginName)
  
  // 等待 DOM 渲染完成
  await nextTick()
  
  if (!pluginContainer.value) {
    console.error('[PluginView] loadPlugin pluginContainer is null, waiting for DOM...')
    // 如果还是 null，再等待一下
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!pluginContainer.value) {
      console.error('[PluginView] loadPlugin pluginContainer is still null after waiting')
      return
    }
  }
  
  loading.value = true
  error.value = ''
  
  try {
    console.log('[PluginView] loadPlugin cleaning previous plugin content')
    // 清理之前的插件内容
    pluginContainer.value.innerHTML = ''
    
    console.log('[PluginView] loadPlugin getting plugin resource path')
    // 获取插件资源路径
    const resourcePath = await window.electronAPI?.getPluginResourcePath(pluginName)
    console.log('[PluginView] loadPlugin resourcePath:', resourcePath)
    
    if (!resourcePath) {
      throw new Error('无法获取插件资源路径')
    }
    
    const htmlPath = `${resourcePath}/frontend/index.html`
    const jsPath = `${resourcePath}/frontend/main.js`
    const cssPath = `${resourcePath}/frontend/style.css`
    
    console.log('[PluginView] loadPlugin file paths:', { htmlPath, jsPath, cssPath })
    
    // 创建样式隔离器
    const styleIsolator = new StyleIsolator(pluginName)
    
    console.log('[PluginView] loadPlugin loading HTML from:', htmlPath)
    // 加载插件HTML
    const response = await fetch(htmlPath)
    if (!response.ok) {
      throw new Error(`无法加载插件HTML: ${response.statusText}`)
    }
    
    const htmlText = await response.text()
    console.log('[PluginView] loadPlugin HTML loaded, length:', htmlText.length)
    
    // 创建临时容器来解析HTML
    const tempContainer = document.createElement('div')
    tempContainer.innerHTML = htmlText
    
    console.log('[PluginView] loadPlugin processing styles')
    // 处理样式隔离
    styleIsolator.processInlineStyles(tempContainer)
    styleIsolator.processStyleTags(tempContainer)
    
    console.log('[PluginView] loadPlugin loading CSS from:', cssPath)
    // 检查CSS文件是否存在，如果存在才加载
    try {
      // 通过 Electron API 检查文件是否存在
      const cssExists = await window.electronAPI?.checkFileExists(cssPath)
      if (cssExists) {
        await styleIsolator.loadIsolatedCSS(cssPath)
      } else {
        console.log('[PluginView] loadPlugin CSS file not found, skipping:', cssPath)
      }
    } catch (err) {
      // 静默处理文件不存在的情况，不显示错误
      console.log('[PluginView] loadPlugin CSS file not accessible, skipping:', cssPath)
    }
    
    console.log('[PluginView] loadPlugin inserting HTML into container')
    // 将处理后的HTML插入到插件容器
    pluginContainer.value.innerHTML = tempContainer.innerHTML
    
    console.log('[PluginView] loadPlugin loading JavaScript from:', jsPath)
    // 加载JavaScript
    const script = document.createElement('script')
    script.src = jsPath
    script.onload = () => {
      console.log(`[PluginView] loadPlugin plugin ${pluginName} loaded successfully`)
      loading.value = false
    }
    script.onerror = (error) => {
      console.error('[PluginView] loadPlugin JavaScript load error:', error)
      throw new Error('插件JavaScript加载失败')
    }
    
    pluginContainer.value.appendChild(script)
    console.log('[PluginView] loadPlugin script element appended to container')
    
  } catch (err) {
    console.error(`[PluginView] loadPlugin plugin ${pluginName} load failed:`, err)
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
    console.log('[PluginView] watch loading new plugin:', newPluginName)
    currentPlugin.value = newPluginName as string
    loadPlugin(currentPlugin.value)
  }
}, { immediate: true })

onMounted(() => {
  console.log('[PluginView] onMounted called')
  console.log('[PluginView] onMounted route.params.name:', route.params.name)
  if (route.params.name) {
    console.log('[PluginView] onMounted loading plugin:', route.params.name)
    currentPlugin.value = route.params.name as string
    loadPlugin(currentPlugin.value)
  }
})

onUnmounted(() => {
  // 清理插件资源
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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