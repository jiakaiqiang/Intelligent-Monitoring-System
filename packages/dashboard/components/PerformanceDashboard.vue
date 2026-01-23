<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PerformanceMetrics } from '@monitor/shared/types';

const metrics = ref<PerformanceMetrics[]>([]);
const avgMetrics = ref<Partial<PerformanceMetrics>>({});

onMounted(() => {
  fetch('/api/reports/demo-project')
    .then((res) => res.json())
    .then((data) => {
      const perfData = data.data
        .filter((r: any) => r.performance)
        .map((r: any) => r.performance);

      metrics.value = perfData;

      if (perfData.length > 0) {
        const avg = {
          fcp: perfData.reduce((sum: number, m: any) => sum + (m.fcp || 0), 0) / perfData.length,
          lcp: perfData.reduce((sum: number, m: any) => sum + (m.lcp || 0), 0) / perfData.length,
          fid: perfData.reduce((sum: number, m: any) => sum + (m.fid || 0), 0) / perfData.length,
          cls: perfData.reduce((sum: number, m: any) => sum + (m.cls || 0), 0) / perfData.length,
        };
        avgMetrics.value = avg;
      }
    });
});

interface MetricCardProps {
  title: string;
  value: number | undefined;
  unit: string;
  threshold: number;
}

const getStatus = (value: number | undefined, threshold: number) => {
  return value && value > threshold ? 'poor' : 'good';
};

const getColor = (status: string) => {
  return status === 'good' ? '#52c41a' : '#ff4d4f';
};
</script>

<template>
  <div :style="{ padding: '20px' }">
    <h2>Performance Metrics Dashboard</h2>
    <div
      :style="{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
      }"
    >
      <!-- FCP Card -->
      <div :style="{ border: '1px solid #d9d9d9', padding: '20px', borderRadius: '4px' }">
        <h3>FCP</h3>
        <div
          :style="{
            fontSize: '32px',
            color: getColor(getStatus(avgMetrics.fcp, 1800)),
            fontWeight: 'bold',
          }"
        >
          {{ avgMetrics.fcp ? `${avgMetrics.fcp.toFixed(0)}ms` : 'N/A' }}
        </div>
        <div :style="{ fontSize: '12px', color: '#8c8c8c' }">Threshold: 1800ms</div>
      </div>

      <!-- LCP Card -->
      <div :style="{ border: '1px solid #d9d9d9', padding: '20px', borderRadius: '4px' }">
        <h3>LCP</h3>
        <div
          :style="{
            fontSize: '32px',
            color: getColor(getStatus(avgMetrics.lcp, 2500)),
            fontWeight: 'bold',
          }"
        >
          {{ avgMetrics.lcp ? `${avgMetrics.lcp.toFixed(0)}ms` : 'N/A' }}
        </div>
        <div :style="{ fontSize: '12px', color: '#8c8c8c' }">Threshold: 2500ms</div>
      </div>

      <!-- FID Card -->
      <div :style="{ border: '1px solid #d9d9d9', padding: '20px', borderRadius: '4px' }">
        <h3>FID</h3>
        <div
          :style="{
            fontSize: '32px',
            color: getColor(getStatus(avgMetrics.fid, 100)),
            fontWeight: 'bold',
          }"
        >
          {{ avgMetrics.fid ? `${avgMetrics.fid.toFixed(0)}ms` : 'N/A' }}
        </div>
        <div :style="{ fontSize: '12px', color: '#8c8c8c' }">Threshold: 100ms</div>
      </div>

      <!-- CLS Card -->
      <div :style="{ border: '1px solid #d9d9d9', padding: '20px', borderRadius: '4px' }">
        <h3>CLS</h3>
        <div
          :style="{
            fontSize: '32px',
            color: getColor(getStatus(avgMetrics.cls, 0.1)),
            fontWeight: 'bold',
          }"
        >
          {{ avgMetrics.cls ? avgMetrics.cls.toFixed(3) : 'N/A' }}
        </div>
        <div :style="{ fontSize: '12px', color: '#8c8c8c' }">Threshold: 0.1</div>
      </div>
    </div>
    <div :style="{ marginTop: '40px' }">
      <h3>Recent Metrics ({{ metrics.length }} samples)</h3>
    </div>
  </div>
</template>
