<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';
import ErrorDetail from './ErrorDetail.vue';
import ErrorItem from './ErrorItem.vue';

const errors = ref<ErrorInfo[]>([]);
const loading = ref(true);
const selectedError = ref<ErrorInfo | null>(null);

onMounted(() => {
  fetch('/api/reports/demo-project')
    .then((res) => res.json())
    .then((data) => {
      const allErrors = data.data
        .filter((r: any) => r.errors)
        .flatMap((r: any) => r.errors);
      errors.value = allErrors;
      loading.value = false;
    })
    .catch(() => {
      loading.value = false;
    });
});

const getErrorColor = (type: string) => {
  if (type === 'js') return '#ff4d4f';
  if (type === 'promise') return '#faad14';
  return '#1890ff';
};
</script>

<template>
  <div v-if="loading" :style="{ padding: '20px' }">Loading...</div>

  <div v-else-if="selectedError">
    <button
      @click="selectedError = null"
      :style="{ margin: '20px', padding: '8px 16px', cursor: 'pointer' }"
    >
      ← Back to List
    </button>
    <ErrorDetail :error="selectedError" />
  </div>

  <div v-else :style="{ padding: '20px' }">
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }">
      <h2>Error Reports ({{ errors.length }})</h2>

      <!-- 筛选器 -->
      <div :style="{ display: 'flex', gap: '10px' }">
        <select
          v-model="filterType"
          :style="{ padding: '6px', border: '1px solid #d9d9d9', borderRadius: '4px' }"
        >
          <option value="">All Types</option>
          <option value="js">JavaScript</option>
          <option value="promise">Promise</option>
          <option value="resource">Resource</option>
        </select>

        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search errors..."
          :style="{ padding: '6px', border: '1px solid #d9d9d9', borderRadius: '4px' }"
        />
      </div>
    </div>

    <!-- 错误列表 -->
    <div v-if="filteredErrors.length > 0">
      <ErrorItem
        v-for="error in filteredErrors"
        :key="error.message + error.timestamp"
        :error="error"
        @select-error="selectedError = error"
      />
    </div>

    <div v-else :style="{ textAlign: 'center', padding: '40px', color: '#999' }">
      <p>No errors found matching your criteria.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

// 筛选和搜索
const filterType = ref('');
const searchTerm = ref('');

// 计算筛选后的错误列表
const filteredErrors = computed(() => {
  return errors.value.filter(error => {
    const typeMatch = !filterType.value || error.type === filterType.value;
    const searchMatch = !searchTerm.value ||
      error.message.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (error.sourceFile && error.sourceFile.toLowerCase().includes(searchTerm.value.toLowerCase()));

    return typeMatch && searchMatch;
  });
});
</script>
