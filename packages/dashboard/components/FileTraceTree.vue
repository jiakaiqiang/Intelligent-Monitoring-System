<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';

interface TrackedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
}

interface StackFrame {
  file: string;
  line?: number;
  column?: number;
  functionName?: string;
  errorIndex: number;
  message: string;
  timestamp: number;
  primary: boolean;
}

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file';
  depth: number;
  count: number;
  latestTimestamp: number;
  children: Map<string, TreeNode>;
  frames: StackFrame[];
}

interface FlatNode extends Omit<TreeNode, 'children'> {
  hasChildren: boolean;
}

const props = defineProps<{
  errors: TrackedErrorInfo[];
  selectedPath?: string;
}>();

const emit = defineEmits<{
  (event: 'select-file', path: string): void;
  (event: 'clear-selection'): void;
}>();

const expandedPaths = ref<Set<string>>(new Set());
const initializedSignature = ref('');

const normalizePath = (value: string) => {
  return value
    .replace(/^webpack:\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/');
};

const parseStackLine = (line: string): Omit<StackFrame, 'errorIndex' | 'message' | 'timestamp' | 'primary'> | null => {
  const chromeMatch = line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/);
  if (chromeMatch) {
    return {
      functionName: chromeMatch[1] || '(anonymous)',
      file: normalizePath(chromeMatch[2]),
      line: Number(chromeMatch[3]),
      column: Number(chromeMatch[4]),
    };
  }

  const firefoxMatch = line.match(/^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/);
  if (firefoxMatch) {
    return {
      functionName: firefoxMatch[1] || '(anonymous)',
      file: normalizePath(firefoxMatch[2]),
      line: Number(firefoxMatch[3]),
      column: Number(firefoxMatch[4]),
    };
  }

  return null;
};

const extractFrames = (error: TrackedErrorInfo, errorIndex: number): StackFrame[] => {
  const frames: StackFrame[] = [];
  const pushFrame = (frame: Omit<StackFrame, 'errorIndex' | 'message' | 'timestamp'>) => {
    if (!frame.file) return;
    frames.push({
      ...frame,
      errorIndex,
      message: error.message,
      timestamp: error.timestamp,
    });
  };

  if (error.sourceFile) {
    pushFrame({
      file: normalizePath(error.sourceFile),
      line: error.sourceLine,
      column: error.sourceColumn,
      functionName: 'SourceMap',
      primary: true,
    });
  }

  const stack = error.mappedStack || error.stack;
  stack?.split('\n').forEach((line, lineIndex) => {
    const parsed = parseStackLine(line);
    if (parsed) {
      pushFrame({ ...parsed, primary: !error.sourceFile && lineIndex === 0 });
    }
  });

  const unique = new Map<string, StackFrame>();
  frames.forEach((frame) => {
    const key = `${frame.file}:${frame.line ?? ''}:${frame.column ?? ''}:${frame.functionName ?? ''}`;
    if (!unique.has(key)) {
      unique.set(key, frame);
    }
  });

  return [...unique.values()];
};

const allFrames = computed(() => props.errors.flatMap((error, index) => extractFrames(error, index)));

const createNode = (
  id: string,
  name: string,
  path: string,
  type: TreeNode['type'],
  depth: number
): TreeNode => ({
  id,
  name,
  path,
  type,
  depth,
  count: 0,
  latestTimestamp: 0,
  children: new Map(),
  frames: [],
});

const treeRoot = computed(() => {
  const root = createNode('root', 'root', '', 'directory', -1);

  allFrames.value.forEach((frame) => {
    const parts = frame.file.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      const id = `${isFile ? 'file' : 'dir'}:${path}`;
      let node = current.children.get(part);

      if (!node) {
        node = createNode(id, part, path, isFile ? 'file' : 'directory', index);
        current.children.set(part, node);
      }

      node.count += 1;
      node.latestTimestamp = Math.max(node.latestTimestamp, frame.timestamp);
      if (isFile) node.frames.push(frame);
      current = node;
    });
  });

  return root;
});

const sortedChildren = (node: TreeNode) =>
  [...node.children.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const treeSignature = computed(() => {
  const paths: string[] = [];
  const visit = (node: TreeNode) => {
    sortedChildren(node).forEach((child) => {
      paths.push(child.path);
      visit(child);
    });
  };
  visit(treeRoot.value);
  return paths.join('|');
});

const visibleRows = computed<FlatNode[]>(() => {
  const rows: FlatNode[] = [];

  const flatten = (node: TreeNode) => {
    sortedChildren(node).forEach((child) => {
      rows.push({
        id: child.id,
        name: child.name,
        path: child.path,
        type: child.type,
        depth: child.depth,
        count: child.count,
        latestTimestamp: child.latestTimestamp,
        frames: child.frames,
        hasChildren: child.children.size > 0,
      });

      if (child.type === 'directory' && expandedPaths.value.has(child.path)) {
        flatten(child);
      }
    });
  };

  flatten(treeRoot.value);
  return rows;
});

const impactedFileCount = computed(() => {
  const files = new Set(allFrames.value.map((frame) => frame.file));
  return files.size;
});

const impactedErrorCount = computed(() => new Set(allFrames.value.map((frame) => frame.errorIndex)).size);

const selectedFrames = computed(() => {
  if (!props.selectedPath) {
    return allFrames.value.slice(0, 8);
  }
  return allFrames.value.filter((frame) => frame.file === props.selectedPath).slice(0, 12);
});

const selectedTitle = computed(() => props.selectedPath || '最近异常帧');

const toggleDirectory = (path: string) => {
  const next = new Set(expandedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  expandedPaths.value = next;
};

const handleNodeClick = (node: FlatNode) => {
  if (node.type === 'directory') {
    toggleDirectory(node.path);
    return;
  }
  emit('select-file', node.path);
};

const formatFrameLocation = (frame: StackFrame) => {
  const line = frame.line ? `:${frame.line}` : '';
  const column = frame.column ? `:${frame.column}` : '';
  return `${frame.file}${line}${column}`;
};

const initializeFirstLevel = () => {
  const firstLevel = sortedChildren(treeRoot.value)
    .filter((node) => node.type === 'directory')
    .map((node) => node.path);
  expandedPaths.value = new Set(firstLevel);
};

watch(
  treeSignature,
  (signature) => {
    if (signature !== initializedSignature.value) {
      initializedSignature.value = signature;
      initializeFirstLevel();
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="file-trace-panel" aria-label="异常文件追踪">
    <header class="file-trace-panel__header">
      <div>
        <p class="file-trace-panel__eyebrow">File Trace</p>
        <h2>异常文件追踪</h2>
      </div>
      <div class="file-trace-panel__stats">
        <span>{{ impactedFileCount }} 个文件</span>
        <span>{{ impactedErrorCount }} 条异常</span>
      </div>
    </header>

    <div v-if="visibleRows.length" class="file-trace-panel__content">
      <div class="file-tree" role="tree" aria-label="异常文件树">
        <button
          v-if="selectedPath"
          type="button"
          class="file-tree__clear"
          @click="emit('clear-selection')"
        >
          清除文件筛选
        </button>

        <button
          v-for="node in visibleRows"
          :key="node.id"
          type="button"
          class="file-tree__row"
          :class="{
            'file-tree__row--file': node.type === 'file',
            'file-tree__row--directory': node.type === 'directory',
            'file-tree__row--active': selectedPath === node.path,
          }"
          :style="{ paddingLeft: `${12 + node.depth * 18}px` }"
          :aria-expanded="node.type === 'directory' ? expandedPaths.has(node.path) : undefined"
          role="treeitem"
          @click="handleNodeClick(node)"
        >
          <span class="file-tree__toggle" aria-hidden="true">
            <svg v-if="node.type === 'directory'" viewBox="0 0 24 24" fill="none">
              <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="file-tree__icon" aria-hidden="true">
            <svg v-if="node.type === 'directory'" viewBox="0 0 24 24" fill="none">
              <path d="M3 7.5C3 6.7 3.7 6 4.5 6H9l2 2h8.5c.8 0 1.5.7 1.5 1.5V18c0 .8-.7 1.5-1.5 1.5h-15C3.7 19.5 3 18.8 3 18V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M7 3.5h7l5 5v12H7v-17Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              <path d="M14 3.5v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="file-tree__name" :title="node.path">{{ node.name }}</span>
          <span class="file-tree__count">{{ node.count }}</span>
        </button>
      </div>

      <aside class="file-trace-detail">
        <div class="file-trace-detail__header">
          <span>{{ selectedTitle }}</span>
        </div>
        <div v-if="selectedFrames.length" class="file-trace-detail__list">
          <article
            v-for="frame in selectedFrames"
            :key="`${frame.errorIndex}-${formatFrameLocation(frame)}-${frame.functionName}`"
            class="file-frame"
          >
            <div class="file-frame__topline">
              <strong>{{ frame.functionName || '(anonymous)' }}</strong>
              <span v-if="frame.primary">Root</span>
            </div>
            <code>{{ formatFrameLocation(frame) }}</code>
            <p>{{ frame.message }}</p>
          </article>
        </div>
        <div v-else class="file-trace-detail__empty">选择一个文件查看相关异常帧。</div>
      </aside>
    </div>

    <div v-else class="file-trace-panel__empty">
      暂无可追踪文件。请上传 SourceMap，或等待异常堆栈包含文件、行、列信息。
    </div>
  </section>
</template>

<style scoped>
.file-trace-panel {
  overflow: hidden;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--shadow-card);
}

.file-trace-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--nx-border);
}

.file-trace-panel__eyebrow {
  margin: 0 0 4px;
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.file-trace-panel h2 {
  margin: 0;
  font-size: 1.08rem;
}

.file-trace-panel__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.file-trace-panel__stats span {
  padding: 4px 10px;
  border: 1px solid var(--nx-border);
  border-radius: 999px;
  background: var(--nx-deep);
  color: var(--nx-text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
}

.file-trace-panel__content {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.2fr);
  min-height: 430px;
}

.file-tree {
  max-height: 520px;
  overflow: auto;
  padding: 10px 0;
  border-right: 1px solid var(--nx-border);
}

.file-tree__clear,
.file-tree__row {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--nx-text-secondary);
  cursor: pointer;
  text-align: left;
}

.file-tree__clear {
  width: calc(100% - 20px);
  min-height: 34px;
  margin: 0 10px 8px;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: var(--radius-md);
  color: var(--nx-cyan);
  font-weight: 800;
}

.file-tree__row {
  min-height: 34px;
  display: grid;
  grid-template-columns: 16px 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding-right: 12px;
}

.file-tree__row:hover,
.file-tree__row--active {
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.file-tree__toggle {
  width: 16px;
  height: 16px;
  color: var(--nx-text-muted);
  transition: transform var(--transition-fast);
}

.file-tree__toggle svg,
.file-tree__icon svg {
  width: 100%;
  height: 100%;
}

.file-tree__row[aria-expanded='true'] .file-tree__toggle {
  transform: rotate(90deg);
}

.file-tree__icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--nx-deep);
  color: var(--nx-text-muted);
}

.file-tree__row--file .file-tree__icon {
  background: var(--nx-cyan-glow);
  color: var(--nx-cyan);
}

.file-tree__name {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tree__count {
  color: var(--nx-text-muted);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.file-trace-detail {
  min-width: 0;
  background: #fbfdff;
}

.file-trace-detail__header {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--nx-border);
  color: var(--nx-text-primary);
  font-weight: 800;
}

.file-trace-detail__header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-trace-detail__list {
  max-height: 472px;
  overflow: auto;
  padding: 14px 16px;
}

.file-frame {
  padding: 12px;
  border: 1px solid var(--nx-border);
  border-radius: var(--radius-md);
  background: var(--nx-surface);
}

.file-frame + .file-frame {
  margin-top: 10px;
}

.file-frame__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.file-frame__topline strong {
  min-width: 0;
  overflow: hidden;
  color: var(--nx-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-frame__topline span {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--nx-red-glow);
  color: var(--nx-red);
  font-size: 0.7rem;
  font-weight: 800;
}

.file-frame code {
  display: block;
  margin-top: 5px;
  color: var(--nx-cyan);
  font-size: 0.76rem;
  word-break: break-all;
}

.file-frame p {
  margin-top: 7px;
  color: var(--nx-text-secondary);
  font-size: 0.82rem;
}

.file-trace-detail__empty,
.file-trace-panel__empty {
  padding: 22px;
  color: var(--nx-text-muted);
}

@media (max-width: 900px) {
  .file-trace-panel__content {
    grid-template-columns: 1fr;
  }

  .file-tree {
    max-height: 360px;
    border-right: 0;
    border-bottom: 1px solid var(--nx-border);
  }
}

@media (max-width: 640px) {
  .file-trace-panel__header {
    flex-direction: column;
  }

  .file-trace-panel__stats {
    justify-content: flex-start;
  }
}
</style>
