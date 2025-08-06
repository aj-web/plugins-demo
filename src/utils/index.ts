// 工具函数统一导出

/**
 * 格式化插件状态文本
 */
export function formatPluginStatus(status: string): string {
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

/**
 * 获取插件状态类型
 */
export function getPluginStatusType(status: string): string {
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

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
} 