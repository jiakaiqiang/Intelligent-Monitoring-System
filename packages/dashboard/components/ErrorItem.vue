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

    <!-- 映射状态显示 -->
    <div v-if="error.sourceFile" :style="{ marginBottom: '8px' }">
      <span :style="{
        background: '#f6ffed',
        color: '#52c41a',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }">
        <span>✓</span> Mapped
      </span>
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
        color: '#0050b3',
        cursor: 'pointer'
      }" @click="$emit('view-source', error)">
        <span :style="{ marginRight: '8px' }">📍 {{ error.sourceFile }}</span>
        <span v-if="error.sourceLine">:{{ error.sourceLine }}</span>
        <span v-if="error.sourceColumn">:{{ error.sourceColumn }}</span>
        <span :style="{ marginLeft: '8px', color: '#1890ff' }">→</span>
      </div>
    </div>

    <!-- 未映射提示和映射按钮 -->
    <div v-else-if="!error.sourceFile" :style="{ marginBottom: '8px' }">
      <div :style="{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#fff7e6',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        color: '#d46b08'
      }">
        <span :style="{ marginRight: '5px' }">⚠️</span>
        <span>Source mapping not available</span>
      </div>
      <button
        v-if="!mappingInProgress"
        @click="$emit('map-error', error)"
        :style="{
          marginLeft: '10px',
          padding: '4px 8px',
          background: '#52c41a',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          fontSize: '11px',
          cursor: 'pointer'
        }"
      >
        Map to Source
      </button>
      <button
        v-else
        :style="{
          marginLeft: '10px',
          padding: '4px 8px',
          background: '#d9d9d9',
          color: '999',
          border: 'none',
          borderRadius: '3px',
          fontSize: '11px',
          cursor: 'not-allowed'
        }"
      >
        Mapping...
      </button>
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
    <div v-if="error.stack && !expanded" :style="{ marginTop: '8px' }">
      <button
        @click="expanded = true"
        :style="{
          padding: '4px 8px',
          background: 'transparent',
          border: 'none',
          color: '#1890ff',
          cursor: 'pointer',
          fontSize: '12px'
        }"
      >
        Show Stack Trace
      </button>
    </div>

    <!-- 子错误列表 -->
    <div v-if="expanded" :style="{ marginTop: '12px', marginLeft: '20px' }">
      <div v-for="subError in subErrors" :key="subError.id" :style="{ marginBottom: '8px' }">
        <ErrorItem
          :error="subError"
          @select-error="$emit('select-error', subError)"
          @map-error="$emit('map-error', subError)"
          @view-source="$emit('view-source', subError)"
        />
      </div>
    </div>
  </div>
</template>
          alignItems: 'center',
          gap: '5px'
        }"
      >
        <span>👁️ View Source</span>
      </button>

      <button
        @click="expanded = !expanded"
        :style="{
          padding: '4px 8px',
          background: 'transparent',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: '12px'
        }"
      >
        {{ expanded ? 'Hide Stack' : 'Show Stack' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ErrorInfo } from '@monitor/shared/types';

interface Props {
  error: ErrorInfo;
}

const props = defineProps<Props>();
const emit = defineEmits(['select-error', 'map-error', 'view-source']);

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

// 提供方法给模板
defineExpose({
  getFirstStackLine
});
</script>