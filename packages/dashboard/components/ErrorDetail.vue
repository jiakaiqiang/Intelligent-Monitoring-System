<script setup lang="ts">
import { ref } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';

interface MappedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
}

interface Props {
  error: ErrorInfo | MappedErrorInfo;
  aiAnalysis?: string;
}

const props = defineProps<Props>();

// 堆栈显示状态
const currentStack = ref('original');

// 暴露给模板
defineExpose({
  currentStack,
  jumpToSource
});

// 跳转到源码 - 发出事件而不是直接跳转
function jumpToSource(file: string, line?: number, column?: number) {
  // 触发事件让父组件处理
  const event = new CustomEvent('view-source', {
    detail: { file, line, column }
  });
  document.dispatchEvent(event);
}
</script>

<template>
  <div :style="{ padding: '20px' }">
    <h2>Error Details</h2>

    <div :style="{ marginBottom: '20px' }">
      <h3>Type: {{ error.type }}</h3>
      <p><strong>Message:</strong> {{ error.message }}</p>
      <p><strong>Time:</strong> {{ new Date(error.timestamp).toLocaleString() }}</p>
      <p><strong>URL:</strong> {{ error.url }}</p>

      <!-- 版本信息 -->
      <p v-if="error.version" :style="{ marginTop: '10px' }">
        <strong>Version:</strong>
        <span :style="{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }">
          {{ error.version }}
        </span>
      </p>
    </div>

    <!-- 映射状态指示器 -->
    <div v-if="error.sourceFile" :style="{ marginBottom: '10px' }">
      <span :style="{
        background: '#f6ffed',
        color: '#52c41a',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px'
      }">
        <span>✓</span> Mapped to source
      </span>
    </div>

    <div
      v-else
      :style="{ marginBottom: '20px', padding: '10px', background: '#fff7e6', borderRadius: '4px', fontSize: '14px', color: '#d46b08' }"
    >
      <p :style="{ margin: 0 }">No source mapping available for this error.</p>
    </div>

    <!-- 映射后的源码位置 -->
    <div v-if="error.sourceFile" :style="{ marginBottom: '20px' }">
      <h3>Source Location</h3>
      <div :style="{
        background: '#e6f7ff',
        padding: '15px',
        borderRadius: '4px',
        marginBottom: '10px'
      }">
        <div :style="{ display: 'flex', alignItems: 'center', gap: '10px' }">
          <div>
            <strong>File:</strong> {{ error.sourceFile }}
          </div>
          <div v-if="error.sourceLine">
            <strong>Line:</strong>
            <span :style="{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }">
              {{ error.sourceLine }}
            </span>
          </div>
          <div v-if="error.sourceColumn">
            <strong>Column:</strong>
            <span :style="{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }">
              {{ error.sourceColumn }}
            </span>
          </div>
        </div>

        <!-- 跳转到源码按钮 -->
        <button
          @click="$emit('view-source', error)"
          :style="{
            marginTop: '10px',
            padding: '6px 12px',
            background: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }"
        >
          View Source Code
        </button>
      </div>
    </div>

    <!-- 堆栈对比显示 -->
    <div v-if="error.mappedStack" :style="{ marginBottom: '20px' }">
      <h3>Stack Trace</h3>

      <!-- 切换标签 -->
      <div :style="{ marginBottom: '10px' }">
        <button
          v-for="tab in ['original', 'mapped']"
          :key="tab"
          @click="currentStack = tab"
          :style="{
            marginRight: '10px',
            padding: '6px 12px',
            background: currentStack === tab ? '#1890ff' : '#f0f0f0',
            color: currentStack === tab ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }"
        >
          {{ tab === 'original' ? 'Original' : 'Mapped' }}
        </button>
      </div>

      <!-- 堆栈内容 -->
      <div :style="{
        background: '#f5f5f5',
        padding: '10px',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.6',
        borderRadius: '4px'
      }">
        <div v-if="currentStack === 'original'">{{ error.stack }}</div>
        <div v-else>{{ error.mappedStack }}</div>
      </div>
    </div>

    <div
      v-if="aiAnalysis"
      :style="{ marginBottom: '20px', background: '#e8f4f8', padding: '15px' }"
    >
      <h3>AI Analysis</h3>
      <p>{{ aiAnalysis }}</p>
    </div>

    <div>
      <h3>User Agent</h3>
      <p>{{ error.userAgent }}</p>
    </div>
  </div>
</template>

<script>
// 堆栈显示状态
let currentStack = 'original';

// 暴露给模板
defineExpose({
  currentStack
});
</script>
