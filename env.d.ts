/// <reference types="vite/client" />
 
export {}

declare module '*.vue' {
  const component: any
  export default component
}

// 解决 TS 将 .vue 模板按 JSX 校验导致的 7026 报错：
// 允许所有 JSX IntrinsicElements 为 any（仅用于类型检查，不影响运行）
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
} 