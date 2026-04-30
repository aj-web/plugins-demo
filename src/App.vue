<template>
  <div id="app">
    <div v-if="checkingActivation" class="activation-shell">
      <div class="activation-panel compact">
        <div class="activation-title">正在检查激活状态</div>
        <div class="activation-subtitle">请稍候...</div>
      </div>
    </div>

    <div v-else-if="!activationStatus.activated" class="activation-shell">
      <div class="activation-panel">
        <div class="activation-header">
          <div>
            <div class="activation-eyebrow">软件激活</div>
            <h1>优创客户端体验版</h1>
          </div>
        </div>

        <p class="activation-copy">
          请输入激活码完成客户端激活。激活成功后，本机会保存用户 ID，后续启动无需重复激活。
        </p>

        <el-form @submit.prevent>
          <el-form-item>
            <el-input
              v-model="activationKey"
              size="large"
              placeholder="请输入激活码"
              clearable
              show-password
              :disabled="activating"
              @keyup.enter="handleActivate"
            />
          </el-form-item>

          <el-alert
            v-if="activationError"
            class="activation-error"
            :title="activationError"
            type="error"
            show-icon
            :closable="false"
          />

          <el-button
            class="activation-button"
            type="primary"
            size="large"
            :loading="activating"
            :disabled="!activationKey.trim()"
            @click="handleActivate"
          >
            激活并进入
          </el-button>
        </el-form>
      </div>
    </div>

    <router-view v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

interface ActivationStatus {
  activated: boolean
  userId: string
  clientId: number
  activatedAt?: string
}

const checkingActivation = ref(true)
const activating = ref(false)
const activationKey = ref('')
const activationError = ref('')
const activationStatus = ref<ActivationStatus>({
  activated: false,
  userId: '',
  clientId: 3
})

const loadActivationStatus = async () => {
  checkingActivation.value = true
  activationError.value = ''

  try {
    const result = await window.electronAPI?.getActivationStatus()
    if (result?.success && result.data) {
      activationStatus.value = result.data
    } else {
      activationStatus.value = { activated: false, userId: '', clientId: 3 }
    }
  } catch (error) {
    activationStatus.value = { activated: false, userId: '', clientId: 3 }
    activationError.value = error instanceof Error ? error.message : '读取激活状态失败'
  } finally {
    checkingActivation.value = false
  }
}

const handleActivate = async () => {
  const key = activationKey.value.trim()
  if (!key || activating.value) return

  activating.value = true
  activationError.value = ''

  try {
    const result = await window.electronAPI?.activateClient(key)
    if (result?.success && result.data?.activated) {
      activationStatus.value = result.data
      activationKey.value = ''
      ElMessage.success('激活成功')
      return
    }

    activationError.value = result?.message || result?.data?.message || '激活失败'
  } catch (error) {
    activationError.value = error instanceof Error ? error.message : '激活失败'
  } finally {
    activating.value = false
  }
}

onMounted(() => {
  loadActivationStatus()
})
</script>

<style>
#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.activation-shell {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(22, 35, 56, 0.96), rgba(30, 32, 38, 0.98)),
    #1a1a1a;
  color: #ffffff;
  padding: 24px;
}

.activation-panel {
  width: min(460px, 100%);
  background: #ffffff;
  color: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.activation-panel.compact {
  text-align: center;
}

.activation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.activation-eyebrow {
  font-size: 13px;
  line-height: 1.4;
  color: #409eff;
  font-weight: 600;
  margin-bottom: 8px;
}

.activation-header h1 {
  font-size: 24px;
  line-height: 1.3;
  margin: 0;
  font-weight: 700;
  color: #111827;
}

.activation-copy,
.activation-subtitle {
  font-size: 14px;
  line-height: 1.7;
  color: #6b7280;
  margin: 0 0 24px;
}

.activation-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
}

.activation-error {
  margin-bottom: 16px;
}

.activation-button {
  width: 100%;
}
</style> 
