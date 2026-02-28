<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';
import ErrorList from '../components/ErrorList.vue';
import PerformanceDashboard from '../components/PerformanceDashboard.vue';

const API_BASE_URL = import.meta.env.VITE_MONITOR_API ?? 'http://10.173.26.56:3000';

type View = 'errors' | 'performance';
type AiRequestPayload = {
  error: ErrorInfo;
  index: number;
  projectId: string;
};

const currentView = ref<View>('errors');
const currentTime = ref(new Date());
const systemStatus = ref('在线');

// Update time every second
onMounted(() => {
  setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
});

const isAiDrawerOpen = ref(false);
const aiDrawerLoading = ref(false);
const aiDrawerContent = ref('');
const aiDrawerError = ref<string | null>(null);
const aiDrawerErrorInfo = ref<ErrorInfo | null>(null);
const aiDrawerProjectId = ref('');
const aiAnalyzingIndex = ref<number | null>(null);
const aiAbortController = ref<AbortController | null>(null);

const aiDrawerTimestamp = computed(() => {
  if (!aiDrawerErrorInfo.value?.timestamp) {
    return '';
  }
  return new Date(aiDrawerErrorInfo.value.timestamp).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

const handleRequestAiAnalysis = (payload: AiRequestPayload) => {
  cancelAiStream();
  aiDrawerContent.value = '';
  aiDrawerError.value = null;
  aiDrawerErrorInfo.value = payload.error;
  aiDrawerProjectId.value = payload.projectId;
  aiAnalyzingIndex.value = payload.index;
  isAiDrawerOpen.value = true;
  startAiAnalysisStream(payload);
};

const closeAiDrawer = () => {
  cancelAiStream();
  isAiDrawerOpen.value = false;
  aiDrawerLoading.value = false;
  aiDrawerError.value = null;
  aiDrawerContent.value = '';
  aiDrawerErrorInfo.value = null;
  aiDrawerProjectId.value = '';
};

const cancelAiStream = () => {
  if (aiAbortController.value) {
    aiAbortController.value.abort();
    aiAbortController.value = null;
  }
  aiAnalyzingIndex.value = null;
};

const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isAiDrawerOpen.value) {
    closeAiDrawer();
  }
};

const startAiAnalysisStream = async (payload: AiRequestPayload) => {
  aiDrawerLoading.value = true;
  const controller = new AbortController();
  aiAbortController.value = controller;

  const body = JSON.stringify({
    projectId: payload.projectId,
    errors: [payload.error],
  });

  const request = (path: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

  try {
  
      let  response = await request('/api/ai/analyze');
    let data = await response.json();
   console.log(data,'response')
    if (!response.ok) {
      throw new Error('AI analysis request failed');
    }

    await consumeAiResponse(response);
  } catch (error) {
    console.log(error,'error')
    if ((error as DOMException)?.name === 'AbortError') {
      return;
    }
    console.error('AI analysis failed:', error);
    aiDrawerError.value = 'AI 分析失败，请稍后再试。';
  } finally {
    aiDrawerLoading.value = false;
    aiAbortController.value = null;
    aiAnalyzingIndex.value = null;

    if (!aiDrawerContent.value && !aiDrawerError.value) {
      aiDrawerContent.value = 'AI 未返回分析结果。';
    }
  }
};

const consumeAiResponse = async (response: Response) => {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    aiDrawerContent.value = extractAiText(payload);
    return;
  }

  if (!response.body) {
    const fallbackText = await response.text();
    aiDrawerContent.value = fallbackText.trim() || 'AI 未返回分析结果。';
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = flushStreamBuffer(buffer);
  }

  if (buffer.trim()) {
    appendStreamChunk(buffer);
  }
};

const flushStreamBuffer = (chunk: string) => {
  const segments = chunk.split('\n\n');
  const pending = segments.pop() ?? '';

  segments.forEach((segment) => {
    appendStreamChunk(segment);
  });

  return pending;
};

const appendStreamChunk = (segment: string) => {
  if (!segment) return;

  const normalizedLines = segment
    .split('\n')
    .map((line) => line.replace(/^data:\s*/i, '').trim())
    .filter((line) => line && line !== '[DONE]');

  if (!normalizedLines.length) {
    return;
  }

  const normalized = normalizedLines.join('\n');
  aiDrawerContent.value = aiDrawerContent.value
    ? `${aiDrawerContent.value}\n${normalized}`
    : normalized;
};

const extractAiText = (payload: any) => {
  if (!payload) {
    return 'AI 未返回分析结果。';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  return (
    payload.analysis ??
    payload.data?.analysis ??
    payload.message ??
    payload.choices?.[0]?.message?.content ??
    JSON.stringify(payload, null, 2)
  );
};

onMounted(() => {
  window.addEventListener('keydown', handleEscKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscKey);
  cancelAiStream();
});
</script>

<template>
  <div class="nx-app">
    <!-- Ambient glow effects -->
    <div class="nx-ambient-glow nx-ambient-glow--cyan"></div>
    <div class="nx-ambient-glow nx-ambient-glow--magenta"></div>

    <!-- Header -->
    <header class="nx-header">
      <div class="nx-header__left">
        <div class="nx-logo">
          <div class="nx-logo__icon">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 2L38 12V28L20 38L2 28V12L20 2Z" stroke="currentColor" stroke-width="2" />
              <path d="M20 8L32 15V25L20 32L8 25V15L20 8Z" fill="currentColor" opacity="0.3" />
              <circle cx="20" cy="20" r="4" fill="currentColor" />
            </svg>
          </div>
          <div class="nx-logo__text">
            <span class="nx-logo__title">神经枢纽</span>
            <span class="nx-logo__subtitle">监控系统</span>
          </div>
        </div>
      </div>

      <div class="nx-header__center">
        <nav class="nx-nav">
          <button
            class="nx-nav__item"
            :class="{ 'nx-nav__item--active': currentView === 'errors' }"
            @click="currentView = 'errors'"
          >
            <span class="nx-nav__icon">⚠</span>
            <span class="nx-nav__label">错误日志</span>
            <span class="nx-nav__indicator"></span>
          </button>
          <button
            class="nx-nav__item"
            :class="{ 'nx-nav__item--active': currentView === 'performance' }"
            @click="currentView = 'performance'"
          >
            <span class="nx-nav__icon">◈</span>
            <span class="nx-nav__label">性能指标</span>
            <span class="nx-nav__indicator"></span>
          </button>
        </nav>
      </div>

      <div class="nx-header__right">
        <div class="nx-status-panel">
          <div class="nx-status-panel__item">
            <span class="nx-status-panel__label">系统状态</span>
            <span class="nx-status-panel__value nx-status-panel__value--online">
              <span class="nx-pulse"></span>
              {{ systemStatus }}
            </span>
          </div>
          <div class="nx-status-panel__divider"></div>
          <div class="nx-status-panel__item">
            <span class="nx-status-panel__label">{{ formattedDate }}</span>
            <span class="nx-status-panel__value nx-status-panel__value--time">{{
              formattedTime
            }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="nx-main">
      <div class="nx-content">
        <Transition name="nx-fade" mode="out-in">
          <ErrorList
            v-if="currentView === 'errors'"
            key="errors"
            :ai-analyzing-index="aiAnalyzingIndex"
            @request-ai-analysis="handleRequestAiAnalysis"
          />
          <PerformanceDashboard v-else key="performance" />
        </Transition>
      </div>
    </main>

    <Transition name="ai-drawer">
      <div v-if="isAiDrawerOpen" class="ai-drawer">
        <div class="ai-drawer__mask" @click="closeAiDrawer"></div>
        <div class="ai-drawer__panel">
          <div class="ai-drawer__header">
            <div>
              <p class="ai-drawer__eyebrow">AI 实时分析</p>
              <p class="ai-drawer__title">{{ aiDrawerErrorInfo?.message || '未知错误' }}</p>
              <p class="ai-drawer__meta-line">
                <span>{{ aiDrawerErrorInfo?.type?.toUpperCase() || 'N/A' }}</span>
                <span v-if="aiDrawerTimestamp">· {{ aiDrawerTimestamp }}</span>
                <span v-if="aiDrawerProjectId">· 项目 {{ aiDrawerProjectId }}</span>
              </p>
            </div>
            <button class="ai-drawer__close" @click="closeAiDrawer">
              关闭
              <span>ESC</span>
            </button>
          </div>
          <div class="ai-drawer__details" v-if="aiDrawerErrorInfo">
            <div class="ai-drawer__detail">
              <span class="label">URL</span>
              <span class="value">{{ aiDrawerErrorInfo.url }}</span>
            </div>
            <div class="ai-drawer__detail" v-if="aiDrawerErrorInfo.userAgent">
              <span class="label">User Agent</span>
              <span class="value">{{ aiDrawerErrorInfo.userAgent }}</span>
            </div>
            <div class="ai-drawer__detail" v-if="aiDrawerErrorInfo.stack">
              <span class="label">Stack</span>
              <pre class="value value--code">{{ aiDrawerErrorInfo.stack }}</pre>
            </div>
          </div>
          <section class="ai-drawer__stream">
            <div v-if="aiDrawerLoading && !aiDrawerContent" class="ai-drawer__loading">
              <span class="ai-drawer__spinner"></span>
              <span>模型正在分析当前错误...</span>
            </div>
            <pre v-else-if="aiDrawerError" class="ai-drawer__output ai-drawer__output--error">
              {{ aiDrawerError }}
            </pre>
            <pre v-else class="ai-drawer__output">
              {{ aiDrawerContent }}
            </pre>
          </section>
        </div>
      </div>
    </Transition>

    <!-- Footer -->
    <footer class="nx-footer">
      <div class="nx-footer__left">
        <span class="nx-footer__text">神经枢纽监控 v2.0.0</span>
      </div>
      <div class="nx-footer__center">
        <div class="nx-data-stream">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="nx-footer__right">
        <span class="nx-footer__text">安全连接已建立</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.nx-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* Ambient Glow Effects */
.nx-ambient-glow {
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}

.nx-ambient-glow--cyan {
  background: var(--nx-cyan);
  top: -200px;
  left: -200px;
  animation: pulse-glow 8s ease-in-out infinite;
}

.nx-ambient-glow--magenta {
  background: var(--nx-magenta);
  bottom: -200px;
  right: -200px;
  animation: pulse-glow 8s ease-in-out infinite 4s;
}

/* Header */
.nx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: linear-gradient(180deg, var(--nx-surface) 0%, transparent 100%);
  border-bottom: 1px solid var(--nx-border);
  position: relative;
  z-index: 100;
}

.nx-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--nx-cyan), transparent);
  opacity: 0.5;
}

/* Logo */
.nx-logo {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.nx-logo__icon {
  width: 40px;
  height: 40px;
  color: var(--nx-cyan);
  animation: flicker 4s infinite;
}

.nx-logo__icon svg {
  width: 100%;
  height: 100%;
}

.nx-logo__text {
  display: flex;
  flex-direction: column;
}

.nx-logo__title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--nx-cyan);
  text-shadow: 0 0 20px var(--nx-cyan-glow);
}

.nx-logo__subtitle {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.3em;
  color: var(--nx-text-muted);
  margin-top: -2px;
}

/* Navigation */
.nx-nav {
  display: flex;
  gap: var(--space-sm);
}

.nx-nav__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: 1px solid var(--nx-border);
  color: var(--nx-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all var(--transition-normal);
}

.nx-nav__item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--nx-cyan-glow) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.nx-nav__item:hover {
  border-color: var(--nx-cyan-dim);
  color: var(--nx-text-primary);
}

.nx-nav__item:hover::before {
  opacity: 1;
}

.nx-nav__item--active {
  border-color: var(--nx-cyan);
  color: var(--nx-cyan);
  background: var(--nx-cyan-glow);
}

.nx-nav__item--active::before {
  opacity: 1;
}

.nx-nav__icon {
  font-size: 1rem;
}

.nx-nav__indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--nx-cyan);
  transition: width var(--transition-normal);
  box-shadow: 0 0 10px var(--nx-cyan);
}

.nx-nav__item--active .nx-nav__indicator {
  width: 80%;
}

/* Status Panel */
.nx-status-panel {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: var(--nx-elevated);
  border: 1px solid var(--nx-border);
}

.nx-status-panel__item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.nx-status-panel__label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
}

.nx-status-panel__value {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.nx-status-panel__value--online {
  color: var(--nx-green);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.nx-status-panel__value--time {
  color: var(--nx-cyan);
  font-variant-numeric: tabular-nums;
}

.nx-status-panel__divider {
  width: 1px;
  height: 30px;
  background: var(--nx-border);
}

.nx-pulse {
  width: 8px;
  height: 8px;
  background: var(--nx-green);
  border-radius: 50%;
  animation: pulse-glow 2s ease-in-out infinite;
  box-shadow: 0 0 10px var(--nx-green);
}

/* Main Content */
.nx-main {
  flex: 1;
  padding: var(--space-xl);
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.nx-content {
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Footer */
.nx-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: linear-gradient(0deg, var(--nx-surface) 0%, transparent 100%);
  border-top: 1px solid var(--nx-border);
  position: relative;
  z-index: 100;
}

.nx-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--nx-magenta), transparent);
  opacity: 0.3;
}

.nx-footer__text {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
}

.nx-data-stream {
  display: flex;
  gap: 3px;
}

.nx-data-stream span {
  width: 3px;
  height: 12px;
  background: var(--nx-cyan);
  opacity: 0.3;
  animation: data-stream-bar 1s ease-in-out infinite;
}

.nx-data-stream span:nth-child(1) {
  animation-delay: 0s;
}
.nx-data-stream span:nth-child(2) {
  animation-delay: 0.1s;
}
.nx-data-stream span:nth-child(3) {
  animation-delay: 0.2s;
}
.nx-data-stream span:nth-child(4) {
  animation-delay: 0.3s;
}
.nx-data-stream span:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes data-stream-bar {
  0%,
  100% {
    opacity: 0.3;
    transform: scaleY(0.5);
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* Transitions */
.nx-fade-enter-active,
.nx-fade-leave-active {
  transition: all 0.3s ease;
}

.nx-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.nx-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* AI Drawer */
.ai-drawer {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  z-index: 200;
}

.ai-drawer__mask {
  flex: 1;
  background: rgba(1, 3, 12, 0.6);
  backdrop-filter: blur(6px);
  pointer-events: auto;
}

.ai-drawer__panel {
  width: min(520px, 100%);
  background: var(--nx-surface);
  border-left: 1px solid var(--nx-border);
  box-shadow: -20px 0 40px rgba(0, 0, 0, 0.35);
  padding: var(--space-xl);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.ai-drawer__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-lg);
}

.ai-drawer__eyebrow {
  font-family: var(--font-mono);
  letter-spacing: 0.3em;
  font-size: 0.65rem;
  color: var(--nx-text-muted);
  margin-bottom: var(--space-xs);
}

.ai-drawer__title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--nx-text-primary);
  margin: 0 0 var(--space-xs);
}

.ai-drawer__meta-line {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--nx-text-secondary);
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.ai-drawer__close {
  border: 1px solid var(--nx-border);
  background: transparent;
  color: var(--nx-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ai-drawer__close span {
  padding: 2px 4px;
  border: 1px solid var(--nx-border);
  font-size: 0.6rem;
}

.ai-drawer__close:hover {
  border-color: var(--nx-cyan);
  color: var(--nx-cyan);
}

.ai-drawer__details {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--nx-deep);
  border: 1px solid var(--nx-border);
}

.ai-drawer__detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ai-drawer__detail .label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--nx-text-muted);
  text-transform: uppercase;
}

.ai-drawer__detail .value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--nx-text-primary);
  word-break: break-all;
}

.ai-drawer__detail .value--code {
  background: rgba(0, 0, 0, 0.4);
  padding: var(--space-sm);
  max-height: 120px;
  overflow-y: auto;
}

.ai-drawer__stream {
  min-height: 200px;
  border: 1px solid var(--nx-border);
  background: var(--nx-deep);
  padding: var(--space-lg);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--nx-text-secondary);
}

.ai-drawer__loading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--nx-text-secondary);
}

.ai-drawer__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--nx-cyan);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.ai-drawer__output {
  white-space: pre-wrap;
  overflow-y: auto;
  max-height: 360px;
  color: var(--nx-text-primary);
}

.ai-drawer__output--error {
  color: var(--nx-red);
}

.ai-drawer-enter-active,
.ai-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.ai-drawer-enter-from,
.ai-drawer-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .ai-drawer__panel {
    width: 100%;
    padding: var(--space-lg);
  }
}
</style>
