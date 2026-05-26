<script setup lang="ts">
import { computed } from 'vue';
import type { PerformanceMetrics } from '@monitor/shared/types';

const props = withDefaults(
  defineProps<{
    projectId: string;
    metrics: PerformanceMetrics[];
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

interface MetricCard {
  key: keyof PerformanceMetrics;
  title: string;
  value: number | undefined;
  unit: string;
  threshold: number;
  warning: number;
  description: string;
}

const average = (key: keyof PerformanceMetrics) => {
  if (!props.metrics.length) return undefined;
  return props.metrics.reduce((sum, metric) => sum + Number(metric[key] || 0), 0) / props.metrics.length;
};

const metricCards = computed<MetricCard[]>(() => [
  {
    key: 'fcp',
    title: 'FCP',
    value: average('fcp'),
    unit: 'ms',
    threshold: 1800,
    warning: 3000,
    description: '首次内容绘制',
  },
  {
    key: 'lcp',
    title: 'LCP',
    value: average('lcp'),
    unit: 'ms',
    threshold: 2500,
    warning: 4000,
    description: '最大内容绘制',
  },
  {
    key: 'fid',
    title: 'FID',
    value: average('fid'),
    unit: 'ms',
    threshold: 100,
    warning: 300,
    description: '首次输入延迟',
  },
  {
    key: 'cls',
    title: 'CLS',
    value: average('cls'),
    unit: '',
    threshold: 0.1,
    warning: 0.25,
    description: '累计布局偏移',
  },
]);

const latestMetric = computed(() => props.metrics[0]);

const getStatus = (metric: MetricCard): 'good' | 'warning' | 'poor' => {
  if (metric.value === undefined) return 'good';
  if (metric.value <= metric.threshold) return 'good';
  if (metric.value <= metric.warning) return 'warning';
  return 'poor';
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'good':
      return '良好';
    case 'warning':
      return '需关注';
    case 'poor':
      return '较差';
    default:
      return '未知';
  }
};

const formatValue = (metric: MetricCard) => {
  if (metric.value === undefined || Number.isNaN(metric.value)) return '--';
  if (metric.key === 'cls') return metric.value.toFixed(3);
  return `${metric.value.toFixed(0)}${metric.unit}`;
};

const progressWidth = (metric: MetricCard) => {
  if (metric.value === undefined) return '0%';
  return `${Math.min((metric.value / metric.warning) * 100, 100)}%`;
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '暂无';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <section class="performance-dashboard">
    <header class="panel-header">
      <div>
        <p class="panel-header__eyebrow">Performance</p>
        <h2>性能指标</h2>
      </div>
      <div class="panel-header__meta">
        <span>{{ metrics.length }} 个样本</span>
        <span>项目 {{ projectId }}</span>
      </div>
    </header>

    <div v-if="loading && metrics.length === 0" class="state state--loading">
      <span class="spinner"></span>
      <span>正在加载性能数据...</span>
    </div>

    <div v-else-if="metrics.length === 0" class="state">
      <strong>暂无性能样本</strong>
      <span>当前项目还没有上报 FCP、LCP、FID 或 CLS。</span>
    </div>

    <template v-else>
      <div class="metrics-grid">
        <article
          v-for="metric in metricCards"
          :key="metric.title"
          class="metric-card"
          :class="`metric-card--${getStatus(metric)}`"
        >
          <div class="metric-card__top">
            <div>
              <h3>{{ metric.title }}</h3>
              <p>{{ metric.description }}</p>
            </div>
            <span class="status-pill" :class="`status-pill--${getStatus(metric)}`">
              {{ getStatusText(getStatus(metric)) }}
            </span>
          </div>
          <strong class="metric-value">{{ formatValue(metric) }}</strong>
          <div class="threshold">
            <div class="threshold__track">
              <span class="threshold__bar" :style="{ width: progressWidth(metric) }"></span>
            </div>
            <div class="threshold__meta">
              <span>良好阈值 {{ metric.threshold }}{{ metric.unit }}</span>
              <span>警戒 {{ metric.warning }}{{ metric.unit }}</span>
            </div>
          </div>
        </article>
      </div>

      <section class="summary-panel">
        <div>
          <h3>采集摘要</h3>
          <p>最近一次上报：{{ formatTime(latestMetric?.timestamp) }}</p>
        </div>
        <dl>
          <div>
            <dt>样本数</dt>
            <dd>{{ metrics.length }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>活跃</dd>
          </div>
          <div>
            <dt>项目</dt>
            <dd>{{ projectId }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.performance-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header,
.metric-card,
.summary-panel,
.state {
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--shadow-card);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.panel-header__eyebrow {
  margin: 0 0 4px;
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.08rem;
}

.panel-header__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.panel-header__meta span {
  padding: 4px 10px;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  background: var(--nx-deep);
  color: var(--nx-text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  border-top-width: 4px;
}

.metric-card--good {
  border-top-color: var(--nx-green);
}

.metric-card--warning {
  border-top-color: var(--nx-orange);
}

.metric-card--poor {
  border-top-color: var(--nx-red);
}

.metric-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.metric-card h3 {
  margin: 0;
  color: var(--nx-text-primary);
  font-size: 1rem;
}

.metric-card p {
  margin-top: 4px;
  color: var(--nx-text-muted);
  font-size: 0.82rem;
}

.status-pill {
  height: 26px;
  flex: 0 0 auto;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
}

.status-pill--good {
  background: var(--nx-green-glow);
  color: var(--nx-green);
}

.status-pill--warning {
  background: var(--nx-orange-glow);
  color: var(--nx-orange);
}

.status-pill--poor {
  background: var(--nx-red-glow);
  color: var(--nx-red);
}

.metric-value {
  color: var(--nx-text-primary);
  font-size: clamp(2rem, 4vw, 2.5rem);
  line-height: 1;
}

.threshold {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.threshold__track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--nx-deep);
}

.threshold__bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--nx-cyan);
}

.threshold__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--nx-text-muted);
  font-size: 0.72rem;
}

.summary-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
}

.summary-panel h3 {
  margin: 0;
  font-size: 1rem;
}

.summary-panel p {
  margin-top: 4px;
  color: var(--nx-text-muted);
}

.summary-panel dl {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.summary-panel dl div {
  min-width: 120px;
  padding: 10px 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-deep);
}

.summary-panel dt {
  color: var(--nx-text-muted);
  font-size: 0.74rem;
  font-weight: 800;
}

.summary-panel dd {
  margin-top: 2px;
  color: var(--nx-text-primary);
  font-weight: 800;
}

.state {
  min-height: 300px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  padding: 24px;
  color: var(--nx-text-muted);
  text-align: center;
}

.state strong {
  color: var(--nx-text-primary);
}

.state--loading {
  display: flex;
  flex-direction: column;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--nx-cyan);
  border-top-color: transparent;
  border-radius: 999px;
  animation: spin 1s linear infinite;
}

@media (max-width: 1180px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .panel-header,
  .summary-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-header__meta {
    justify-content: flex-start;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .summary-panel dl {
    flex-direction: column;
  }
}
</style>
