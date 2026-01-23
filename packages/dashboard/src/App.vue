<script setup lang="ts">
import { ref } from 'vue';
import ErrorList from '../components/ErrorList.vue';
import PerformanceDashboard from '../components/PerformanceDashboard.vue';

type View = 'errors' | 'performance';

const currentView = ref<View>('errors');
</script>

<template>
  <div>
    <header :style="{ background: '#001529', color: 'white', padding: '20px' }">
      <h1 :style="{ margin: 0 }">Monitor Dashboard</h1>
    </header>

    <nav :style="{ background: '#f0f2f5', padding: '10px 20px', borderBottom: '1px solid #d9d9d9' }">
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

    <main>
      <ErrorList v-if="currentView === 'errors'" />
      <PerformanceDashboard v-if="currentView === 'performance'" />
    </main>
  </div>
</template>
