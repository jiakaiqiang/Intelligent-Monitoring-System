<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';

const API_BASE_URL = import.meta.env.VITE_MONITOR_API ?? 'http://localhost:3000';

interface TrackedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  reportId?: string;
  projectId?: string;
}

interface StackFrame {
  id: string;
  index: number;
  functionName: string;
  file: string;
  line?: number;
  column?: number;
  raw: string;
  primary: boolean;
}

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file';
  depth: number;
  count: number;
  children: Map<string, FileNode>;
  frames: StackFrame[];
}

interface FlatFileNode extends Omit<FileNode, 'children'> {
  hasChildren: boolean;
}

interface SourceSnippetLine {
  line: number;
  content: string;
  highlighted: boolean;
}

interface SourceSnippet {
  sourceFile: string;
  generatedFile?: string;
  version: string;
  line?: number;
  column?: number;
  startLine: number;
  endLine: number;
  content: string;
  snippet: SourceSnippetLine[];
  sourcemap: {
    id: string;
    filename: string;
    uploadedAt: string;
  };
}

const props = defineProps<{
  error: TrackedErrorInfo;
  projectId: string;
  analyzing?: boolean;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'request-ai-analysis', error: TrackedErrorInfo): void;
}>();

const selectedFrameId = ref('');
const expandedPaths = ref<Set<string>>(new Set());
const sourceLoading = ref(false);
const sourceError = ref('');
const sourceSnippet = ref<SourceSnippet | null>(null);
let sourceRequestId = 0;

const normalizePath = (value: string) => {
  return value
    .replace(/^webpack:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/');
};

const parseStackLine = (line: string, index: number): Omit<StackFrame, 'id' | 'index' | 'primary'> | null => {
  const chromeMatch = line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/);
  if (chromeMatch) {
    return {
      functionName: chromeMatch[1] || '(anonymous)',
      file: normalizePath(chromeMatch[2]),
      line: Number(chromeMatch[3]),
      column: Number(chromeMatch[4]),
      raw: line.trim(),
    };
  }

  const firefoxMatch = line.match(/^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/);
  if (firefoxMatch) {
    return {
      functionName: firefoxMatch[1] || '(anonymous)',
      file: normalizePath(firefoxMatch[2]),
      line: Number(firefoxMatch[3]),
      column: Number(firefoxMatch[4]),
      raw: line.trim(),
    };
  }

  const fileOnlyMatch = line.match(/(.+\.(?:js|ts|tsx|jsx|vue|mjs|cjs)):(\d+):(\d+)/);
  if (fileOnlyMatch) {
    return {
      functionName: '(anonymous)',
      file: normalizePath(fileOnlyMatch[1]),
      line: Number(fileOnlyMatch[2]),
      column: Number(fileOnlyMatch[3]),
      raw: line.trim(),
    };
  }

  return null;
};

const stackFrames = computed<StackFrame[]>(() => {
  const frames: StackFrame[] = [];

  if (props.error.sourceFile) {
    frames.push({
      id: 'mapped-source',
      index: 0,
      functionName: 'SourceMap 映射位置',
      file: normalizePath(props.error.sourceFile),
      line: props.error.sourceLine,
      column: props.error.sourceColumn,
      raw: `${props.error.sourceFile}:${props.error.sourceLine ?? '-'}:${props.error.sourceColumn ?? '-'}`,
      primary: true,
    });
  }

  const stack = props.error.mappedStack || props.error.stack || '';
  stack.split('\n').forEach((line, lineIndex) => {
    const parsed = parseStackLine(line, lineIndex);
    if (!parsed) return;
    const id = `${parsed.file}:${parsed.line ?? ''}:${parsed.column ?? ''}:${parsed.functionName}:${lineIndex}`;
    frames.push({
      ...parsed,
      id,
      index: frames.length,
      primary: !props.error.sourceFile && frames.length === 0,
    });
  });

  const unique = new Map<string, StackFrame>();
  frames.forEach((frame) => {
    const key = `${frame.file}:${frame.line ?? ''}:${frame.column ?? ''}:${frame.functionName}`;
    if (!unique.has(key)) unique.set(key, frame);
  });

  return [...unique.values()].map((frame, index) => ({ ...frame, index }));
});

const selectedFrame = computed(() => {
  return stackFrames.value.find((frame) => frame.id === selectedFrameId.value) || stackFrames.value[0];
});

const createFileNode = (
  id: string,
  name: string,
  path: string,
  type: FileNode['type'],
  depth: number
): FileNode => ({
  id,
  name,
  path,
  type,
  depth,
  count: 0,
  children: new Map(),
  frames: [],
});

const fileTreeRoot = computed(() => {
  const root = createFileNode('root', 'root', '', 'directory', -1);

  stackFrames.value.forEach((frame) => {
    const parts = frame.file.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      let node = current.children.get(part);

      if (!node) {
        node = createFileNode(`${isFile ? 'file' : 'dir'}:${path}`, part, path, isFile ? 'file' : 'directory', index);
        current.children.set(part, node);
      }

      node.count += 1;
      if (isFile) node.frames.push(frame);
      current = node;
    });
  });

  return root;
});

const sortedChildren = (node: FileNode) =>
  [...node.children.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const visibleFileRows = computed<FlatFileNode[]>(() => {
  const rows: FlatFileNode[] = [];
  const walk = (node: FileNode) => {
    sortedChildren(node).forEach((child) => {
      rows.push({
        id: child.id,
        name: child.name,
        path: child.path,
        type: child.type,
        depth: child.depth,
        count: child.count,
        frames: child.frames,
        hasChildren: child.children.size > 0,
      });

      if (child.type === 'directory' && expandedPaths.value.has(child.path)) {
        walk(child);
      }
    });
  };

  walk(fileTreeRoot.value);
  return rows;
});

const rawStack = computed(() => props.error.mappedStack || props.error.stack || '暂无堆栈信息');

const sourceLocation = computed(() => {
  const frame = selectedFrame.value;
  if (!frame) return '暂无 SourceMap 定位';
  const line = frame.line ? `:${frame.line}` : '';
  const column = frame.column ? `:${frame.column}` : '';
  return `${frame.file}${line}${column}`;
});

const sourceQueryKey = computed(() => {
  const frame = selectedFrame.value;
  if (!frame) return '';
  return [
    props.projectId,
    frame.file,
    frame.line ?? '',
    frame.column ?? '',
    props.error.version ?? '',
  ].join('|');
});

const formatTime = computed(() =>
  new Date(props.error.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);

const typeLabel = computed(() => {
  switch (props.error.type) {
    case 'js':
      return 'JS 错误';
    case 'promise':
      return 'Promise';
    case 'resource':
      return '资源';
    default:
      return props.error.type.toUpperCase();
  }
});

const toggleDirectory = (path: string) => {
  const next = new Set(expandedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  expandedPaths.value = next;
};

const selectFileNode = (node: FlatFileNode) => {
  if (node.type === 'directory') {
    toggleDirectory(node.path);
    return;
  }

  if (node.frames[0]) {
    selectedFrameId.value = node.frames[0].id;
  }
};

const initializeTree = () => {
  const firstLevel = sortedChildren(fileTreeRoot.value)
    .filter((node) => node.type === 'directory')
    .map((node) => node.path);
  expandedPaths.value = new Set(firstLevel);
};

const fetchSourceSnippet = async () => {
  const frame = selectedFrame.value;
  const requestId = ++sourceRequestId;

  if (!frame?.file) {
    sourceSnippet.value = null;
    sourceError.value = '当前调用帧没有文件信息。';
    return;
  }

  sourceLoading.value = true;
  sourceError.value = '';
  sourceSnippet.value = null;

  const params = new URLSearchParams({
    file: frame.file,
    context: '10',
  });

  if (frame.line) params.set('line', String(frame.line));
  if (frame.column) params.set('column', String(frame.column));
  if (props.error.version) params.set('version', props.error.version);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/sourcemaps/${encodeURIComponent(props.projectId)}/source/content?${params}`
    );

    if (requestId !== sourceRequestId) return;

    if (!response.ok) {
      sourceError.value = response.status === 404
        ? '没有找到对应 SourceMap 源码。请确认已上传包含 sourcesContent 的 SourceMap。'
        : '源码加载失败，请稍后重试。';
      return;
    }

    const payload = await response.json();
    sourceSnippet.value = payload.data ?? null;

    if (!sourceSnippet.value) {
      sourceError.value = 'SourceMap 已返回，但没有可展示的源码内容。';
    }
  } catch (error) {
    if (requestId !== sourceRequestId) return;
    console.error('Failed to load source snippet:', error);
    sourceError.value = '源码加载失败，请确认后端服务可访问。';
  } finally {
    if (requestId === sourceRequestId) {
      sourceLoading.value = false;
    }
  }
};

watch(
  () => props.error,
  () => {
    selectedFrameId.value = stackFrames.value[0]?.id || '';
    initializeTree();
  },
  { immediate: true }
);

watch(sourceQueryKey, fetchSourceSnippet, { immediate: true });
</script>

<template>
  <section class="drilldown" aria-label="错误详情">
    <header class="drilldown__header">
      <button type="button" class="back-button" @click="emit('back')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        返回错误列表
      </button>
      <div class="drilldown__title">
        <div class="type-row">
          <span class="type-badge" :class="`type-badge--${error.type}`">{{ typeLabel }}</span>
          <span>{{ formatTime }}</span>
        </div>
        <h2>{{ error.message }}</h2>
        <p>{{ sourceLocation }}</p>
      </div>
      <button type="button" class="ai-button" :disabled="analyzing" @click="emit('request-ai-analysis', error)">
        <span v-if="analyzing" class="spinner spinner--small"></span>
        <span>{{ analyzing ? '分析中' : 'AI 分析' }}</span>
      </button>
    </header>

    <div class="summary-grid">
      <div class="summary-card">
        <span>项目</span>
        <strong>{{ projectId }}</strong>
      </div>
      <div class="summary-card">
        <span>调用层级</span>
        <strong>{{ stackFrames.length }}</strong>
      </div>
      <div class="summary-card">
        <span>当前文件</span>
        <strong>{{ selectedFrame?.file || '未定位' }}</strong>
      </div>
    </div>

    <div class="detail-layout">
      <section class="call-panel">
        <div class="section-title">
          <div>
            <p>Call Hierarchy</p>
            <h3>调用层级</h3>
          </div>
          <span>{{ stackFrames.length }} 帧</span>
        </div>

        <div v-if="stackFrames.length" class="call-stack" role="list">
          <button
            v-for="frame in stackFrames"
            :key="frame.id"
            type="button"
            class="call-frame"
            :class="{ 'call-frame--active': selectedFrame?.id === frame.id }"
            role="listitem"
            @click="selectedFrameId = frame.id"
          >
            <span class="call-frame__index">{{ frame.index + 1 }}</span>
            <span class="call-frame__line"></span>
            <span class="call-frame__content">
              <span class="call-frame__top">
                <strong>{{ frame.functionName }}</strong>
                <em v-if="frame.primary">Root</em>
              </span>
              <code>{{ frame.file }}{{ frame.line ? `:${frame.line}` : '' }}{{ frame.column ? `:${frame.column}` : '' }}</code>
              <small>{{ frame.raw }}</small>
            </span>
          </button>
        </div>

        <div v-else class="empty-box">当前错误没有可解析的调用栈。</div>
      </section>

      <aside class="context-panel">
        <section class="file-panel">
          <div class="section-title">
            <div>
              <p>Files</p>
              <h3>关联文件结构</h3>
            </div>
          </div>

          <div v-if="visibleFileRows.length" class="file-tree" role="tree">
            <button
              v-for="node in visibleFileRows"
              :key="node.id"
              type="button"
              class="file-row"
              :class="{
                'file-row--file': node.type === 'file',
                'file-row--active': selectedFrame?.file === node.path,
              }"
              :style="{ paddingLeft: `${12 + node.depth * 18}px` }"
              :aria-expanded="node.type === 'directory' ? expandedPaths.has(node.path) : undefined"
              role="treeitem"
              @click="selectFileNode(node)"
            >
              <span class="file-row__toggle" aria-hidden="true">
                <svg v-if="node.type === 'directory'" viewBox="0 0 24 24" fill="none">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="file-row__icon" aria-hidden="true">
                <svg v-if="node.type === 'directory'" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7.5C3 6.7 3.7 6 4.5 6H9l2 2h8.5c.8 0 1.5.7 1.5 1.5V18c0 .8-.7 1.5-1.5 1.5h-15C3.7 19.5 3 18.8 3 18V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none">
                  <path d="M7 3.5h7l5 5v12H7v-17Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                  <path d="M14 3.5v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="file-row__name" :title="node.path">{{ node.name }}</span>
              <span class="file-row__count">{{ node.count }}</span>
            </button>
          </div>
          <div v-else class="empty-box">暂无关联文件。</div>
        </section>

        <section class="source-panel">
          <div class="section-title">
            <div>
              <p>Selected Frame</p>
              <h3>当前帧</h3>
            </div>
          </div>
          <dl class="frame-meta">
            <div>
              <dt>函数</dt>
              <dd>{{ selectedFrame?.functionName || '-' }}</dd>
            </div>
            <div>
              <dt>文件</dt>
              <dd>{{ selectedFrame?.file || '-' }}</dd>
            </div>
            <div>
              <dt>位置</dt>
              <dd>{{ selectedFrame?.line || '-' }}:{{ selectedFrame?.column || '-' }}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>

    <section class="source-code-panel">
      <div class="section-title">
        <div>
          <p>Source Code</p>
          <h3>SourceMap 源码</h3>
        </div>
        <span v-if="sourceSnippet">{{ sourceSnippet.sourcemap.filename }}</span>
      </div>

      <div v-if="sourceLoading" class="source-state">
        <span class="spinner"></span>
        <span>正在从 SourceMap 解析源码...</span>
      </div>

      <div v-else-if="sourceSnippet" class="source-viewer">
        <div class="source-viewer__meta">
          <code>{{ sourceSnippet.sourceFile }}</code>
          <span>
            Line {{ sourceSnippet.line || '-' }} · Column {{ sourceSnippet.column ?? '-' }} · Version {{ sourceSnippet.version }}
          </span>
        </div>
        <pre class="source-code" aria-label="源码片段"><code><span
          v-for="line in sourceSnippet.snippet"
          :key="line.line"
          class="source-line"
          :class="{ 'source-line--highlighted': line.highlighted }"
        ><span class="source-line__number">{{ line.line }}</span><span class="source-line__content">{{ line.content || ' ' }}</span></span></code></pre>
      </div>

      <div v-else class="source-state source-state--empty">
        <strong>暂无源码内容</strong>
        <span>{{ sourceError || '选择一个调用帧后，将尝试从 SourceMap 的 sourcesContent 中展示源码。' }}</span>
      </div>
    </section>

    <section class="raw-stack-panel">
      <div class="section-title">
        <div>
          <p>Raw Stack</p>
          <h3>原始堆栈</h3>
        </div>
      </div>
      <pre>{{ rawStack }}</pre>
    </section>
  </section>
</template>

<style scoped>
.drilldown {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drilldown__header,
.summary-card,
.call-panel,
.file-panel,
.source-panel,
.source-code-panel,
.raw-stack-panel {
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--shadow-card);
}

.drilldown__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  padding: 18px 20px;
}

.back-button,
.ai-button {
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
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

.back-button:hover,
.ai-button:hover {
  border-color: rgba(37, 99, 235, 0.28);
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.back-button svg {
  width: 16px;
  height: 16px;
}

.ai-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.type-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--nx-text-muted);
  font-size: 0.78rem;
}

.type-badge {
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

.drilldown__title {
  min-width: 0;
}

.drilldown__title h2 {
  margin: 8px 0 4px;
  color: var(--nx-text-primary);
  font-size: clamp(1.15rem, 2.4vw, 1.55rem);
  line-height: 1.25;
  word-break: break-word;
}

.drilldown__title p {
  color: var(--nx-cyan);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  word-break: break-all;
}

.summary-grid {
  display: grid;
  grid-template-columns: 180px 180px minmax(0, 1fr);
  gap: 12px;
}

.summary-card {
  min-width: 0;
  padding: 14px;
}

.summary-card span {
  display: block;
  margin-bottom: 6px;
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.summary-card strong {
  display: block;
  overflow: hidden;
  color: var(--nx-text-primary);
  font-size: 0.95rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.8fr);
  gap: 16px;
}

.call-panel,
.file-panel,
.source-panel,
.raw-stack-panel {
  overflow: hidden;
}

.section-title {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--nx-border);
}

.section-title p {
  margin: 0 0 2px;
  color: var(--nx-text-muted);
  font-size: 0.74rem;
  font-weight: 800;
}

.section-title h3 {
  margin: 0;
  font-size: 1rem;
}

.section-title > span {
  padding: 4px 9px;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  background: var(--nx-deep);
  color: var(--nx-text-secondary);
  font-size: 0.76rem;
  font-weight: 800;
}

.call-stack {
  max-height: 560px;
  overflow: auto;
  padding: 12px 14px 14px;
}

.call-frame {
  width: 100%;
  display: grid;
  grid-template-columns: 30px 16px minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--nx-text-secondary);
  cursor: pointer;
  text-align: left;
}

.call-frame:hover,
.call-frame--active {
  border-color: rgba(37, 99, 235, 0.22);
  background: var(--nx-cyan-glow);
}

.call-frame__index {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  background: var(--nx-surface);
  color: var(--nx-text-muted);
  font-size: 0.74rem;
  font-weight: 800;
}

.call-frame--active .call-frame__index {
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--nx-cyan);
}

.call-frame__line {
  position: relative;
  display: block;
  min-height: 54px;
}

.call-frame__line::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: -16px;
  left: 7px;
  width: 2px;
  background: var(--nx-border);
}

.call-frame:last-child .call-frame__line::before {
  bottom: 28px;
}

.call-frame__content {
  min-width: 0;
}

.call-frame__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.call-frame__top strong {
  min-width: 0;
  overflow: hidden;
  color: var(--nx-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-frame__top em {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--nx-red-glow);
  color: var(--nx-red);
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 800;
}

.call-frame code {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--nx-cyan);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-frame small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--nx-text-muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.file-tree {
  max-height: 330px;
  overflow: auto;
  padding: 10px 0;
}

.file-row {
  width: 100%;
  min-height: 34px;
  display: grid;
  grid-template-columns: 16px 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding-right: 12px;
  border: 0;
  background: transparent;
  color: var(--nx-text-secondary);
  cursor: pointer;
  text-align: left;
}

.file-row:hover,
.file-row--active {
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.file-row__toggle {
  width: 16px;
  height: 16px;
  color: var(--nx-text-muted);
  transition: transform var(--transition-fast);
}

.file-row__toggle svg,
.file-row__icon svg {
  width: 100%;
  height: 100%;
}

.file-row[aria-expanded='true'] .file-row__toggle {
  transform: rotate(90deg);
}

.file-row__icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--nx-deep);
  color: var(--nx-text-muted);
}

.file-row--file .file-row__icon {
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.file-row__name {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-row__count {
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.frame-meta {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
}

.frame-meta div {
  min-width: 0;
}

.frame-meta dt {
  color: var(--nx-text-muted);
  font-size: 0.74rem;
  font-weight: 800;
}

.frame-meta dd {
  margin-top: 3px;
  overflow-wrap: anywhere;
  color: var(--nx-text-primary);
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.raw-stack-panel pre {
  max-height: 260px;
  overflow: auto;
  margin: 0;
  padding: 16px;
  background: var(--nx-code-bg);
  color: var(--nx-text-primary);
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-code-panel {
  overflow: hidden;
}

.source-state {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--nx-text-muted);
  text-align: center;
}

.source-state strong {
  color: var(--nx-text-primary);
}

.source-viewer {
  background: #fbfdff;
}

.source-viewer__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--nx-border);
  color: var(--nx-text-muted);
  font-size: 0.78rem;
}

.source-viewer__meta code {
  min-width: 0;
  overflow: hidden;
  color: var(--nx-cyan);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-code {
  max-height: 420px;
  overflow: auto;
  margin: 0;
  padding: 12px 0;
  background: var(--nx-code-bg);
  color: var(--nx-text-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.65;
}

.source-line {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  min-width: max-content;
  padding-right: 18px;
}

.source-line--highlighted {
  background: rgba(37, 99, 235, 0.1);
  box-shadow: inset 3px 0 0 var(--nx-cyan);
}

.source-line__number {
  padding-right: 12px;
  color: var(--nx-text-muted);
  text-align: right;
  user-select: none;
}

.source-line__content {
  padding-left: 12px;
  border-left: 1px solid var(--nx-border);
  white-space: pre;
}

.empty-box {
  margin: 14px;
  padding: 18px;
  border: 1px dashed var(--nx-border);
  border-radius: var(--radius-md);
  color: var(--nx-text-muted);
  text-align: center;
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

@media (max-width: 1100px) {
  .detail-layout,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .drilldown__header {
    grid-template-columns: 1fr;
  }

  .back-button,
  .ai-button {
    justify-self: start;
  }

  .source-viewer__meta {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
