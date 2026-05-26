<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';
import ErrorDrilldown from './ErrorDrilldown.vue';

interface TrackedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  reportId?: string;
  projectId?: string;
}

const props = withDefaults(
  defineProps<{
    projectId: string;
    errors: TrackedErrorInfo[];
    loading?: boolean;
    aiAnalyzingIndex?: number | null;
    showToolbar?: boolean;
  }>(),
  {
    loading: false,
    aiAnalyzingIndex: null,
    showToolbar: true,
  }
);

const emit = defineEmits<{
  (event: 'refresh'): void;
  (event: 'request-ai-analysis', payload: { error: TrackedErrorInfo; index: number; projectId: string }): void;
}>();

const selectedErrorIndex = ref<number | null>(null);
const selectedType = ref<'all' | 'js' | 'promise' | 'resource'>('all');

const errorTypes = [
  { value: 'all', label: '全部' },
  { value: 'js', label: 'JS 错误' },
  { value: 'promise', label: 'Promise' },
  { value: 'resource', label: '资源' },
] as const;

const filteredErrors = computed(() => {
  if (selectedType.value === 'all') return props.errors;
  return props.errors.filter((error) => error.type === selectedType.value);
});

const selectedError = computed(() => {
  if (selectedErrorIndex.value === null) return null;
  return filteredErrors.value[selectedErrorIndex.value] || null;
});

const typeCount = (type: string) => {
  if (type === 'all') return props.errors.length;
  return props.errors.filter((error) => error.type === type).length;
};

const selectType = (type: typeof selectedType.value) => {
  selectedType.value = type;
  selectedErrorIndex.value = null;
};

const selectError = (index: number) => {
  selectedErrorIndex.value = index;
};

const closeDetail = () => {
  selectedErrorIndex.value = null;
};

const requestAiAnalysis = (error: TrackedErrorInfo, index: number) => {
  emit('request-ai-analysis', {
    error,
    index,
    projectId: props.projectId,
  });
};

const isAnalyzingIndex = (index: number) => props.aiAnalyzingIndex === index;

const getTypeName = (type: string): string => {
  switch (type) {
    case 'js':
      return 'JS 错误';
    case 'promise':
      return 'Promise';
    case 'resource':
      return '资源';
    default:
      return type.toUpperCase();
  }
};

const formatErrorTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;

  if (diff >= 0 && diff < 60000) {
    return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
  }

  if (diff >= 0 && diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`;
  }

  if (diff >= 0 && diff < 86400000) {
    return `${Math.floor(diff / 3600000)} 小时前`;
  }

  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatSourceLocation = (error: TrackedErrorInfo) => {
  if (!error.sourceFile) return '';
  const line = error.sourceLine ? `:${error.sourceLine}` : '';
  const column = error.sourceColumn ? `:${error.sourceColumn}` : '';
  return `${error.sourceFile}${line}${column}`;
};

watch(
  () => props.projectId,
  () => {
    selectedErrorIndex.value = null;
    selectedType.value = 'all';
  }
);

watch(
  () => props.errors,
  () => {
    selectedErrorIndex.value = null;
  }
);
</script>

<template>
  <section class="error-list">
    <header class="panel-header">
      <div>
        <p class="panel-header__eyebrow">Errors</p>
        <h2>错误日志</h2>
      </div>
      <div class="panel-header__meta">
        <span>{{ filteredErrors.length }} 条错误</span>
        <span>项目 {{ projectId }}</span>
      </div>
    </header>

    <ErrorDrilldown
      v-if="selectedError"
      :error="selectedError"
      :project-id="projectId"
      :analyzing="isAnalyzingIndex(selectedErrorIndex ?? -1)"
      @back="closeDetail"
      @request-ai-analysis="requestAiAnalysis($event, selectedErrorIndex ?? 0)"
    />

    <div v-else-if="showToolbar" class="toolbar">
      <div class="filter-tabs" aria-label="错误类型筛选">
        <button
          v-for="type in errorTypes"
          :key="type.value"
          type="button"
          class="filter-tab"
          :class="{ 'filter-tab--active': selectedType === type.value }"
          @click="selectType(type.value)"
        >
          <span>{{ type.label }}</span>
          <span>{{ typeCount(type.value) }}</span>
        </button>
      </div>
      <button type="button" class="refresh-button" :disabled="loading" @click="emit('refresh')">
        {{ loading ? '刷新中' : '刷新' }}
      </button>
    </div>

    <div v-if="!selectedError && loading && errors.length === 0" class="state state--loading">
      <span class="spinner"></span>
      <span>正在加载错误数据...</span>
    </div>

    <div v-else-if="!selectedError && filteredErrors.length === 0" class="state">
      <strong>暂无错误事件</strong>
      <span>当前项目没有匹配的异常记录。</span>
    </div>

    <div v-else-if="!selectedError" class="error-stream">
      <article
        v-for="(error, index) in filteredErrors"
        :key="`${error.reportId || projectId}-${index}-${error.timestamp}`"
        class="error-card"
        :class="`error-card--${error.type}`"
      >
        <button
          type="button"
          class="error-card__summary"
          aria-label="查看错误详情"
          @click="selectError(index)"
        >
          <span class="type-badge" :class="`type-badge--${error.type}`">{{ getTypeName(error.type) }}</span>
          <span class="error-card__message">{{ error.message }}</span>
          <span class="error-card__source" :title="formatSourceLocation(error)">
            {{ formatSourceLocation(error) || error.url }}
          </span>
          <span class="error-card__time">{{ formatErrorTime(error.timestamp) }}</span>
          <span class="chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.error-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header,
.toolbar,
.error-card,
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

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tab,
.refresh-button,
.ai-button {
  border: 1px solid var(--nx-border-strong);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
  color: var(--nx-text-secondary);
  cursor: pointer;
  font-weight: 800;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.filter-tab {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}

.filter-tab span:last-child {
  color: var(--nx-text-muted);
  font-size: 0.76rem;
}

.filter-tab:hover,
.filter-tab--active,
.refresh-button:hover,
.ai-button:hover {
  border-color: rgba(37, 99, 235, 0.28);
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.refresh-button {
  height: 34px;
  padding: 0 12px;
}

.error-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-card {
  overflow: hidden;
  border-left-width: 4px;
}

.error-card--js {
  border-left-color: var(--nx-red);
}

.error-card--promise {
  border-left-color: var(--nx-orange);
}

.error-card--resource {
  border-left-color: var(--nx-yellow);
}

.error-card--expanded {
  box-shadow: var(--shadow-panel);
}

.error-card__summary {
  width: 100%;
  min-height: 64px;
  display: grid;
  grid-template-columns: 116px minmax(0, 1.1fr) minmax(160px, 0.9fr) auto 24px;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: var(--nx-text-secondary);
  cursor: pointer;
  text-align: left;
}

.error-card__summary:hover {
  background: #fbfdff;
}

.type-badge {
  justify-self: start;
  padding: 4px 9px;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
}

.type-badge--js {
  border-color: rgba(220, 38, 38, 0.18);
  background: var(--nx-red-glow);
  color: var(--nx-red);
}

.type-badge--promise {
  border-color: rgba(217, 119, 6, 0.2);
  background: var(--nx-orange-glow);
  color: var(--nx-orange);
}

.type-badge--resource {
  border-color: rgba(202, 138, 4, 0.2);
  background: rgba(202, 138, 4, 0.1);
  color: var(--nx-yellow);
}

.error-card__message {
  min-width: 0;
  overflow: hidden;
  color: var(--nx-text-primary);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-card__source,
.error-card__time {
  min-width: 0;
  overflow: hidden;
  color: var(--nx-text-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  width: 24px;
  height: 24px;
  color: var(--nx-text-muted);
  transition: transform var(--transition-fast);
}

.chevron svg {
  width: 100%;
  height: 100%;
}

.error-card--expanded .chevron {
  transform: rotate(180deg);
}

.error-card__body {
  padding: 16px;
  border-top: 1px solid var(--nx-border);
  background: #fbfdff;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-grid div,
.stack-block {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
}

.detail-label {
  display: block;
  margin-bottom: 6px;
  color: var(--nx-text-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

code,
pre {
  color: var(--nx-text-primary);
  font-size: 0.78rem;
  word-break: break-word;
}

pre {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
}

.stack-block {
  margin-top: 12px;
}

.error-card__actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.ai-button {
  min-width: 88px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
}

.ai-button:disabled,
.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.state {
  min-height: 260px;
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

.spinner--small {
  width: 14px;
  height: 14px;
}

@media (max-width: 980px) {
  .error-card__summary {
    grid-template-columns: 1fr auto;
  }

  .type-badge,
  .error-card__message,
  .error-card__source {
    grid-column: 1 / -1;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .panel-header,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-header__meta {
    justify-content: flex-start;
  }

  .refresh-button,
  .ai-button {
    width: 100%;
  }

  .error-card__actions {
    justify-content: stretch;
  }
}
</style>
