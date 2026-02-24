<script setup lang="ts">
import { ref, onMounted ,computed} from 'vue';
import type { PerformanceMetrics } from '@monitor/shared/types';

const metrics = ref<PerformanceMetrics[]>([]);
const avgMetrics = ref<Partial<PerformanceMetrics>>({});

onMounted(() => {
  fetch('http://10.173.26.56:3000/api/reports/performance')
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

interface MetricData {
  title: string;
  value: number | undefined;
  unit: string;
  threshold: number;
  description: string;
  icon: string;
  
}

const metricCards = computed((): MetricData[] => [
  {
    title: 'FCP',
    value: avgMetrics.value.fcp,
    unit: 'ms',
    threshold: 1800,
    description: '首次内容绘制 - 首次内容渲染时间',
    icon: '◈'
  },
  {
    title: 'LCP',
    value: avgMetrics.value.lcp,
    unit: 'ms',
    threshold: 2500,
    description: '最大内容绘制 - 主内容加载时间',
    icon: '◎'
  },
  {
    title: 'FID',
    value: avgMetrics.value.fid,
    unit: 'ms',
    threshold: 100,
    description: '首次输入延迟 - 响应用户交互时间',
    icon: '◐'
  },
  {
    title: 'CLS',
    value: avgMetrics.value.cls,
    unit: '',
    threshold: 0.1,
    description: '累积布局偏移 - 视觉稳定性评分',
    icon: '◯'
  }
]);

const getStatusText = (status: string) => {
  switch (status) {
    case 'good': return '良好';
    case 'warning': return '预警';
    case 'poor': return '较差';
    default: return '未知';
  }
};

const getStatus = (value: number | undefined, threshold: number): 'good' | 'warning' | 'poor' => {
  if (!value) return 'good';
  if (threshold < 1) {
    // CLS threshold logic
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'warning';
    return 'poor';
  }
  // Time-based thresholds with warning buffer
  const warningThreshold = threshold * 1.5;
  if (value <= threshold) return 'good';
  if (value <= warningThreshold) return 'warning';
  return 'poor';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'good': return 'var(--nx-green)';
    case 'warning': return 'var(--nx-orange)';
    case 'poor': return 'var(--nx-red)';
    default: return 'var(--nx-text-muted)';
  }
};

const getStatusGlow = (status: string) => {
  switch (status) {
    case 'good': return 'var(--nx-green-glow)';
    case 'warning': return 'var(--nx-orange-glow)';
    case 'poor': return 'var(--nx-red-glow)';
    default: return 'transparent';
  }
};
</script>

<template>
  <div class="performance-dashboard">
    <!-- Header Section -->
    <div class="panel-header">
      <div class="panel-header__title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="2"/>
          <path d="M12 7v10"/>
          <path d="M9 17a3 3 0 106 0"/>
          <path d="M6 12h12"/>
        </svg>
        <span>性能指标</span>
      </div>
      <div class="panel-header__meta">
        <span class="meta-item">{{ metrics.length }} 个样本</span>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="metrics-grid">
      <div
        v-for="(metric, index) in metricCards"
        :key="metric.title"
        class="metric-card"
        :class="`metric-card--${getStatus(metric.value, metric.threshold)}`"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <!-- Card Header -->
        <div class="metric-card__header">
          <div class="metric-icon">{{ metric.icon }}</div>
          <div class="metric-info">
            <span class="metric-title">{{ metric.title }}</span>
            <span class="metric-subtitle">{{ metric.description }}</span>
          </div>
        </div>

        <!-- Metric Value -->
        <div class="metric-value">
          <span class="metric-value__number">
            {{ metric.value !== undefined
              ? (metric.title === 'CLS'
                ? metric.value.toFixed(3)
                : `${metric.value.toFixed(0)}${metric.unit}`)
              : '--'
            }}
          </span>
          <div
            class="metric-status"
            :class="`metric-status--${getStatus(metric.value, metric.threshold)}`"
          >
            <span class="status-dot"></span>
            <span class="status-text">{{ getStatusText(getStatus(metric.value, metric.threshold)) }}</span>
          </div>
        </div>

        <!-- Threshold Indicator -->
        <div class="metric-threshold">
          <div class="threshold-label">阈值</div>
          <div class="threshold-progress">
            <div
              class="threshold-bar"
              :style="{
                width: `${Math.min((metric.value || 0) / (metric.threshold * 1.5) * 100, 100)}%`,
                backgroundColor: getStatusColor(getStatus(metric.value, metric.threshold))
              }"
            ></div>
          </div>
          <div class="threshold-value">{{ metric.threshold }}{{ metric.unit }}</div>
        </div>

        <!-- Decorative Elements -->
        <div class="metric-card__deco metric-card__deco--tl"></div>
        <div class="metric-card__deco metric-card__deco--tr"></div>
        <div class="metric-card__deco metric-card__deco--bl"></div>
        <div class="metric-card__deco metric-card__deco--br"></div>
      </div>
    </div>

    <!-- Summary Section -->
    <div class="summary-section">
      <div class="summary-header">
        <h3>分析摘要</h3>
        <div class="summary-divider"></div>
      </div>
      <div class="summary-content">
        <div class="summary-stat">
          <span class="summary-stat__label">数据点总数:</span>
          <span class="summary-stat__value">{{ metrics.length }}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__label">采集状态:</span>
          <span class="summary-stat__value status-active">活跃</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__label">最后更新:</span>
          <span class="summary-stat__value">{{ new Date().toLocaleTimeString('zh-CN') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   PERFORMANCE DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */

.performance-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  animation: fade-in-up 0.5s ease forwards;
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  position: relative;
  overflow: hidden;
}

.panel-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg, var(--nx-magenta), var(--nx-cyan));
}

.panel-header__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-display);
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-primary);
  font-weight: 600;
}

.panel-header__title svg {
  width: 20px;
  height: 20px;
  color: var(--nx-magenta);
}

.panel-header__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
}

.meta-item {
  padding: 2px 8px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

/* Metric Card */
.metric-card {
  position: relative;
  padding: var(--space-lg);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  animation: slide-in-left 0.5s ease forwards;
  opacity: 0;
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--nx-border);
  transition: all var(--transition-normal);
}

.metric-card:hover {
  border-color: var(--nx-cyan-dim);
  transform: translateY(-4px);
}

.metric-card:hover::before {
  background: var(--nx-cyan);
  box-shadow: 0 0 15px var(--nx-cyan);
  height: 3px;
}

/* Status variants */
.metric-card--good {
  border-color: rgba(0, 255, 136, 0.3);
}

.metric-card--good::before {
  background: var(--nx-green);
  box-shadow: 0 0 10px var(--nx-green-glow);
}

.metric-card--warning {
  border-color: rgba(255, 107, 53, 0.3);
}

.metric-card--warning::before {
  background: var(--nx-orange);
  box-shadow: 0 0 10px var(--nx-orange-glow);
}

.metric-card--poor {
  border-color: rgba(255, 51, 102, 0.3);
  animation: glitch 0.3s ease infinite;
}

.metric-card--poor::before {
  background: var(--nx-red);
  box-shadow: 0 0 10px var(--nx-red-glow);
}

/* Card Header */
.metric-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.metric-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--nx-text-secondary);
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  transition: all var(--transition-normal);
}

.metric-card:hover .metric-icon {
  color: var(--nx-cyan);
  border-color: var(--nx-cyan);
  box-shadow: 0 0 15px var(--nx-cyan-glow);
}

.metric-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.metric-title {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.2em;
  color: var(--nx-text-primary);
  font-weight: 600;
}

.metric-subtitle {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
  line-height: 1.3;
}

/* Metric Value */
.metric-value {
  padding: var(--space-md) 0;
  border-top: 1px solid var(--nx-border);
  border-bottom: 1px solid var(--nx-border);
}

.metric-value__number {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--nx-text-primary);
  display: block;
  letter-spacing: 0.1em;
}

.metric-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  font-weight: 600;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  animation: pulse-glow 2s ease-in-out infinite;
}

.metric-status--good .status-dot {
  background: var(--nx-green);
  box-shadow: 0 0 8px var(--nx-green);
}

.metric-status--good .status-text {
  color: var(--nx-green);
}

.metric-status--warning .status-dot {
  background: var(--nx-orange);
  box-shadow: 0 0 8px var(--nx-orange);
}

.metric-status--warning .status-text {
  color: var(--nx-orange);
}

.metric-status--poor .status-dot {
  background: var(--nx-red);
  box-shadow: 0 0 8px var(--nx-red);
  animation: pulse-glow 0.5s ease-in-out infinite;
}

.metric-status--poor .status-text {
  color: var(--nx-red);
}

/* Threshold */
.metric-threshold {
  margin-top: var(--space-md);
}

.threshold-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
  margin-bottom: var(--space-xs);
}

.threshold-progress {
  height: 4px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  position: relative;
  overflow: hidden;
}

.threshold-bar {
  height: 100%;
  transition: all var(--transition-normal);
  position: relative;
}

.threshold-bar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 2px;
  height: 100%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.threshold-value {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-secondary);
  margin-top: var(--space-xs);
}

/* Decorative Corner Elements */
.metric-card__deco {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid var(--nx-border);
  opacity: 0.5;
  transition: all var(--transition-normal);
}

.metric-card__deco--tl {
  top: 4px;
  left: 4px;
  border-right: none;
  border-bottom: none;
}

.metric-card__deco--tr {
  top: 4px;
  right: 4px;
  border-left: none;
  border-bottom: none;
}

.metric-card__deco--bl {
  bottom: 4px;
  left: 4px;
  border-right: none;
  border-top: none;
}

.metric-card__deco--br {
  bottom: 4px;
  right: 4px;
  border-left: none;
  border-top: none;
}

.metric-card:hover .metric-card__deco {
  opacity: 1;
  border-color: var(--nx-cyan);
}

/* Summary Section */
.summary-section {
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  padding: var(--space-lg);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
}

.summary-header h3 {
  font-family: var(--font-display);
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-primary);
  margin: 0;
}

.summary-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--nx-border), transparent);
}

.summary-content {
  display: flex;
  gap: var(--space-xl);
  flex-wrap: wrap;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.summary-stat__label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
  text-transform: uppercase;
}

.summary-stat__value {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-primary);
  font-weight: 500;
}

.summary-stat__value.status-active {
  color: var(--nx-green);
}

/* Responsive */
@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .summary-content {
    flex-direction: column;
    gap: var(--space-md);
  }
}
</style>
