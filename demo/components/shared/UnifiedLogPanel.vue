<template>
  <div
    ref="logPanel"
    class="unified-log-panel"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @mousedown="startDrag"
  >
    <div class="log-header">
      <span class="log-title">统一日志面板</span>
      <div class="log-controls">
        <button @click="clearLogs" class="log-btn">清空</button>
        <button @click="copyLogs" class="log-btn">复制</button>
        <button @click="togglePanel" class="log-btn">
          {{ isMinimized ? "展开" : "收起" }}
        </button>
      </div>
    </div>

    <div v-if="!isMinimized" class="log-content">
      <div ref="logContainer" class="log-container">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="log-item"
          :class="log.level"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-panel">[{{ log.panel }}]</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from "vue";

const logPanel = ref(null);
const logContainer = ref(null);
const logs = ref([]);
const isMinimized = ref(false);
const isDragging = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });
const position = reactive({ x: 20, y: 20 });

// 监听日志变化，自动滚动到底部
watch(
  logs,
  () => {
    nextTick(() => {
      if (logContainer.value && !isMinimized.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  },
  { deep: true },
);

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// 清空日志
const clearLogs = () => {
  logs.value = [];
};

// 复制日志
const copyLogs = async () => {
  const logText = logs.value
    .map(
      (log) => `[${formatTime(log.timestamp)}] [${log.panel}] ${log.message}`,
    )
    .join("\n");

  try {
    await navigator.clipboard.writeText(logText);
    // 可以添加一个提示
    console.log("日志已复制到剪贴板");
  } catch (err) {
    console.error("复制失败:", err);
  }
};

// 切换面板显示状态
const togglePanel = () => {
  isMinimized.value = !isMinimized.value;
};

// 开始拖动
const startDrag = (e) => {
  if (e.target.closest(".log-controls")) return;

  isDragging.value = true;
  dragOffset.x = e.clientX - position.x;
  dragOffset.y = e.clientY - position.y;

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  e.preventDefault();
};

// 拖动中
const onDrag = (e) => {
  if (!isDragging.value) return;

  position.x = e.clientX - dragOffset.x;
  position.y = e.clientY - dragOffset.y;

  // 严格限制在视窗内
  const panelRect = logPanel.value?.getBoundingClientRect();
  if (panelRect) {
    // 限制左侧和顶部
    if (position.x < 0) position.x = 0;
    if (position.y < 0) position.y = 0;

    // 限制右侧和底部
    if (position.x > window.innerWidth - panelRect.width) {
      position.x = window.innerWidth - panelRect.width;
    }
    if (position.y > window.innerHeight - panelRect.height) {
      position.y = window.innerHeight - panelRect.height;
    }
  }
};

// 停止拖动
const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
};

// 添加日志
const addLog = (logData) => {
  logs.value.push({
    timestamp: Date.now(),
    level: logData.level || "info",
    panel: logData.panel || "Unknown",
    message: logData.message || "",
  });

  // 限制日志数量，避免内存泄漏
  if (logs.value.length > 1000) {
    logs.value = logs.value.slice(-500);
  }
};

// 暴露方法给全局使用
window.unifiedLogPanel = {
  addLog,
};

onMounted(() => {
  // 初始化位置
  position.x = 20;
  position.y = 20;
});

onUnmounted(() => {
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
});
</script>

<style scoped>
.unified-log-panel {
  position: fixed;
  width: 400px;
  max-height: 500px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 99999;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 12px;
  user-select: none;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1763ff;
  color: white;
  border-radius: 8px 8px 0 0;
  cursor: move;
}

.log-title {
  font-weight: 600;
  font-size: 14px;
}

.log-controls {
  display: flex;
  gap: 4px;
}

.log-btn {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.log-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.log-content {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: #f8f9fa;
}

.log-item {
  display: flex;
  margin-bottom: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  background: white;
  border-left: 3px solid #1763ff;
  text-align: left;
  word-break: break-all;
}

.log-item.error {
  border-left-color: #ff4d4f;
  background: #fff2f0;
}

.log-item.warning {
  border-left-color: #faad14;
  background: #fffbe6;
}

.log-item.success {
  border-left-color: #52c41a;
  background: #f6ffed;
}

.log-time {
  color: #666;
  margin-right: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-panel {
  color: #1763ff;
  font-weight: 600;
  margin-right: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-message {
  color: #333;
  flex: 1;
}

.log-empty {
  text-align: center;
  color: #999;
  padding: 20px;
  font-style: italic;
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式 */
@media (max-width: 768px) {
  .unified-log-panel {
    width: 90vw;
    max-width: 400px;
  }

  .log-content {
    height: 300px;
  }
}
</style>
