import { publishLog } from "./logBus";

/**
 * 追加一条带时间戳的日志到组件本地 logs 列表（最多200条）。
 * @param {import('vue').Ref<Array<string>>} logsRef - 本地日志 ref
 * @param {string} message - 日志文本
 * @returns {void}
 */
export function appendLog(logsRef, message) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${message}`;
  logsRef.value = [...logsRef.value.slice(-199), line];
}

/**
 * 安全地向全局日志面板发布 onLog 事件。
 * @param {string} panel - 面板名称，如 'IAT' | 'RTASR' | 'TTS' | 'DTS'
 * @param {'info'|'warn'|'error'} level - 日志级别
 * @param {string} message - 简要描述
 * @param {Record<string, any>} [extra] - 额外负载（如 sid、event 等）
 */
export function safePublishLog(panel, level, message, extra) {
  try {
    publishLog({ panel, level, message, ...(extra || {}) });

    // 同时发送到统一日志面板
    if (window.unifiedLogPanel && window.unifiedLogPanel.addLog) {
      window.unifiedLogPanel.addLog({
        panel,
        level,
        message,
        ...(extra || {}),
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[${panel}] publishLog failed`, e);
  }
}
