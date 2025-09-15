<template>
  <div
    v-if="visible"
    :style="{
      position: 'fixed',
      left: pos.x + 'px',
      top: pos.y + 'px',
      zIndex: 9999,
      width: size.w + 'px',
    }"
  >
    <div
      style="
        border: 1px solid #e5e5e5;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      "
    >
      <div
        @mousedown="onMouseDown"
        style="
          cursor: move;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
          border-radius: 12px 12px 0 0;
        "
      >
        <div style="font-weight: 600; color: #1f1f1f; font-size: 14px">
          统一日志 (onLog)
        </div>
        <div style="display: flex; gap: 8px">
          <button
            class="ant-btn ant-btn-sm"
            @click="logs = []"
            style="
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid #d9d9d9;
              background: #fff;
              font-size: 12px;
            "
          >
            清空
          </button>
          <button
            class="ant-btn ant-btn-sm"
            @click="visible = false"
            style="
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid #d9d9d9;
              background: #fff;
              font-size: 12px;
            "
          >
            隐藏
          </button>
          <button
            class="ant-btn ant-btn-sm"
            @click="exportLogs"
            style="
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid #d9d9d9;
              background: #fff;
              font-size: 12px;
            "
          >
            导出
          </button>
        </div>
      </div>
      <div
        ref="bodyRef"
        class="log-body"
        :style="{
          maxHeight: size.h - 80 + 'px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '12px 16px',
          textAlign: 'left',
          background: '#fafafa',
          lineHeight: '1.5',
        }"
      >
        <div v-if="logs.length === 0" style="color: #999">暂无日志</div>
        <template v-else>
          <div
            v-for="(l, i) in logs"
            :key="i"
            :style="{ color: colorOf(l.level) }"
          >
            {{ format(l) }}
          </div>
        </template>
      </div>
      <div
        @mousedown.stop="onResizeDown"
        style="
          height: 12px;
          cursor: nwse-resize;
          border-top: 1px solid #f0f0f0;
          background: #f5f5f5;
          border-radius: 0 0 12px 12px;
        "
      ></div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from "vue";
import { subscribeLog } from "./logBus";

export default {
  name: "LogPanel",
  setup() {
    const logs = ref([]);
    const visible = ref(false);
    const pos = ref({ x: 20, y: 20 });
    const size = ref({ w: 500, h: 500 });
    const dragging = ref(false);
    const dragOffset = ref({ dx: 0, dy: 0 });
    const bodyRef = ref(null);

    const unsub = subscribeLog((e) => {
      const ts = new Date().toLocaleTimeString();
      const level = e.level || "info";
      const line = { ts, level, ...e };
      logs.value = [...logs.value.slice(-199), line];
      if (!visible.value && logs.value.length > 0) visible.value = true;
      requestAnimationFrame(() => {
        try {
          const b = bodyRef.value;
          if (b) b.scrollTop = b.scrollHeight;
        } catch (e) {
          console.warn("[LogPanel] auto-scroll failed", e);
        }
      });
    });

    onBeforeUnmount(() => {
      try {
        unsub();
      } catch (e) {
        console.warn("[LogPanel] unsubscribe failed", e);
      }
    });

    function onMouseDown(ev) {
      dragging.value = true;
      dragOffset.value = {
        dx: ev.clientX - pos.value.x,
        dy: ev.clientY - pos.value.y,
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp, { once: true });
    }

    function onMouseMove(ev) {
      if (!dragging.value) return;
      pos.value = {
        x: ev.clientX - dragOffset.value.dx,
        y: ev.clientY - dragOffset.value.dy,
      };
    }

    function onMouseUp() {
      dragging.value = false;
      window.removeEventListener("mousemove", onMouseMove);
    }

    function onResizeDown(ev) {
      const sx = ev.clientX,
        sy = ev.clientY,
        sw = size.value.w,
        sh = size.value.h;
      const move = (e) => {
        size.value = {
          w: Math.max(400, sw + (e.clientX - sx)),
          h: Math.max(500, sh + (e.clientY - sy)),
        };
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    function colorOf(level) {
      return level === "error"
        ? "#ff4d4f"
        : level === "warn"
          ? "#faad14"
          : "#1677ff";
    }

    function format(l) {
      try {
        return `[${l.ts}] ${l.panel || ""} ${l.event || l.message || ""}`;
      } catch (e) {
        console.warn("[LogPanel] format failed", e);
        return String(l);
      }
    }

    function exportLogs() {
      try {
        const blob = new Blob(
          [logs.value.map((l) => `[${l.ts}] ${JSON.stringify(l)}`).join("\n")],
          { type: "text/plain" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `onlog-${Date.now()}.log`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("[LogPanel] export failed", e);
      }
    }

    return {
      logs,
      visible,
      pos,
      size,
      bodyRef,
      onMouseDown,
      onResizeDown,
      colorOf,
      format,
      exportLogs,
    };
  },
};
</script>

<style scoped></style>
