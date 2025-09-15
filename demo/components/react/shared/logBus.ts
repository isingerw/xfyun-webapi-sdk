type Listener = (entry: Record<string, any>) => void;

// 扩展Window接口以包含unifiedLogPanel
declare global {
  interface Window {
    unifiedLogPanel?: {
      addLog: (entry: Record<string, any>) => void;
    };
  }
}

const listeners: Set<Listener> = new Set();

export function publishLog(entry: Record<string, any>) {
  for (const l of listeners) {
    try {
      l(entry);
    } catch {}
  }

  // 同时发送到统一日志面板
  if (window.unifiedLogPanel && window.unifiedLogPanel.addLog) {
    window.unifiedLogPanel.addLog(entry);
  }
}

export function subscribeLog(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
