// Vite/Vue 单文件组件类型声明，保证在 TypeScript 中导入 .vue 文件时获得正确的组件类型。
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
