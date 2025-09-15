/**
 * 共享的日志管理Hook
 * 统一日志格式和处理
 */
import { ref } from "vue";

export function useLogging(componentName = "Component") {
  const logs = ref([]);

  // 追加日志
  const appendLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.value.push({
      timestamp,
      message,
      component: componentName,
    });

    // 限制日志数量，避免内存泄漏
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(-50);
    }
  };

  // 安全发布日志到全局日志系统
  const safePublishLog = async (panel, level, message, payload) => {
    try {
      const { safePublishLog: publishLog } = await import("../logUtils");
      publishLog(panel, level, message, payload);
    } catch (error) {
      console.warn(`[${componentName}] Failed to publish log:`, error);
    }
  };

  // 组合日志函数
  const addLog = (message, level = "info", payload = null) => {
    appendLog(message);
    safePublishLog(componentName, level, message, payload);
  };

  // 清空日志
  const clearLogs = () => {
    logs.value = [];
  };

  return {
    logs,
    addLog,
    appendLog,
    safePublishLog,
    clearLogs,
  };
}
