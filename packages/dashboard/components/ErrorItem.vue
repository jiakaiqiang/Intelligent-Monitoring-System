<template>
  <div :style="{ padding: '10px', borderLeft: '4px solid #ff4d4f', marginBottom: '16px' }">
    <div :style="{ marginBottom: '8px' }">
      <span :style="{
        background: error.type === 'js' ? '#fff2e8' :
                   error.type === 'promise' ? '#f6ffed' : '#e6f7ff',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '12px',
        color: '#666'
      }">
        {{ error.type === 'js' ? 'JavaScript' :
            error.type === 'promise' ? 'Promise' : 'Resource' }}
      </span>
      <span :style="{
        marginLeft: '10px',
        color: '#999',
        fontSize: '12px'
      }">
        {{ new Date(error.timestamp).toLocaleTimeString() }}
      </span>
      <span v-if="error.version" :style="{
        marginLeft: '10px',
        background: '#f0f0f0',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px'
      }">
        v{{ error.version }}
      </span>
    </div>

    <div :style="{ marginBottom: '8px' }">
      <h4 :style="{ margin: 0, color: '#333', fontSize: '14px' }">
        {{ error.message }}
      </h4>
    </div>

    <!-- 映射后的源码位置 -->
    <div v-if="error.sourceFile" :style="{ marginBottom: '8px' }">
      <div :style="{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#e6f7ff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#0050b3'
      }">
        <span :style="{ marginRight: '8px' }">📍 {{ error.sourceFile }}</span>
        <span v-if="error.sourceLine">:{{ error.sourceLine }}</span>
        <span v-if="error.sourceColumn">:{{ error.sourceColumn }}</span>
      </div>
    </div>

    <!-- 堆栈预览 -->
    <div v-if="error.stack" :style="{
      marginTop: '8px',
      fontSize: '12px',
      color: '#666',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '600px'
    }">
      {{ getFirstStackLine(error.stack) }}
    </div>

    <!-- 展开/收起按钮 -->
    <button
      v-if="error.stack"
      @click="expanded = !expanded"
      :style="{
        marginTop: '8px',
        padding: '4px 8px',
        background: 'transparent',
        border: 'none',
        color: '#1890ff',
        cursor: 'pointer',
        fontSize: '12px'
      }"
    >
      {{ expanded ? 'Collapse' : 'Expand' }}
    </button>

    <!-- 子错误列表 -->
    <div v-if="expanded && subErrors.length > 0" :style="{ marginTop: '12px', marginLeft: '20px' }">
      <div v-for="subError in subErrors" :key="subError.id" :style="{ marginBottom: '8px' }">
        <ErrorItem :error="subError" @click="$emit('select-error', subError)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ErrorInfo } from '@monitor/shared/types';

interface Props {
  error: ErrorInfo;
}

const props = defineProps<Props>();
const expanded = ref(false);
const emit = defineEmits(['select-error']);

// 获取堆栈的第一行
const getFirstStackLine = (stack: string) => {
  const lines = stack.split('\n');
  if (lines.length > 0) {
    return lines[0];
  }
  return '';
};

// 获取子错误（如果有）
const subErrors = computed(() => {
  // 这里可以根据需要实现子错误的逻辑
  return [];
});

// 点击当前错误
const handleClick = () => {
  emit('select-error', props.error);
};

// 点击事件监听
if (typeof window !== 'undefined') {
  const errorElement = document.currentScript?.parentElement;
  if (errorElement) {
    errorElement.style.cursor = 'pointer';
    errorElement.onclick = handleClick;
  }
}
</script>