<template>
  <div v-if="source" :style="{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  }">
    <!-- 头部工具栏 -->
    <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }">
      <h3 :style="{ color: 'white', margin: 0 }">Source Code Viewer</h3>
      <div>
        <button
          @close="closeViewer"
          :style="{
            background: '#ff4d4f',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }"
        >
          Close
        </button>
      </div>
    </div>

    <!-- 文件信息 -->
    <div :style="{ background: '#1e1e1e', padding: '10px 20px', marginBottom: '10px', borderRadius: '4px' }">
      <div :style="{ display: 'flex', alignItems: 'center', gap: '20px' }">
        <span :style="{ color: '#ccc' }">📄 {{ source.fileName }}</span>
        <span v-if="lineNumber" :style="{ color: '#ccc' }">Line: {{ lineNumber }}</span>
        <span v-if="columnNumber" :style="{ color: '#ccc' }">Column: {{ columnNumber }}</span>
      </div>
    </div>

    <!-- 源码查看器 -->
    <div :style="{
      flex: 1,
      background: '#1e1e1e',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }">
      <!-- 行号栏 -->
      <div :style="{
        background: '#2d2d2d',
        padding: '10px 10px 0 10px',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#858585',
        lineHeight: '1.6',
        float: 'left',
        width: '60px',
        textAlign: 'right',
        marginRight: '10px',
        userSelect: 'none'
      }">
        <div v-for="(_, index) in lineCount" :key="index" :style="{ lineHeight: '1.6' }">
          {{ index + 1 }}
        </div>
      </div>

      <!-- 代码栏 -->
      <div :style="{
        flex: 1,
        padding: '10px 0 10px 70px',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.6',
        color: 'white'
      }">
        <pre>{{ source.content }}</pre>

        <!-- 高亮行 -->
        <div
          v-if="lineNumber"
          :style="{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '1.6em',
            background: 'rgba(255, 77, 79, 0.1)',
            borderLeft: '3px solid #ff4d4f',
            pointerEvents: 'none',
             top: `${(lineNumber - 1) * 1.6 + 10}px`,
            marginLeft: '70px'
          }"
         
        ></div>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div :style="{ marginTop: '10px', display: 'flex', gap: '10px' }">
      <button
        @copySource="copySource"
        :style="{
          background: '#1890ff',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }"
      >
        Copy Source
      </button>

      <button
        @downloadSource="downloadSource"
        :style="{
          background: '#52c41a',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }"
      >
        Download
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue'
interface SourceFile {
  fileName: string;
  content: string;
}

interface Props {
  source: SourceFile | null;
  lineNumber?: number;
  columnNumber?: number;
}

const props = withDefaults(defineProps<Props>(), {
  lineNumber: 0,
  columnNumber: 0
});

const emit = defineEmits(['close', 'copy', 'download']);

// 计算行数
const lineCount = computed(() => {
  if (!props.source) return 0;
  return props.source.content.split('\n').length;
});

// 关闭查看器
const closeViewer = () => {
  emit('close');
};

// 复制源码
const copySource = () => {
  if (props.source) {
    navigator.clipboard.writeText(props.source.content)
      .then(() => {
        alert('Source code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  }
};

// 下载源码
const downloadSource = () => {
  if (props.source) {
    const blob = new Blob([props.source.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = props.source.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
</script>