<template>
  <div class="layout">
    <!-- 左侧边栏 -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <h2 class="sidebar-title" v-show="!sidebarCollapsed">插件管理</h2>
        <el-button
          class="toggle-btn"
          @click="toggleSidebar"
          circle
          size="small"
        >
          <el-icon>
            <ArrowRight v-if="sidebarCollapsed" />
            <ArrowLeft v-else />
          </el-icon>
        </el-button>
      </div>
      
      <div class="plugin-nav">
        <div class="nav-section">
          <div class="nav-section-title" v-show="!sidebarCollapsed">可用插件</div>
          <div
            v-for="plugin in plugins"
            :key="plugin.name"
            class="nav-item"
            :class="{ active: currentPlugin === plugin.name }"
            @click="selectPlugin(plugin.name)"
          >
            <el-icon class="nav-item-icon">
              <component :is="plugin.icon || 'Box'" />
            </el-icon>
            <span class="nav-item-text" v-show="!sidebarCollapsed">{{ plugin.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧主内容区域 -->
    <div class="main-content">
      <div class="content-body">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePluginStore } from '@/stores/plugin'
import { ElButton, ElIcon } from 'element-plus'

const router = useRouter()
const route = useRoute()
const pluginStore = usePluginStore()

const sidebarCollapsed = ref(false)
const currentPlugin = ref('')

const plugins = computed(() => pluginStore.plugins)

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const selectPlugin = (pluginName: string) => {
  currentPlugin.value = pluginName
  router.push(`/plugin/${pluginName}`)
}

onMounted(async () => {
  await pluginStore.loadPlugins()
})
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 280px;
  background: #2a2a2a;
  border-right: 1px solid #3a3a3a;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 60px;
  min-width: 60px;
}

/* 侧边栏头部 */
.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid #3a3a3a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .sidebar-title {
  display: none;
}

.toggle-btn {
  background: none;
  border: none;
  color: #ffffff;
  transition: background-color 0.2s ease;
}

.toggle-btn:hover {
  background: #3a3a3a;
}

/* 插件导航 */
.plugin-nav {
  flex: 1;
  padding: 16px 0;
  overflow: hidden;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section-title {
  padding: 0 16px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .nav-section-title {
  display: none;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  color: #cccccc;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;
  margin: 0 8px;
  white-space: nowrap;
}

.nav-item:hover {
  background: #3a3a3a;
  color: #ffffff;
}

.nav-item.active {
  background: #4a4a4a;
  color: #ffffff;
}

.nav-item-icon {
  width: 20px;
  height: 20px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar.collapsed .nav-item-icon {
  margin-right: 0;
}

.nav-item-text {
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .nav-item-text {
  display: none;
}

/* 右侧主内容区域 */
.main-content {
  flex: 1;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}



/* 内容区域 */
.content-body {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}
</style> 