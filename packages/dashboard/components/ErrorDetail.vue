<script setup lang="ts">
import type { ErrorInfo } from '@monitor/shared/types';

interface Props {
  error: ErrorInfo;
  aiAnalysis?: string;
}

defineProps<Props>();
</script>

<template>
  <div :style="{ padding: '20px' }">
    <h2>Error Details</h2>

    <div :style="{ marginBottom: '20px' }">
      <h3>Type: {{ error.type }}</h3>
      <p><strong>Message:</strong> {{ error.message }}</p>
      <p><strong>Time:</strong> {{ new Date(error.timestamp).toLocaleString() }}</p>
      <p><strong>URL:</strong> {{ error.url }}</p>
    </div>

    <div v-if="error.stack" :style="{ marginBottom: '20px' }">
      <h3>Stack Trace</h3>
      <pre :style="{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }">{{ error.stack }}</pre>
    </div>

    <div
      v-if="aiAnalysis"
      :style="{ marginBottom: '20px', background: '#e8f4f8', padding: '15px' }"
    >
      <h3>AI Analysis</h3>
      <p>{{ aiAnalysis }}</p>
    </div>

    <div>
      <h3>User Agent</h3>
      <p>{{ error.userAgent }}</p>
    </div>
  </div>
</template>
