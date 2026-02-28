<template>
  <div class="error-list-container">
    <!-- 顶部状态栏 -->
    <div class="panel-header">
      <div class="panel-header__title">
        <span class="status-indicator"></span>
        <span>错误日志流</span>
      </div>
      <div class="panel-header__meta">
        <span class="meta-item">{{ filteredErrors.length }} 条错误</span>
        <span class="meta-divider">|</span>
        <span class="meta-item">{{ getTypeLabel(selectedType) }}</span>
      </div>
    </div>

    <!-- 筛选控制面板 -->
    <div class="control-panel">
      <div class="filter-group">
        <label class="control-label">项目ID</label>
        <input
          v-model="projectId"
          class="tech-input"
          placeholder="请输入项目ID..."
          @keyup.enter="fetchErrors"
        />
      </div>
      <div class="filter-group">
        <label class="control-label">类型筛选</label>
        <div class="filter-chips">
          <button
            v-for="type in errorTypes"
            :key="type.value"
            class="chip-btn"
            :class="{ 'chip-btn--active': selectedType === type.value }"
            @click="filterByType(type.value)"
          >
            {{ type.label }}
          </button>
        </div>
      </div>
      <div class="action-group">
        <button class="tech-btn tech-btn--primary" @click="fetchErrors" :disabled="loading">
          <span class="btn-icon" v-if="loading"></span>
          <span>查询</span>
        </button>
        <button class="tech-btn tech-btn--secondary" @click="refreshErrors" :disabled="loading">
          <span>重置</span>
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && errors.length === 0" class="loading-state">
      <div class="loading-ring"></div>
      <span class="loading-text">正在加载...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="filteredErrors.length === 0" class="empty-state">
      <div class="empty-icon">⬡</div>
      <span class="empty-text">暂无错误数据</span>
      <span class="empty-sub">开始监控以捕获错误</span>
    </div>

    <!-- 错误列表 -->
    
      <div  v-else style="height:490px;overflow: auto;">
       <div  class="error-stream">
         <div

        v-for="(error, index) in filteredErrors"
        :key="index"
        class="error-card"
        :class="{
          'error-card--expanded': activeError === index,
          [`error-card--${error.type}`]: true,
        }"
        @click="toggleError(index)"
      >
        <!-- 错误头部（始终可见） -->
        <div class="error-card__header">
          <div class="error-meta">
            <div class="error-type-badge" :class="`type-${error.type}`">
              <span class="badge-icon">{{ getTypeIcon(error.type) }}</span>
              <span>{{ getTypeName(error.type) }}</span>
            </div>
            <div class="error-version" v-if="error.version">v{{ error.version }}</div>
          </div>
          <div class="error-message">
            {{ error.message }}
          </div>
          <div class="error-timestamp">
            {{ formatErrorTime(error.timestamp) }}
          </div>
          <div class="error-actions">
            <button
              class="ai-analysis-btn"
              :disabled="isAnalyzingIndex(index)"
              @click.stop="handleAiAnalysis(error, index)"
            >
              <span v-if="isAnalyzingIndex(index)" class="ai-analysis-btn__spinner"></span>
              <span v-else>AI 分析</span>
            </button>
          </div>
          <div class="error-expand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <!-- 错误详情（展开时显示） -->
        <div v-if="activeError === index" class="error-card__body">
          <div class="detail-section">
            <div class="detail-label">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 1v14M1 8h14" />
              </svg>
              网址
            </div>
            <div class="detail-value url-value">{{ error.url }}</div>
          </div>

          <div class="detail-section">
            <div class="detail-label">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 4h8v8a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
              用户代理
            </div>
            <div class="detail-value">{{ error.userAgent }}</div>
          </div>

          <div v-if="error.stack" class="detail-section detail-section--stack">
            <div class="detail-label">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 4v10h12M4 6l2 2 2-2" />
                <path d="M4 10l2 2 2-2" />
              </svg>
              堆栈跟踪
            </div>
            <pre class="code-block stack-trace">{{ error.stack }}</pre>
          </div>
        </div>
      </div>
      </div>
     
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';
let showScroll =  ref(null)


const props = withDefaults(
  defineProps<{
    aiAnalyzingIndex?: number | null;
  }>(),
  {
    aiAnalyzingIndex: null,
  }
);

const emit = defineEmits<{
  (e: 'request-ai-analysis', payload: { error: ErrorInfo; index: number; projectId: string }): void;
}>();

const API_BASE_URL = import.meta.env.VITE_MONITOR_API ?? 'http://10.173.26.56:3000';
const projectId = ref('default');
const errors = ref<ErrorInfo[]>([]);
const loading = ref(false);
const activeError = ref<number | null>(null);
const selectedType = ref<string>('all');
const aiAnalyzingIndex = computed(() => props.aiAnalyzingIndex ?? null);

const errorTypes = [
  { value: 'all', label: '全部' },
  { value: 'js', label: 'JS错误' },
  { value: 'promise', label: 'Promise' },
  { value: 'resource', label: '资源' },
];

const filteredErrors = computed(() => {
  if (selectedType.value === 'all') {
    return errors.value;
  }
  return errors.value.filter((e) => e.type === selectedType.value);
});

const fetchErrors = async () => {
  if (!projectId.value) return;

  loading.value = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports/${projectId.value}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    // 从返回数据中提取所有错误
    const allErrors: ErrorInfo[] = [];
    if (Array.isArray(result.data)) {
      result.data.forEach((report: any) => {
        if (report.errorLogs && Array.isArray(report.errorLogs)) {
          allErrors.push(...report.errorLogs);
        }
      });
    }

    // 按时间倒序排列
    errors.value = allErrors.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('获取异常数据失败:', err);
    errors.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshErrors = () => {
  fetchErrors();
};

const filterByType = (type: string) => {
  selectedType.value = type;
};

const toggleError = (index: number) => {
  activeError.value = activeError.value === index ? null : index;
};

const handleAiAnalysis = (error: ErrorInfo, index: number) => {
  emit('request-ai-analysis', {
    error,
    index,
    projectId: projectId.value,
  });
};

const isAnalyzingIndex = (index: number) => aiAnalyzingIndex.value === index;

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'js':
      return '';
    case 'promise':
      return '◇';
    case 'resource':
      return '◉';
    default:
      return '●';
  }
};

const getTypeName = (type: string): string => {
  switch (type) {
    case 'js':
      return 'JS错误';
    case 'promise':
      return 'Promise';
    case 'resource':
      return '资源';
    default:
      return type.toUpperCase();
  }
};

const getTypeLabel = (type: string): string => {
  const found = errorTypes.find((t) => t.value === type);
  return found ? found.label : type.toUpperCase();
};

const formatErrorTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // 如果在1分钟内
  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000);
    return `${seconds}秒前`;
  }

  // 如果在1小时内
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 如果在24小时内
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 否则显示日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

onMounted(() => {
  fetchErrors();
 
});
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   ERROR LIST CONTAINER
   ═══════════════════════════════════════════════════════════════════════════ */

.error-list-container {
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
  background: linear-gradient(180deg, var(--nx-cyan), var(--nx-magenta));
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

.status-indicator {
  width: 6px;
  height: 6px;
  background: var(--nx-green);
  border-radius: 1px;
  animation: pulse-glow 2s ease-in-out infinite;
  box-shadow: 0 0 8px var(--nx-green);
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

.meta-divider {
  color: var(--nx-text-muted);
  opacity: 0.5;
}

/* Control Panel */
.control-panel {
  display: flex;
  align-items: flex-end;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  flex-wrap: wrap;
}

.filter-group,
.action-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.control-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
  text-transform: uppercase;
}

.tech-input {
  width: 240px;
  padding: 8px 12px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  color: var(--nx-text-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  outline: none;
  transition: all var(--transition-fast);
}

.tech-input::placeholder {
  color: var(--nx-text-muted);
  opacity: 0.5;
}

.tech-input:focus {
  border-color: var(--nx-cyan);
  box-shadow: 0 0 0 2px var(--nx-cyan-glow);
}

/* Filter Chips */
.filter-chips {
  display: flex;
  gap: var(--space-xs);
}

.chip-btn {
  padding: 6px 12px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  color: var(--nx-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.chip-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--nx-cyan-glow), transparent);
  transition: left 0.5s ease;
}

.chip-btn:hover::before {
  left: 100%;
}

.chip-btn:hover {
  border-color: var(--nx-cyan-dim);
  color: var(--nx-text-primary);
}

.chip-btn--active {
  background: var(--nx-cyan);
  border-color: var(--nx-cyan);
  color: var(--nx-void);
  box-shadow: 0 0 12px var(--nx-cyan-glow);
}

/* Tech Buttons */
.tech-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: 0 var(--space-lg);
  height: 38px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  color: var(--nx-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  gap: var(--space-sm);
}

.tech-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.tech-btn:hover:not(:disabled) {
  border-color: var(--nx-cyan);
  color: var(--nx-cyan);
  box-shadow: 0 0 12px var(--nx-cyan-glow);
}

.tech-btn:hover:not(:disabled)::after {
  border-color: var(--nx-cyan-dim);
  inset: 4px;
}

.tech-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tech-btn--primary {
  color: var(--nx-cyan);
  border-color: var(--nx-cyan);
}

.tech-btn--primary:hover:not(:disabled) {
  background: var(--nx-cyan);
  color: var(--nx-void);
}

.tech-btn--secondary {
  color: var(--nx-text-secondary);
}

.btn-icon {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
  gap: var(--space-md);
  flex: 1;
  min-height: 0;
}

.loading-ring {
  width: 48px;
  height: 48px;
  border: 2px solid var(--nx-border);
  border-top-color: var(--nx-cyan);
  border-right-color: var(--nx-cyan);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px var(--nx-cyan-glow);
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: var(--nx-text-secondary);
  animation: flicker 3s infinite;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
  gap: var(--space-sm);
  background: var(--nx-surface);
  border: 1px dashed var(--nx-border);
  flex: 1;
  min-height: 0;
}

.empty-icon {
  font-size: 3rem;
  color: var(--nx-border);
  animation: pulse-glow 4s ease-in-out infinite;
}

.empty-text {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-secondary);
}

.empty-sub {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
}

/* Error Stream */
.error-stream {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);

}

/* Error Card */
.error-card {
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  
}

.error-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 100%;
  background: var(--nx-border);
  transition: background var(--transition-normal);
}

.error-card:hover {
  border-color: var(--nx-cyan-dim);
  transform: translateX(4px);
}

.error-card:hover::before {
  background: var(--nx-cyan);
}

.error-card--expanded {
  border-color: var(--nx-cyan);
  box-shadow: 0 0 20px var(--nx-cyan-glow);
}

.error-card--expanded::before {
  background: var(--nx-cyan);
}

/* Type-specific colors */
.error-card--js::before {
  background: var(--nx-red);
}

.error-card--js:hover::before,
.error-card--js.error-card--expanded::before {
  background: var(--nx-cyan);
}

.error-card--js .error-type-badge {
  background: rgba(255, 51, 102, 0.15);
  border-color: rgba(255, 51, 102, 0.3);
  color: var(--nx-red);
}

.error-card--promise::before {
  background: var(--nx-orange);
}

.error-card--promise .error-type-badge {
  background: rgba(255, 107, 53, 0.15);
  border-color: rgba(255, 107, 53, 0.3);
  color: var(--nx-orange);
}

.error-card--resource::before {
  background: var(--nx-yellow);
}

.error-card--resource .error-type-badge {
  background: rgba(255, 204, 0, 0.15);
  border-color: rgba(255, 204, 0, 0.3);
  color: var(--nx-yellow);
}

/* Error Card Header */
.error-card__header {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  min-height: 56px;
}

.error-actions {
  display: flex;
  justify-content: flex-end;
}

.ai-analysis-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--nx-border);
  color: var(--nx-cyan);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ai-analysis-btn:hover:not(:disabled) {
  border-color: var(--nx-cyan);
  box-shadow: 0 0 10px var(--nx-cyan-glow);
}

.ai-analysis-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-analysis-btn__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.error-type-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  font-weight: 500;
}

.badge-icon {
  font-size: 0.7rem;
}

.error-version {
  padding: 2px 6px;
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
}

.error-message {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--nx-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-timestamp {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-muted);
}

.error-expand {
  width: 24px;
  height: 24px;
  color: var(--nx-text-muted);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.error-expand svg {
  width: 100%;
  height: 100%;
}

.error-card--expanded .error-expand {
  color: var(--nx-cyan);
  transform: rotate(180deg);
}

/* Error Card Body */
.error-card__body {
  padding: 0 var(--space-lg) var(--space-md);
  border-top: 1px solid var(--nx-border);
  animation: slide-down 0.3s ease;
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-section {
  margin-top: var(--space-md);
}

.detail-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
  margin-bottom: var(--space-xs);
}

.detail-label svg {
  width: 14px;
  height: 14px;
  color: var(--nx-cyan);
}

.detail-value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--nx-text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.url-value {
  color: var(--nx-cyan);
  opacity: 0.8;
}

.detail-section--stack {
  margin-top: var(--space-lg);
}

.code-block {
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
  padding: var(--space-md);
  overflow-x: auto;
  font-size: 0.7rem;
  line-height: 1.6;
  color: var(--nx-text-secondary);
}

.stack-trace {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Responsive */
@media (max-width: 1024px) {
  .control-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .tech-input {
    width: 100%;
  }

  .error-card__header {
    grid-template-columns: auto 1fr;
    gap: var(--space-sm);
  }

  .error-timestamp,
  .error-expand {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
