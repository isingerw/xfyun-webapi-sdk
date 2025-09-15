<template>
  <div class="vue-panel rtasr-demo">
    <h2>实时语音转写 (RTASR)</h2>
    <p class="description">
      支持实时语音转写，将连续语音转换为文字。支持VAD、口音识别、动态修正等功能。
    </p>

    <!-- 基础配置 -->
    <div class="demo-section">
      <h3 class="demo-section-title">基础配置</h3>
      <div class="form-group">
        <label for="serverBase">服务地址</label>
        <input
          id="serverBase"
          v-model="serverBase"
          placeholder="例如：http://localhost:8083"
        />
        <div class="hint">讯飞语音服务的API地址</div>
      </div>
      <div class="form-group">
        <label for="authToken">认证令牌</label>
        <input
          id="authToken"
          v-model="authToken"
          placeholder="可选：Bearer Token"
        />
        <div class="hint">用于身份验证的令牌，可选</div>
      </div>
      <div class="button-group">
        <button
          class="demo-button secondary"
          @click="checkHealth"
          :disabled="healthLoading"
        >
          {{ healthLoading ? "检查中..." : "签名健康检查" }}
        </button>
        <div v-if="healthMsg" class="hint">{{ healthMsg }}</div>
      </div>
    </div>

    <!-- 识别参数 -->
    <div class="demo-section recognition-params">
      <h3 class="demo-section-title">识别参数</h3>
      <div class="grid">
        <div class="form-group">
          <label for="language">识别语言</label>
          <select id="language" v-model="language">
            <option value="zh_cn">中文普通话</option>
            <option value="en_us">美式英语</option>
          </select>
          <div class="hint">选择识别的语言类型</div>
        </div>
        <div class="form-group">
          <label for="accent">口音类型</label>
          <select id="accent" v-model="accent">
            <option value="mandarin">普通话</option>
            <option value="cantonese">粤语</option>
          </select>
          <div class="hint">指定口音类型以提高识别准确率</div>
        </div>
        <div class="form-group">
          <label for="vadEos">VAD静音检测(ms)</label>
          <input
            id="vadEos"
            v-model.number="vadEos"
            type="number"
            min="0"
            max="10000"
            placeholder="2000"
          />
          <div class="hint">语音活动检测的静音时长阈值</div>
        </div>
        <div class="form-group">
          <label for="ptt">标点符号</label>
          <select id="ptt" v-model.number="ptt">
            <option :value="1">开启</option>
            <option :value="0">关闭</option>
          </select>
          <div class="hint">是否在结果中添加标点符号</div>
        </div>
        <div class="form-group">
          <label for="dwaMode">动态修正</label>
          <select id="dwaMode" v-model="dwaMode">
            <option value="none">关闭</option>
            <option value="wpgs">开启</option>
          </select>
          <div class="hint">开启后支持实时修正识别结果</div>
        </div>
        <div class="form-group">
          <label for="heartbeatMs">心跳间隔(ms)</label>
          <input
            id="heartbeatMs"
            v-model.number="heartbeatMs"
            type="number"
            min="1000"
            max="60000"
            placeholder="8000"
          />
          <div class="hint">保持连接的心跳间隔时间</div>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="demo-section">
      <h3 class="demo-section-title">操作控制</h3>
      <div class="button-group">
        <button
          class="demo-button primary"
          :disabled="recognizing || status === 'connecting'"
          @click="start"
        >
          {{ recognizing ? "识别中..." : "开始识别" }}
        </button>
        <button
          class="demo-button secondary"
          @click="stop"
          :disabled="!recognizing"
        >
          停止
        </button>
        <button
          class="demo-button secondary"
          @click="clearResults"
          :disabled="!result && !realTimeResult"
        >
          清除结果
        </button>
        <button class="demo-button secondary" @click="resetSession">
          重置会话
        </button>
        <button class="demo-button secondary" @click="retryConnection">
          重试连接
        </button>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="demo-section">
      <h3 class="demo-section-title">状态信息</h3>
      <div class="status">
        <div class="status-item">
          <span class="label">状态：</span>
          <span class="value" :class="status">{{ status }}</span>
        </div>
        <div v-if="sid" class="status-item">
          <span class="label">SID：</span>
          <span class="value">{{ sid }}</span>
        </div>
        <div class="status-item">
          <span class="label">音量：</span>
          <div class="level-display">
            <div class="level-bar">
              <div
                class="level-fill"
                :style="{ width: audioLevel + '%' }"
              ></div>
            </div>
            <span class="level-text">{{ audioLevel }}%</span>
          </div>
        </div>
        <div v-if="error" class="status-item error">
          <span class="label">错误：</span>
          <span class="value">{{ error }}</span>
        </div>
      </div>
    </div>

    <!-- 识别结果 -->
    <div class="demo-section">
      <h3 class="demo-section-title">识别结果</h3>
      <div class="result-section">
        <div class="result-item">
          <h4>累计结果（{{ sessionResults.length }} 句）</h4>
          <div class="result">
            <pre v-if="result">{{ result }}</pre>
            <div v-else class="empty">暂无累计结果</div>
          </div>
        </div>
        <div class="result-item">
          <h4>当前识别中...</h4>
          <div class="result">
            <pre v-if="realTimeResult && realTimeResult !== result">{{
              realTimeResult
            }}</pre>
            <div v-else class="empty">等待语音输入</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from "vue";
import {
  useRtasr,
  getSharedAudioContext,
  calculateLevel,
  createAudioWorkletProcessor,
  createScriptProcessor,
} from "xfyun-webapi-sdk/vue";
import { appendLog, safePublishLog } from "./logUtils";
import { checkServiceHealth } from "../utils/health";

export default {
  name: "RtasrDemo",
  props: {
    serverBase: {
      type: String,
      default: "http://127.0.0.1:8083"
    },
    authToken: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const serverBase = ref(props.serverBase);
    const authToken = ref(props.authToken);

    const language = ref("zh_cn");
    const accent = ref("mandarin");
    const vadEos = ref(2000);
    const ptt = ref(1);
    const dwaMode = ref("none");
    const heartbeatMs = ref(8000);

    const audioLevel = ref(0);
    const sid = ref("");
    const result = ref("");
    const realTimeResult = ref("");
    const sessionResults = ref([]);
    const logs = ref([]);
    const recognizing = ref(false);
    const healthLoading = ref(false);
    const healthMsg = ref("");

    /**
     * 组件内追加日志并广播到悬浮日志面板。
     * @param {string} m 日志文本
     */
    const addLog = (m) => {
      appendLog(logs, m);
      safePublishLog("RTASR", "info", m);
    };
    const pushFinalText = (text) => {
      const t = (text || "").trim();
      if (!t) return;
      if (!sessionResults.value.includes(t)) {
        const list = [...sessionResults.value, t];
        sessionResults.value = list;
        result.value = list.join(" ");
      }
    };

    const { status, error, open, sendFrame, close } = useRtasr({
      serverBase: serverBase.value,
      getAuthCode: () => authToken.value,
      business: () => ({
        language: language.value,
        domain: "rtasr",
        accent: accent.value,
        vad_eos: vadEos.value,
        ptt: ptt.value,
        ...(dwaMode.value === "wpgs" ? { dwa: "wpgs" } : {}),
      }),
      heartbeatMs: heartbeatMs.value,
      onResult: (text, isFinal) => {
        if (isFinal) {
          pushFinalText(text);
          addLog(`最终结果: ${text}`);
        } else {
          const current = sessionResults.value.join(" ");
          realTimeResult.value = current ? `${current} ${text}` : text;
          addLog(`临时结果: ${text}`);
        }
      },
      onOpen: (s) => {
        sid.value = s || "";
        addLog(`连接已建立，SID: ${s}`);
      },
      onClose: (code, reason) => {
        addLog(`连接已关闭: ${code || ""} ${reason || ""}`);
        // 连接关闭时自动停止识别
        if (recognizing.value) {
          recognizing.value = false;
          audioLevel.value = 0;
          realTimeResult.value = "";
          addLog("RTASR 识别已停止（连接关闭）");
        }
      },
      onMessage: (m) => {
        addLog(`消息: ${JSON.stringify(m)}`);
      },
      onError: (msg) => {
        addLog(`错误: ${msg}`);
        // 发生错误时自动停止识别
        if (recognizing.value) {
          recognizing.value = false;
          audioLevel.value = 0;
          realTimeResult.value = "";
          addLog("RTASR 识别已停止（发生错误）");
        }
      },
      onLog: (lvl, payload) => {
        try {
          safePublishLog(
            "RTASR",
            lvl,
            payload?.message || payload?.event || "event",
            payload,
          );
        } catch (e) {
          addLog("onLog format error");
        }
      },
      maxRetries: 3,
      retryStrategy: {
        retryDelay: 800,
        backoffMultiplier: 2,
        maxRetryDelay: 8000,
      },
    });

    const mediaStream = ref(null);
    const audioCtx = ref(null);
    const processor = ref(null);
    let pending = new Float32Array(0);

    async function start() {
      if (recognizing.value) return;

      // 先清理之前的资源，确保可以重复调用
      if (mediaStream.value) {
        try {
          mediaStream.value.getTracks().forEach((t) => t.stop());
        } catch (e) {
          addLog("清理媒体流失败: " + ((e && e.message) || e));
        }
        mediaStream.value = null;
      }
      if (processor.value) {
        try {
          processor.value.disconnect();
        } catch (e) {
          addLog("断开处理器失败: " + ((e && e.message) || e));
        }
        processor.value = null;
      }

      realTimeResult.value = "";
      result.value = "";
      sessionResults.value = [];
      logs.value = [];
      sid.value = "";
      pending = new Float32Array(0);

      await open();
      try {
        addLog("申请麦克风权限...");
        mediaStream.value = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        addLog("麦克风权限获取成功");

        audioCtx.value = getSharedAudioContext(16000);
        addLog("AudioContext已准备就绪");
        const source = audioCtx.value.createMediaStreamSource(
          mediaStream.value,
        );
        const processAudio = (float32) => {
          const level = calculateLevel(float32);
          audioLevel.value = level;
          let data = float32;
          if (audioCtx.value.sampleRate !== 16000) {
            const target = Math.round(
              (float32.length * 16000) / audioCtx.value.sampleRate,
            );
            const res = new Float32Array(target);
            for (let i = 0; i < target; i++) {
              res[i] =
                float32[Math.floor((i * audioCtx.value.sampleRate) / 16000)] ||
                0;
            }
            data = res;
          }
          if (pending.length === 0) {
            pending = data.slice();
          } else {
            const m = new Float32Array(pending.length + data.length);
            m.set(pending, 0);
            m.set(data, pending.length);
            pending = m;
          }
          while (pending.length >= 640) {
            const slice = pending.subarray(0, 640);
            const remain = pending.subarray(640);
            const remainCopy = new Float32Array(remain.length);
            remainCopy.set(remain);
            pending = remainCopy;
            const buf = new ArrayBuffer(640 * 2);
            const view = new DataView(buf);
            for (let i = 0; i < 640; i++) {
              const s = Math.max(-1, Math.min(1, slice[i] || 0));
              view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            }
            sendFrame(buf, false);
          }
        };
        try {
          processor.value = await createAudioWorkletProcessor(
            audioCtx.value,
            processAudio,
          );
          source.connect(processor.value);
          processor.value.connect(audioCtx.value.destination);
          addLog("使用AudioWorklet处理器");
        } catch (e) {
          addLog("AudioWorklet不可用，使用ScriptProcessor");
          console.warn("worklet not available", e);
          processor.value = createScriptProcessor(audioCtx.value, processAudio);
          source.connect(processor.value);
          processor.value.connect(audioCtx.value.destination);
        }
        recognizing.value = true;
        addLog("语音识别已开始，请说话...");
      } catch (e) {
        console.warn("rtasr start error", e);
      }
    }

    function stop() {
      if (!recognizing.value) return; // 防止重复调用

      try {
        sendFrame(new ArrayBuffer(0), true);
      } catch (e) {
        addLog("结束帧发送失败: " + ((e && e.message) || e));
      }
      setTimeout(() => {
        try {
          close();
        } catch (e) {
          addLog("关闭连接失败: " + ((e && e.message) || e));
        }
      }, 200);
      try {
        processor.value &&
          processor.value.disconnect &&
          processor.value.disconnect();
      } catch (e) {
        addLog("处理器断开失败: " + ((e && e.message) || e));
      }
      try {
        mediaStream.value &&
          mediaStream.value.getTracks &&
          mediaStream.value.getTracks().forEach((t) => t.stop());
      } catch (e) {
        addLog("媒体流停止失败: " + ((e && e.message) || e));
      }

      // 不关闭共享的AudioContext，只清理引用
      // 共享AudioContext由SDK管理，不应该在这里关闭

      processor.value = null;
      mediaStream.value = null;
      // audioCtx.value = null  // 不清理共享AudioContext引用
      recognizing.value = false;
      audioLevel.value = 0;
      realTimeResult.value = "";
      addLog("语音识别已停止");
    }

    function clearResults() {
      result.value = "";
      realTimeResult.value = "";
      sessionResults.value = [];
      addLog("识别结果已清除");
    }
    function resetSession() {
      stop();
      result.value = "";
      realTimeResult.value = "";
      sessionResults.value = [];
      logs.value = [];
      sid.value = "";
      addLog("会话已重置");
    }
    function retryConnection() {
      addLog("手动重试连接...");
      open().catch((e) => addLog(`重试失败: ${(e && e.message) || e}`));
    }

    onBeforeUnmount(() => {
      if (recognizing.value) stop();
    });

    async function checkHealth() {
      try {
        healthLoading.value = true;
        healthMsg.value = "";
        const r = await checkServiceHealth(serverBase.value, 'rtasr', authToken.value);
        if (r.ok) {
          const m = `RTASR服务：OK (${r.status || ""}) @ ${r.endpoint || ""}`;
          healthMsg.value = m;
          addLog(m);
        } else {
          const m = `RTASR服务：失败 ${r.status || ""} ${r.error || ""}`;
          healthMsg.value = m;
          addLog(m);
        }
      } catch (e) {
        const m = `健康检查异常：${(e && e.message) || e}`;
        healthMsg.value = m;
        addLog(m);
      } finally {
        healthLoading.value = false;
      }
    }

    return {
      serverBase,
      authToken,
      language,
      accent,
      vadEos,
      ptt,
      dwaMode,
      heartbeatMs,
      status,
      error,
      recognizing,
      audioLevel,
      sid,
      result,
      realTimeResult,
      sessionResults,
      logs,
      start,
      stop,
      clearResults,
      resetSession,
      retryConnection,
      healthLoading,
      healthMsg,
      checkHealth,
    };
  },
};
</script>

<style scoped>
.rtasr-demo {
  max-width: 95%;
  width: 95%;
  margin: 24px auto;
  text-align: left;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
  max-height: calc(95vh - 120px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  overflow-y: auto
}

h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #1f1f1f;
}

.description {
  margin: 0 0 24px;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.section {
  margin-bottom: 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e6f7ff;
  padding-bottom: 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
}

.hint {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.level-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.level-fill {
  height: 100%;
  background: linear-gradient(90deg, #52c41a, #1890ff);
  transition: width 0.3s ease;
}

.level-text {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: right;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

button {
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fafafa;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 120px;
}

button.primary {
  background: #1677ff;
  color: white;
  border-color: #1677ff;
}

button.primary:hover:not(:disabled) {
  background: #4096ff;
  border-color: #4096ff;
}

button.secondary {
  background: #fff;
  color: #333;
}

button.secondary:hover:not(:disabled) {
  background: #f0f7ff;
  border-color: #91c3ff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  background: #fff;
  border: 1px solid #e6f7ff;
  border-radius: 6px;
  padding: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-item .label {
  font-weight: 500;
  color: #666;
  min-width: 60px;
}

.status-item .value {
  color: #333;
  font-family: monospace;
  font-size: 13px;
}

.status-item .value.connecting {
  color: #1890ff;
}

.status-item .value.recognizing {
  color: #52c41a;
}

.status-item .value.closed {
  color: #999;
}

.status-item.error {
  color: #ff4d4f;
}

.result-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.result-item h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.result {
  background: #f7f9fc;
  border: 1px solid #eef3fb;
  border-radius: 6px;
  padding: 16px;
  min-height: 80px;
}

.result pre {
  margin: 0;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.recognition-params {
  max-height: calc(95vh - 400px);
}

.rtasr-demo-content {
  flex: 1;
  padding-right: 8px;
}

@media (max-width: 768px) {
  .rtasr-demo {
    margin: 12px;
    padding: 16px;
    max-width: 98%;
    width: 98%;
    overflow-y: auto
  }

  .section {
    padding: 16px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .result-section {
    grid-template-columns: 1fr;
  }

  .button-group {
    flex-direction: column;
  }

  button {
    min-width: auto;
  }
}
</style>
