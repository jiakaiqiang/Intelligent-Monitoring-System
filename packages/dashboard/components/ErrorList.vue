<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';
import ErrorDetail from './ErrorDetail.vue';

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
    <h2>Error Reports ({{ errors.length }})</h2>
    <table :style="{ width: '100%', borderCollapse: 'collapse' }">
      <thead>
        <tr :style="{ background: '#f0f2f5' }">
          <th :style="{ padding: '12px', textAlign: 'left', border: '1px solid #d9d9d9' }">Type</th>
          <th :style="{ padding: '12px', textAlign: 'left', border: '1px solid #d9d9d9' }">Message</th>
          <th :style="{ padding: '12px', textAlign: 'left', border: '1px solid #d9d9d9' }">Time</th>
          <th :style="{ padding: '12px', textAlign: 'left', border: '1px solid #d9d9d9' }">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(error, idx) in errors"
          :key="idx"
          :style="{ borderBottom: '1px solid #d9d9d9' }"
        >
          <td :style="{ padding: '12px', border: '1px solid #d9d9d9' }">
            <span
              :style="{
                padding: '4px 8px',
                background: getErrorColor(error.type),
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
              }"
            >
              {{ error.type }}
            </span>
          </td>
          <td :style="{ padding: '12px', border: '1px solid #d9d9d9' }">
            {{ error.message.substring(0, 100) }}
            {{ error.message.length > 100 ? '...' : '' }}
          </td>
          <td :style="{ padding: '12px', border: '1px solid #d9d9d9' }">
            {{ new Date(error.timestamp).toLocaleString() }}
          </td>
          <td :style="{ padding: '12px', border: '1px solid #d9d9d9' }">
            <button
              @click="selectedError = error"
              :style="{
                padding: '4px 12px',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }"
            >
              View Details
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
