<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ErrorInfo, PerformanceMetrics } from '@monitor/shared/types';
import ErrorList from '../components/ErrorList.vue';
import FileTraceTree from '../components/FileTraceTree.vue';
import PerformanceDashboard from '../components/PerformanceDashboard.vue';

const API_BASE_URL = import.meta.env.VITE_MONITOR_API ?? 'http://localhost:3000';

type View = 'overview' | 'errors' | 'performance' | 'files';

interface TrackedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  reportId?: string;
  projectId?: string;
}

interface ReportRecord {
  id: string;
  projectId: string;
  errorLogs?: TrackedErrorInfo[] | null;
  performance?: PerformanceMetrics | null;
  processedData?: {
    mappedErrors?: TrackedErrorInfo[];
  } | null;
  createdAt?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  errorCount: number;
  fileCount: number;
  metricCount: number;
  latestAt: number;
}

type AiRequestPayload = {
  error: TrackedErrorInfo;
  index: number;
  projectId: string;
};

const currentView = ref<View>('overview');
const selectedProjectId = ref('default');
const projectSearch = ref('');
const loading = ref(false);
const loadError = ref<string | null>(null);
const reports = ref<ReportRecord[]>([]);
const performanceReports = ref<ReportRecord[]>([]);
const selectedTracePath = ref('');
const currentTime = ref(new Date());

const isAiDrawerOpen = ref(false);
const aiDrawerLoading = ref(false);
const aiDrawerContent = ref('');
const aiDrawerError = ref<string | null>(null);
const aiDrawerErrorInfo = ref<TrackedErrorInfo | null>(null);
const aiDrawerProjectId = ref('');
const aiAnalyzingIndex = ref<number | null>(null);
const aiAbortController = ref<AbortController | null>(null);

let clockTimer: number | undefined;

const normalizeTracePath = (value: string) => {
  return value
    .replace(/^webpack:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/');
};

const parseStackPath = (line: string) => {
  const chromeMatch = line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/);
  if (chromeMatch) return normalizeTracePath(chromeMatch[2]);

  const firefoxMatch = line.match(/^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/);
  if (firefoxMatch) return normalizeTracePath(firefoxMatch[2]);

  return '';
};

const getErrorTracePaths = (error: TrackedErrorInfo) => {
  const paths = new Set<string>();

  if (error.sourceFile) {
    paths.add(normalizeTracePath(error.sourceFile));
  }

  const stack = error.mappedStack || error.stack;
  stack?.split('\n').forEach((line) => {
    const path = parseStackPath(line);
    if (path) paths.add(path);
  });

  return [...paths];
};

const extractErrorsFromReport = (report: ReportRecord): TrackedErrorInfo[] => {
  const mappedErrors = report.processedData?.mappedErrors;
  const source = Array.isArray(mappedErrors) && mappedErrors.length > 0
    ? mappedErrors
    : report.errorLogs;

  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((error) => ({
    ...error,
    reportId: report.id,
    projectId: report.projectId,
  }));
};

const allErrors = computed(() =>
  reports.value.flatMap((report) => extractErrorsFromReport(report))
);

const projectErrors = computed(() =>
  allErrors.value
    .filter((error) => error.projectId === selectedProjectId.value)
    .sort((a, b) => b.timestamp - a.timestamp)
);

const projectMetrics = computed(() =>
  performanceReports.value
    .filter((report) => report.projectId === selectedProjectId.value && report.performance)
    .map((report) => report.performance as PerformanceMetrics)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
);

const projects = computed<ProjectSummary[]>(() => {
  const map = new Map<string, ProjectSummary>();

  const ensureProject = (id: string) => {
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: id,
        errorCount: 0,
        fileCount: 0,
        metricCount: 0,
        latestAt: 0,
      });
    }
    return map.get(id) as ProjectSummary;
  };

  reports.value.forEach((report) => {
    const project = ensureProject(report.projectId || 'default');
    const errors = extractErrorsFromReport(report);
    project.errorCount += errors.length;
    project.latestAt = Math.max(project.latestAt, Date.parse(report.createdAt || '') || 0);
  });

  performanceReports.value.forEach((report) => {
    const project = ensureProject(report.projectId || 'default');
    project.metricCount += report.performance ? 1 : 0;
    project.latestAt = Math.max(
      project.latestAt,
      Date.parse(report.createdAt || '') || report.performance?.timestamp || 0
    );
  });

  map.forEach((project) => {
    const files = allErrors.value
      .filter((error) => error.projectId === project.id)
      .flatMap((error) => getErrorTracePaths(error));
    project.fileCount = new Set(files).size;
  });

  return [...map.values()].sort((a, b) => b.latestAt - a.latestAt || a.id.localeCompare(b.id));
});

const filteredProjects = computed(() => {
  const keyword = projectSearch.value.trim().toLowerCase();
  if (!keyword) return projects.value;
  return projects.value.filter((project) => project.id.toLowerCase().includes(keyword));
});

const selectedProject = computed(() =>
  projects.value.find((project) => project.id === selectedProjectId.value) || {
    id: selectedProjectId.value,
    name: selectedProjectId.value,
    errorCount: 0,
    fileCount: 0,
    metricCount: 0,
    latestAt: 0,
  }
);

const latestErrors = computed(() => projectErrors.value.slice(0, 5));

const avgMetric = computed(() => {
  const metrics = projectMetrics.value;
  if (!metrics.length) {
    return {};
  }

  const average = (key: keyof PerformanceMetrics) =>
    metrics.reduce((sum, metric) => sum + Number(metric[key] || 0), 0) / metrics.length;

  return {
    fcp: average('fcp'),
    lcp: average('lcp'),
    fid: average('fid'),
    cls: average('cls'),
  };
});

const visibleTraceErrors = computed(() => {
  if (!selectedTracePath.value) return projectErrors.value;
  return projectErrors.value.filter((error) => getErrorTracePaths(error).includes(selectedTracePath.value));
});

const formattedTime = computed(() =>
  currentTime.value.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);

const formattedDate = computed(() =>
  currentTime.value.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
);

const aiDrawerTimestamp = computed(() => {
  if (!aiDrawerErrorInfo.value?.timestamp) return '';
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

const viewItems: Array<{ id: View; label: string; description: string }> = [
  { id: 'overview', label: '项目概览', description: '健康状态和最近异常' },
  { id: 'errors', label: '错误日志', description: '按类型查看异常事件' },
  { id: 'performance', label: '性能指标', description: 'Web Vitals 与采样' },
  { id: 'files', label: '异常文件', description: '按文件树追踪堆栈' },
];

const fetchJson = async (path: string) => {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} request failed`);
  }
  return response.json();
};

const loadDashboard = async () => {
  loading.value = true;
  loadError.value = null;

  try {
    const [reportPayload, performancePayload] = await Promise.all([
      fetchJson('/api/reports/default'),
      fetchJson('/api/reports/performance'),
    ]);

    reports.value = Array.isArray(reportPayload.data) ? reportPayload.data : [];
    performanceReports.value = Array.isArray(performancePayload.data) ? performancePayload.data : [];

    if (!projects.value.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = projects.value[0]?.id || 'default';
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    loadError.value = '数据加载失败，请确认后端服务已启动。';
    reports.value = [];
    performanceReports.value = [];
  } finally {
    loading.value = false;
  }
};

const selectProject = (projectId: string) => {
  selectedProjectId.value = projectId;
  selectedTracePath.value = '';
};

const formatNumber = (value: number | undefined, digits = 0) => {
  if (value === undefined || Number.isNaN(value)) return '--';
  return value.toFixed(digits);
};

const formatDateTime = (timestamp: number) => {
  if (!timestamp) return '暂无';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: payload.projectId,
        errors: [payload.error],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('AI analysis request failed');
    }

    await consumeAiResponse(response);
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return;
    console.error('AI analysis failed:', error);
    aiDrawerError.value = 'AI 分析失败，请检查 AI_API_KEY 或稍后重试。';
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
  segments.forEach((segment) => appendStreamChunk(segment));
  return pending;
};

const appendStreamChunk = (segment: string) => {
  const normalizedLines = segment
    .split('\n')
    .map((line) => line.replace(/^data:\s*/i, '').trim())
    .filter((line) => line && line !== '[DONE]');

  if (!normalizedLines.length) return;

  const normalized = normalizedLines.join('\n');
  aiDrawerContent.value = aiDrawerContent.value
    ? `${aiDrawerContent.value}\n${normalized}`
    : normalized;
};

const extractAiText = (payload: any) => {
  if (!payload) return 'AI 未返回分析结果。';
  if (typeof payload === 'string') return payload;
  return (
    payload.analysis ??
    payload.data?.analysis ??
    payload.message ??
    payload.choices?.[0]?.message?.content ??
    JSON.stringify(payload, null, 2)
  );
};

onMounted(() => {
  loadDashboard();
  window.addEventListener('keydown', handleEscKey);
  clockTimer = window.setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscKey);
  cancelAiStream();
  if (clockTimer) window.clearInterval(clockTimer);
});
</script>

<template>
  <div class="monitor-shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 18V6.8C4 5.8 4.8 5 5.8 5h12.4C19.2 5 20 5.8 20 6.8V18H4Z" stroke="currentColor" stroke-width="1.8" />
            <path d="M7 14l3-3 2.3 2.3L17 8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M3 19h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <div>
          <p class="brand__title">智能监控系统</p>
          <p class="brand__subtitle">Monitoring</p>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="项目视图">
        <button
          v-for="item in viewItems"
          :key="item.id"
          type="button"
          class="sidebar-nav__item"
          :class="{ 'sidebar-nav__item--active': currentView === item.id }"
          @click="currentView = item.id"
        >
          <span class="sidebar-nav__label">{{ item.label }}</span>
          <span class="sidebar-nav__desc">{{ item.description }}</span>
        </button>
      </nav>

      <section class="project-switcher">
        <div class="section-heading">
          <span>项目</span>
          <button type="button" class="icon-button" aria-label="刷新项目" @click="loadDashboard">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <path d="M20 5v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <label class="project-search">
          <span class="sr-only">搜索项目</span>
          <input v-model="projectSearch" type="search" placeholder="搜索项目 ID" />
        </label>
        <div class="project-list">
          <button
            v-for="project in filteredProjects"
            :key="project.id"
            type="button"
            class="project-item"
            :class="{ 'project-item--active': selectedProjectId === project.id }"
            @click="selectProject(project.id)"
          >
            <span class="project-item__name">{{ project.name }}</span>
            <span class="project-item__meta">
              {{ project.errorCount }} 错误 · {{ project.fileCount }} 文件
            </span>
          </button>
          <div v-if="!filteredProjects.length" class="project-empty">暂无项目数据</div>
        </div>
      </section>

      <div class="sidebar-status">
        <span class="status-dot"></span>
        <span>在线</span>
        <span class="sidebar-status__time">{{ formattedTime }}</span>
      </div>
    </aside>

    <main class="workspace">
      <header class="workspace-header">
        <div>
          <p class="workspace-header__eyebrow">项目 / {{ selectedProject.id }}</p>
          <h1>{{ selectedProject.name }}</h1>
          <p class="workspace-header__meta">
            {{ formattedDate }} · API {{ API_BASE_URL }}
          </p>
        </div>
        <div class="workspace-header__actions">
          <button type="button" class="ghost-button" :disabled="loading" @click="loadDashboard">
            {{ loading ? '刷新中' : '刷新数据' }}
          </button>
        </div>
      </header>

      <div v-if="loadError" class="notice notice--error">{{ loadError }}</div>

      <Transition name="fade" mode="out-in">
        <section v-if="currentView === 'overview'" key="overview" class="overview-grid">
          <div class="stat-card">
            <span class="stat-card__label">错误事件</span>
            <strong>{{ selectedProject.errorCount }}</strong>
            <span>当前项目最近采集的异常数量</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">异常文件</span>
            <strong>{{ selectedProject.fileCount }}</strong>
            <span>从 SourceMap 或堆栈提取的文件数</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">性能样本</span>
            <strong>{{ selectedProject.metricCount }}</strong>
            <span>该项目已上报的 Web Vitals 样本</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__label">平均 LCP</span>
            <strong>{{ formatNumber(avgMetric.lcp) }}<small>ms</small></strong>
            <span>最大内容绘制平均值</span>
          </div>

          <div class="overview-panel overview-panel--wide">
            <div class="panel-title">
              <h2>最近异常</h2>
              <button type="button" class="text-button" @click="currentView = 'errors'">查看全部</button>
            </div>
            <div v-if="latestErrors.length" class="compact-list">
              <button
                v-for="(error, index) in latestErrors"
                :key="`${error.reportId}-${index}`"
                type="button"
                class="compact-row"
                @click="currentView = 'errors'"
              >
                <span class="compact-row__type">{{ error.type }}</span>
                <span class="compact-row__message">{{ error.message }}</span>
                <span class="compact-row__time">{{ formatDateTime(error.timestamp) }}</span>
              </button>
            </div>
            <div v-else class="empty-inline">这个项目暂时没有错误事件。</div>
          </div>

          <div class="overview-panel">
            <div class="panel-title">
              <h2>性能快照</h2>
              <button type="button" class="text-button" @click="currentView = 'performance'">打开指标</button>
            </div>
            <dl class="metric-snapshot">
              <div>
                <dt>FCP</dt>
                <dd>{{ formatNumber(avgMetric.fcp) }}ms</dd>
              </div>
              <div>
                <dt>LCP</dt>
                <dd>{{ formatNumber(avgMetric.lcp) }}ms</dd>
              </div>
              <div>
                <dt>FID</dt>
                <dd>{{ formatNumber(avgMetric.fid) }}ms</dd>
              </div>
              <div>
                <dt>CLS</dt>
                <dd>{{ formatNumber(avgMetric.cls, 3) }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <ErrorList
          v-else-if="currentView === 'errors'"
          key="errors"
          :project-id="selectedProjectId"
          :errors="projectErrors"
          :loading="loading"
          :ai-analyzing-index="aiAnalyzingIndex"
          @refresh="loadDashboard"
          @request-ai-analysis="handleRequestAiAnalysis"
        />

        <PerformanceDashboard
          v-else-if="currentView === 'performance'"
          key="performance"
          :project-id="selectedProjectId"
          :metrics="projectMetrics"
          :loading="loading"
        />

        <section v-else key="files" class="file-view">
          <FileTraceTree
            :errors="projectErrors"
            :selected-path="selectedTracePath"
            @select-file="selectedTracePath = $event"
            @clear-selection="selectedTracePath = ''"
          />
          <ErrorList
            class="file-view__errors"
            :project-id="selectedProjectId"
            :errors="visibleTraceErrors"
            :loading="loading"
            :show-toolbar="false"
            :ai-analyzing-index="aiAnalyzingIndex"
            @refresh="loadDashboard"
            @request-ai-analysis="handleRequestAiAnalysis"
          />
        </section>
      </Transition>
    </main>

    <Transition name="ai-drawer">
      <div v-if="isAiDrawerOpen" class="ai-drawer">
        <button class="ai-drawer__mask" type="button" aria-label="关闭 AI 分析" @click="closeAiDrawer"></button>
        <aside class="ai-drawer__panel" aria-label="AI 分析面板">
          <header class="ai-drawer__header">
            <div>
              <p class="ai-drawer__eyebrow">AI 实时分析</p>
              <h2>{{ aiDrawerErrorInfo?.message || '未知错误' }}</h2>
              <p class="ai-drawer__meta-line">
                <span>{{ aiDrawerErrorInfo?.type?.toUpperCase() || 'N/A' }}</span>
                <span v-if="aiDrawerTimestamp">{{ aiDrawerTimestamp }}</span>
                <span>项目 {{ aiDrawerProjectId }}</span>
              </p>
            </div>
            <button class="ai-drawer__close" type="button" aria-label="关闭 AI 分析面板" @click="closeAiDrawer">
              关闭
            </button>
          </header>

          <div v-if="aiDrawerErrorInfo" class="ai-drawer__details">
            <div>
              <span>URL</span>
              <code>{{ aiDrawerErrorInfo.url }}</code>
            </div>
            <div v-if="aiDrawerErrorInfo.sourceFile">
              <span>Source</span>
              <code>
                {{ aiDrawerErrorInfo.sourceFile }}:{{ aiDrawerErrorInfo.sourceLine }}:{{ aiDrawerErrorInfo.sourceColumn }}
              </code>
            </div>
            <div v-if="aiDrawerErrorInfo.stack">
              <span>Stack</span>
              <pre>{{ aiDrawerErrorInfo.stack }}</pre>
            </div>
          </div>

          <section class="ai-drawer__stream">
            <div v-if="aiDrawerLoading && !aiDrawerContent" class="ai-drawer__loading">
              <span class="spinner"></span>
              <span>正在分析当前异常...</span>
            </div>
            <pre v-else-if="aiDrawerError" class="ai-drawer__output ai-drawer__output--error">{{ aiDrawerError }}</pre>
            <pre v-else class="ai-drawer__output">{{ aiDrawerContent }}</pre>
          </section>
        </aside>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.monitor-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  background: var(--nx-void);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 16px;
  background: var(--nx-surface);
  border-right: 1px solid var(--nx-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 12px;
}

.brand__mark {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: var(--radius-lg);
  color: var(--nx-cyan);
  background: var(--nx-cyan-glow);
  display: grid;
  place-items: center;
}

.brand__mark svg {
  width: 24px;
  height: 24px;
}

.brand__title {
  color: var(--nx-text-primary);
  font-weight: 800;
  line-height: 1.2;
}

.brand__subtitle {
  color: var(--nx-text-muted);
  font-size: 0.78rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-nav__item {
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--nx-text-secondary);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.sidebar-nav__item:hover,
.sidebar-nav__item--active {
  background: var(--nx-deep);
  border-color: var(--nx-border);
  color: var(--nx-text-primary);
}

.sidebar-nav__item--active {
  box-shadow: inset 3px 0 0 var(--nx-cyan);
}

.sidebar-nav__label {
  display: block;
  font-weight: 800;
}

.sidebar-nav__desc {
  display: block;
  margin-top: 2px;
  color: var(--nx-text-muted);
  font-size: 0.76rem;
}

.project-switcher {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--nx-text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
}

.icon-button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
  color: var(--nx-text-secondary);
  cursor: pointer;
}

.icon-button svg {
  width: 16px;
  height: 16px;
}

.project-search input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-deep);
  color: var(--nx-text-primary);
}

.project-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

.project-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--nx-text-secondary);
  text-align: left;
  cursor: pointer;
}

.project-item:hover,
.project-item--active {
  border-color: var(--nx-border);
  background: var(--nx-deep);
}

.project-item--active {
  color: var(--nx-cyan);
}

.project-item__name {
  color: inherit;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-item__meta,
.project-empty {
  color: var(--nx-text-muted);
  font-size: 0.76rem;
}

.sidebar-status {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-deep);
  color: var(--nx-text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.sidebar-status__time {
  color: var(--nx-text-primary);
  font-variant-numeric: tabular-nums;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--nx-green);
  box-shadow: 0 0 0 3px var(--nx-green-glow);
}

.workspace {
  min-width: 0;
  padding: 24px clamp(20px, 3vw, 36px);
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.workspace-header__eyebrow,
.workspace-header__meta {
  color: var(--nx-text-muted);
  font-size: 0.82rem;
}

.workspace-header h1 {
  margin: 2px 0;
  color: var(--nx-text-primary);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  word-break: break-word;
}

.workspace-header__actions {
  display: flex;
  gap: 8px;
}

.ghost-button,
.text-button {
  border: 1px solid var(--nx-border-strong);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
  color: var(--nx-text-secondary);
  cursor: pointer;
  font-weight: 800;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.ghost-button {
  height: 38px;
  padding: 0 14px;
}

.ghost-button:hover,
.text-button:hover {
  border-color: rgba(37, 99, 235, 0.28);
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.text-button {
  height: 32px;
  padding: 0 10px;
  border-color: transparent;
}

.notice {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--nx-border);
  background: var(--nx-surface);
}

.notice--error {
  color: var(--nx-red);
  background: var(--nx-red-glow);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card,
.overview-panel {
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--shadow-card);
}

.stat-card {
  min-height: 150px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.stat-card__label {
  color: var(--nx-text-secondary);
  font-size: 0.82rem;
  font-weight: 800;
}

.stat-card strong {
  color: var(--nx-text-primary);
  font-size: 2.1rem;
  line-height: 1;
}

.stat-card small {
  margin-left: 4px;
  color: var(--nx-text-muted);
  font-size: 0.95rem;
}

.stat-card span:last-child {
  color: var(--nx-text-muted);
  font-size: 0.82rem;
}

.overview-panel {
  padding: 18px;
}

.overview-panel--wide {
  grid-column: span 3;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title h2 {
  margin: 0;
  font-size: 1rem;
}

.compact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-row {
  width: 100%;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
  color: var(--nx-text-secondary);
  cursor: pointer;
  text-align: left;
}

.compact-row:hover {
  border-color: var(--nx-border-strong);
  background: var(--nx-deep);
}

.compact-row__type {
  color: var(--nx-cyan);
  font-weight: 800;
  text-transform: uppercase;
}

.compact-row__message {
  color: var(--nx-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-row__time {
  color: var(--nx-text-muted);
  font-size: 0.78rem;
}

.metric-snapshot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-snapshot div {
  padding: 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-deep);
}

.metric-snapshot dt {
  color: var(--nx-text-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.metric-snapshot dd {
  margin-top: 4px;
  color: var(--nx-text-primary);
  font-size: 1rem;
  font-weight: 800;
}

.empty-inline {
  padding: 32px 16px;
  border: 1px dashed var(--nx-border);
  border-radius: var(--radius-lg);
  color: var(--nx-text-muted);
  text-align: center;
}

.file-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-view__errors {
  margin-top: 0;
}

.ai-drawer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.ai-drawer__mask {
  flex: 1;
  border: 0;
  background: rgba(15, 23, 42, 0.36);
  cursor: pointer;
}

.ai-drawer__panel {
  width: min(620px, 100%);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  overflow: auto;
  border-left: 1px solid var(--nx-border);
  background: var(--nx-surface);
  box-shadow: -24px 0 48px rgba(15, 23, 42, 0.16);
}

.ai-drawer__header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.ai-drawer__eyebrow {
  color: var(--nx-text-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.ai-drawer__header h2 {
  margin: 4px 0;
  font-size: 1.1rem;
  word-break: break-word;
}

.ai-drawer__meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-drawer__meta-line span {
  padding: 3px 8px;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  background: var(--nx-deep);
  color: var(--nx-text-secondary);
  font-size: 0.76rem;
}

.ai-drawer__close {
  width: 54px;
  height: 34px;
  border: 1px solid var(--nx-border-strong);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
  color: var(--nx-text-secondary);
  cursor: pointer;
  font-weight: 800;
}

.ai-drawer__details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-deep);
}

.ai-drawer__details span {
  display: block;
  margin-bottom: 4px;
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.ai-drawer__details code,
.ai-drawer__details pre {
  color: var(--nx-text-primary);
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-drawer__details pre {
  max-height: 160px;
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-code-bg);
}

.ai-drawer__stream {
  min-height: 220px;
  padding: 16px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-code-bg);
}

.ai-drawer__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--nx-text-secondary);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--nx-cyan);
  border-top-color: transparent;
  border-radius: 999px;
  animation: spin 1s linear infinite;
}

.ai-drawer__output {
  color: var(--nx-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-drawer__output--error {
  color: var(--nx-red);
}

.fade-enter-active,
.fade-leave-active,
.ai-drawer-enter-active,
.ai-drawer-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.ai-drawer-enter-from,
.ai-drawer-leave-to {
  opacity: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1100px) {
  .monitor-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .sidebar-nav,
  .project-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-panel--wide {
    grid-column: span 2;
  }
}

@media (max-width: 700px) {
  .workspace {
    padding: 18px 14px;
  }

  .workspace-header {
    flex-direction: column;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-panel--wide {
    grid-column: auto;
  }

  .compact-row {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 12px;
  }
}
</style>
