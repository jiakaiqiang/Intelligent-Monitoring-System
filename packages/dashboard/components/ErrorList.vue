<template>
  <div class="error-list-container">
    <!-- 筛选区域 -->
    <div class="filter-bar">
      <el-input
        v-model="projectId"
        placeholder="输入项目 ID"
        style="width: 200px; margin-right: 12px"
      />
      <el-button type="primary" @click="fetchErrors" :loading="loading">
        查询
      </el-button>
      <el-button @click="refreshErrors" :loading="loading">
        刷新
      </el-button>
    </div>

    <!-- 类型筛选标签 -->
    <div class="type-filter">
      <span style="margin-right: 8px">类型筛选:</span>
      <el-tag
        v-for="type in errorTypes"
        :key="type.value"
        :type="selectedType === type.value ? '' : 'info'"
        :effect="selectedType === type.value ? 'dark' : 'plain'"
        style="margin-right: 8px; cursor: pointer"
        @click="filterByType(type.value)"
      >
        {{ type.label }}
      </el-tag>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <el-empty v-else-if="filteredErrors.length === 0" description="暂无异常数据" />

    <!-- 异常列表 -->
    <el-collapse v-else v-model="activeNames" class="error-collapse">
      <el-collapse-item
        v-for="(error, index) in filteredErrors"
        :key="index"
        :name="index"
      >
        <template #title>
          <div class="error-header">
            <el-tag :type="getTagType(error.type)" size="small">
              {{ getTypeLabel(error.type) }}
            </el-tag>
            <span class="error-message">{{ error.message }}</span>
            <span class="error-time">
              {{ formatTime(error.timestamp) }}
            </span>
            <el-tag v-if="error.version" type="info" size="small" effect="plain">
              v{{ error.version }}
            </el-tag>
          </div>
        </template>

        <div class="error-detail">
          <div class="detail-row">
            <span class="label">URL:</span>
            <span class="value">{{ error.url }}</span>
          </div>
          <div class="detail-row">
            <span class="label">User Agent:</span>
            <span class="value">{{ error.userAgent }}</span>
          </div>
          <div v-if="error.stack" class="detail-row stack-trace">
            <span class="label">Stack Trace:</span>
            <pre class="stack-content">{{ error.stack }}</pre>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import type { ErrorInfo } from '@monitor/shared/types';

const projectId = ref('default');
const errors = ref<ErrorInfo[]>([]);
const loading = ref(false);
const activeNames = ref<number[]>([]);
const selectedType = ref<string>('all');

const errorTypes = [
  { value: 'all', label: '全部' },
  { value: 'js', label: 'JavaScript' },
  { value: 'promise', label: 'Promise' },
  { value: 'resource', label: 'Resource' },
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
    const response = await fetch(`http://10.173.26.56:3000/api/reports/${projectId.value}`,{
      method:'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  
    const result = await response.json();
    console.log(result, 'result');
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

const getTagType = (type: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  switch (type) {
    case 'js':
      return 'danger';
    case 'promise':
      return 'warning';
    case 'resource':
      return 'info';
    default:
      return '';
  }
};

const getTypeLabel = (type: string): string => {
  const found = errorTypes.find((t) => t.value === type);
  return found ? found.label : type;
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

onMounted(() => {
  fetchErrors();
});
</script>

<style scoped>
.error-list-container {
  padding: 20px;
}

.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.type-filter {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.loading-container .el-icon {
  margin-right: 8px;
  font-size: 20px;
}

.error-collapse {
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  overflow: hidden;
}

.error-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.error-time {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.error-detail {
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}

.detail-row {
  margin-bottom: 8px;
  display: flex;
}

.detail-row .label {
  width: 100px;
  flex-shrink: 0;
  color: #606266;
  font-weight: 500;
}

.detail-row .value {
  flex: 1;
  word-break: break-all;
  color: #303133;
}

.stack-trace {
  flex-direction: column;
}

.stack-trace .label {
  margin-bottom: 8px;
}

.stack-content {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
