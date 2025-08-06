<template>
  <div class="home">
    <div class="welcome-page">
      <div class="welcome-icon">
        <el-icon size="60">
          <Box />
        </el-icon>
      </div>
      <h2 class="welcome-title">欢迎使用优创客户端</h2>
      <p class="welcome-subtitle">
        从左侧选择插件开始您的工作。每个插件都提供独特的功能，帮助您更高效地完成任务。
      </p>
      
      <div class="plugin-grid" v-if="plugins.length > 0">
        <div class="grid-title">可用插件</div>
        <div class="plugin-cards">
          <el-card
            v-for="plugin in plugins"
            :key="plugin.name"
            class="plugin-card"
            @click="selectPlugin(plugin.name)"
          >
            <div class="plugin-card-content">
              <el-icon class="plugin-icon">
                <component :is="plugin.icon || 'Box'" />
              </el-icon>
              <div class="plugin-info">
                <h3 class="plugin-name">{{ plugin.name }}</h3>
                <p class="plugin-description">{{ plugin.description || '暂无描述' }}</p>
              </div>
              <el-tag :type="getStatusType(plugin.status)" size="small">
                {{ getStatusText(plugin.status) }}
              </el-tag>
            </div>
          </el-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePluginStore } from '@/stores/plugin'
import { ElCard, ElIcon, ElTag } from 'element-plus'
import { Box } from '@element-plus/icons-vue'

const router = useRouter()
const pluginStore = usePluginStore()

const plugins = computed(() => pluginStore.plugins)

const selectPlugin = (pluginName: string) => {
  console.log('[Home] selectPlugin called with pluginName:', pluginName)
  console.log('[Home] selectPlugin navigating to:', `/plugin/${pluginName}`)
  router.push(`/plugin/${pluginName}`)
}

const getStatusType = (status: string) => {
  switch (status) {
    case 'ready':
      return 'success'
    case 'loading':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'ready':
      return '就绪'
    case 'loading':
      return '加载中'
    case 'error':
      return '错误'
    default:
      return '未知'
  }
}
</script>

<style scoped>
.home {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  max-width: 800px;
}

.welcome-icon {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
  color: #ffffff;
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16px;
}

.welcome-subtitle {
  font-size: 18px;
  color: #888888;
  max-width: 500px;
  line-height: 1.6;
  margin-bottom: 40px;
}

.plugin-grid {
  width: 100%;
  margin-top: 40px;
}

.grid-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 20px;
  text-align: left;
}

.plugin-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.plugin-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
}

.plugin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.plugin-card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.plugin-icon {
  width: 40px;
  height: 40px;
  color: #409eff;
  flex-shrink: 0;
}

.plugin-info {
  flex: 1;
  text-align: left;
}

.plugin-name {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.plugin-description {
  font-size: 14px;
  color: #888888;
  margin: 0;
}
</style> 