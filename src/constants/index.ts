// 应用常量定义

/**
 * 插件状态枚举
 */
export enum PluginStatus {
  READY = 'ready',
  LOADING = 'loading',
  ERROR = 'error'
}

/**
 * 路由名称
 */
export enum RouteNames {
  HOME = 'home',
  PLUGIN = 'plugin'
}

/**
 * 路由路径
 */
export const ROUTES = {
  HOME: '/',
  PLUGIN: '/plugin/:name'
} as const

/**
 * 应用配置
 */
export const APP_CONFIG = {
  TITLE: '优创客户端体验版',
  VERSION: '0.3.0',
  DESCRIPTION: '插件化客户端应用'
} as const

/**
 * UI配置
 */
export const UI_CONFIG = {
  SIDEBAR_WIDTH: 280,
  SIDEBAR_COLLAPSED_WIDTH: 60,
  ANIMATION_DURATION: 300
} as const 