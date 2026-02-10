<script setup lang="ts">
import { ref } from 'vue';
import ErrorList from '../components/ErrorList.vue';
import PerformanceDashboard from '../components/PerformanceDashboard.vue';

/**
 * 视图类型：`errors` 展示错误列表，`performance` 展示性能大盘。
 * 通过组合式 API 的 ref 保存当前选项，以便模板层联动切换。
 */
type View = 'errors' | 'performance';

// 当前展示的面板，默认打开错误视图，按钮点击时会更新该值。
const currentView = ref<View>('errors');
</script>

<template>
  <div>
    <!-- 顶部标题区，使用深色背景与白色字体形成视觉焦点 -->
    <header :style="{ background: '#001529', color: 'white', padding: '20px' }">
      <h1 :style="{ margin: 0 }">Monitor Dashboard</h1>
    </header>

    <!-- 导航按钮：根据 currentView 高亮选中状态 -->
    <nav
      :style="{ background: '#f0f2f5', padding: '10px 20px', borderBottom: '1px solid #d9d9d9' }"
    >
      <button
        @click="currentView = 'errors'"
        :style="{
          marginRight: '10px',
          padding: '8px 16px',
          background: currentView === 'errors' ? '#1890ff' : 'white',
          color: currentView === 'errors' ? 'white' : 'black',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          cursor: 'pointer',
        }"
      >
        Errors
      </button>
      <button
        @click="currentView = 'performance'"
        :style="{
          padding: '8px 16px',
          background: currentView === 'performance' ? '#1890ff' : 'white',
          color: currentView === 'performance' ? 'white' : 'black',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          cursor: 'pointer',
        }"
      >
        Performance
      </button>
    </nav>

    <!-- 主内容区域：通过 v-if 控制子组件渲染，避免不必要的数据请求 -->
    <main>
      <ErrorList v-if="currentView === 'errors'" />
      <PerformanceDashboard v-if="currentView === 'performance'" />
    </main>
  </div>
</template>
