<template>
  <div class="vue-panel iat-demo">
    <h2>语音听写 (IAT)</h2>
    <p class="description">
      支持实时语音识别，将语音转换为文字。支持便捷模式和手动模式。
    </p>
    <div class="iat-demo-content">

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

    <!-- 录音模式 -->
    <div class="demo-section">
      <h3 class="demo-section-title">录音模式</h3>
      <div class="form-group">
        <label for="simpleMode">便捷模式</label>
        <select id="simpleMode" v-model="simpleMode">
          <option value="on">开启 - 自动录音和分帧</option>
          <option value="off">关闭 - 手动控制录音</option>
        </select>
        <div class="hint">开启后自动处理录音和音频分帧，简化操作</div>
      </div>
      <div class="form-group">
        <label>音量监控</label>
        <div class="level-display">
          <div class="level-bar">
            <div
              class="level-fill"
              :style="{
                width:
                  (simpleMode === 'on' && recorder ? recorder.level : level) +
                  '%',
              }"
            ></div>
          </div>
          <span class="level-text"
            >{{
              simpleMode === "on" && recorder ? recorder.level : level
            }}%</span
          >
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="demo-section">
      <h3 class="demo-section-title">操作控制</h3>
      <div class="button-group">
        <button
          class="demo-button primary"
          :disabled="recording || status === 'connecting'"
          @click="start"
        >
          {{ recording ? "录音中..." : "开始录音并识别" }}
        </button>
        <button
          class="demo-button secondary"
          :disabled="!recording"
          @click="stop"
        >
          停止
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
        <div class="status-item">
          <span class="label">识别状态：</span>
          <span class="value" :class="{ recognizing: isRecognizing }">
            {{ isRecognizing ? "识别中" : "空闲" }}
          </span>
        </div>
        <div v-if="sid" class="status-item">
          <span class="label">SID：</span>
          <span class="value">{{ sid }}</span>
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
      <div class="result">
        <div v-if="tempText && !finalText" class="temp-result">
          <div class="result-label">临时结果：</div>
          <pre>{{ tempText }}</pre>
        </div>
        <div v-if="finalText" class="final-result">
          <div class="result-label">最终结果：</div>
          <pre>{{ finalText }}</pre>
        </div>
        <div v-if="!tempText && !finalText" class="empty">等待语音输入...</div>
      </div>
    </div>

    <!-- 高级参数 -->
    <div class="demo-section advanced-params">
      <h3 class="demo-section-title">高级参数</h3>
      <div class="grid">
        <div class="form-group">
          <label for="vinfo">语音信息</label>
          <select id="vinfo" v-model.number="vinfo">
            <option :value="undefined">默认</option>
            <option :value="1">开启</option>
            <option :value="0">关闭</option>
          </select>
          <div class="hint">是否返回语音信息</div>
        </div>
        <div class="form-group">
          <label for="rst">结果格式</label>
          <input id="rst" v-model="rst" placeholder="plain 或 json" />
          <div class="hint">返回结果的格式类型</div>
        </div>
        <div class="form-group">
          <label for="rlang">识别语言</label>
          <input id="rlang" v-model="rlang" placeholder="如 zh-cn/en-us" />
          <div class="hint">指定识别语言，如 zh-cn、en-us</div>
        </div>
        <div class="form-group">
          <label for="pd">产品形态</label>
          <input id="pd" v-model="pd" placeholder="产品形态" />
          <div class="hint">指定产品形态参数</div>
        </div>
        <div class="form-group">
          <label for="pdEngine">引擎</label>
          <input id="pdEngine" v-model="pdEngine" placeholder="引擎" />
          <div class="hint">指定使用的识别引擎</div>
        </div>
        <div class="form-group">
          <label for="nbest">候选结果数</label>
          <input
            id="nbest"
            v-model.number="nbest"
            type="number"
            min="1"
            placeholder="1"
          />
          <div class="hint">返回的候选结果数量</div>
        </div>
        <div class="form-group">
          <label for="wbest">词候选数</label>
          <input
            id="wbest"
            v-model.number="wbest"
            type="number"
            min="1"
            placeholder="1"
          />
          <div class="hint">每个词的候选结果数量</div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount, watch } from "vue";
import {
  useIat,
  useIatRecorder,
  IatClient,
  createAudioWorkletProcessor,
  createScriptProcessor,
  getSharedAudioContext,
  calculateLevel,
} from "xfyun-webapi-sdk/vue";
import { appendLog, safePublishLog } from "./logUtils";
import { checkServiceHealth } from "../utils/health";

export default {
  name: "IatDemo",
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

    const text = ref("");
    const finalText = ref(""); // 最终识别结果
    const tempText = ref(""); // 临时识别结果
    const sid = ref("");
    const recording = ref(false);
    const level = ref(0);
    const simpleMode = ref("off");
    const audioCtx = ref(null);
    const audioCtxClosed = ref(false);
    const mediaStream = ref(null);
    const processor = ref(null);
    const logs = ref([]);
    const healthLoading = ref(false);
    const healthMsg = ref("");
    const isRecognizing = ref(false); // 是否正在识别中
    /**
     * 组件内追加日志并广播到悬浮日志面板。
     * @param {string} m 日志文本
     */
    const addLog = (m) => {
      appendLog(logs, m);
      safePublishLog("IAT", "info", m);
    };
    let pending = new Float32Array(0);

    // 进阶 business 选项
    const vinfo = ref(undefined);
    const rst = ref("");
    const rlang = ref("");
    const pd = ref("");
    const pdEngine = ref("");
    const nbest = ref(undefined);
    const wbest = ref(undefined);

    // 创建业务参数对象
    const businessParams = ref({
      language: "zh_cn",
      vad_eos: 2000,
      ptt: 1,
      ...(vinfo.value !== undefined ? { vinfo: vinfo.value } : {}),
      ...(rst.value ? { rst: rst.value } : {}),
      ...(rlang.value ? { rlang: rlang.value } : {}),
      ...(pd.value ? { pd: pd.value } : {}),
      ...(pdEngine.value ? { pd_engine: pdEngine.value } : {}),
      ...(nbest.value !== undefined ? { nbest: nbest.value } : {}),
      ...(wbest.value !== undefined ? { wbest: wbest.value } : {}),
    });

    // 监听参数变化，更新业务参数
    watch([vinfo, rst, rlang, pd, pdEngine, nbest, wbest], () => {
      businessParams.value = {
        language: "zh_cn",
        vad_eos: 2000,
        ptt: 1,
        ...(vinfo.value !== undefined ? { vinfo: vinfo.value } : {}),
        ...(rst.value ? { rst: rst.value } : {}),
        ...(rlang.value ? { rlang: rlang.value } : {}),
        ...(pd.value ? { pd: pd.value } : {}),
        ...(pdEngine.value ? { pd_engine: pdEngine.value } : {}),
        ...(nbest.value !== undefined ? { nbest: nbest.value } : {}),
        ...(wbest.value !== undefined ? { wbest: wbest.value } : {}),
      };
    });

    // 监听模式切换，清理状态
    watch(simpleMode, (newMode, oldMode) => {
      if (recording.value) {
        addLog(`模式切换：${oldMode} -> ${newMode}，停止当前录音`);
        stop();
      }
    });

    const iatOptions = {
      serverBase: serverBase.value,
      getAuthCode: () => authToken.value,
      business: businessParams.value,
      onResult: (t, isFinal) => {
        if (isFinal) {
          // 最终结果
          finalText.value = t;
          text.value = t;
          isRecognizing.value = false;
          addLog(`识别完成: ${t}`);
        } else {
          // 临时结果
          tempText.value = t;
          text.value = t;
          isRecognizing.value = true;
          addLog(`临时结果: ${t}`);
        }
      },
      onOpen: (s) => {
        sid.value = s || "";
        addLog(`连接已建立，SID: ${s}`);
      },
      onMessage: (msg) => {
        addLog(`消息: ${JSON.stringify(msg)}`);
      },
      onClose: (code, reason) => {
        addLog(`连接已关闭: ${code || ""} ${reason || ""}`);
        isRecognizing.value = false;
        // 连接关闭时自动停止识别并关闭麦克风
        if (recording.value) {
          addLog("连接关闭，自动停止录音并关闭麦克风");
          try {
            stop(); // 调用stop函数来正确关闭麦克风
          } catch (e) {
            addLog(`自动停止录音失败: ${(e && e.message) || e}`);
          }
        }
      },
      onError: (msg) => {
        addLog(`错误: ${msg}`);
        isRecognizing.value = false;
        // 发生错误时自动停止识别并关闭麦克风
        if (recording.value) {
          addLog("发生错误，自动停止录音并关闭麦克风");
          try {
            stop(); // 调用stop函数来正确关闭麦克风
          } catch (e) {
            addLog(`自动停止录音失败: ${(e && e.message) || e}`);
          }
        }
      },
      onLog: (lvl, payload) => {
        try {
          safePublishLog(
            "IAT",
            lvl,
            payload?.message || payload?.event || "event",
            payload,
          );
        } catch (e) {
          console.warn("[IAT] onLog handle failed", e);
        }
      },
      heartbeatMs: 8000,
      maxRetries: 3,
      retryStrategy: {
        retryDelay: 800,
        backoffMultiplier: 2,
        maxRetryDelay: 8000,
      },
      enableLangCheck: true,
    };
    const { status, error, open, sendFrame, close, reset } = useIat(iatOptions);

    // 便捷模式：使用独立的客户端实例
    const recorderClientRef = ref(null);
    function ensureRecorderClient() {
      if (!recorderClientRef.value) {
        recorderClientRef.value = new IatClient({
          ...iatOptions,
          business: businessParams.value,
          onResult: (t, isFinal) => {
            if (isFinal) {
              // 最终结果
              finalText.value = t;
              text.value = t;
              isRecognizing.value = false;
              addLog(`识别完成: ${t}`);
            } else {
              // 临时结果
              tempText.value = t;
              text.value = t;
              isRecognizing.value = true;
              addLog(`临时结果: ${t}`);
            }
          },
          onOpen: (s) => {
            sid.value = s || "";
            addLog(`连接已建立，SID: ${s}`);
          },
          onMessage: (msg) => {
            addLog(`消息: ${JSON.stringify(msg)}`);
          },
          onClose: (code, reason) => {
            addLog(`连接已关闭: ${code || ""} ${reason || ""}`);
            isRecognizing.value = false;
            // 连接关闭时自动停止识别并关闭麦克风
            if (recording.value) {
              addLog("连接关闭，自动停止录音并关闭麦克风");
              try {
                stop(); // 调用stop函数来正确关闭麦克风
              } catch (e) {
                addLog(`自动停止录音失败: ${(e && e.message) || e}`);
              }
            }
          },
          onError: (msg) => {
            addLog(`错误: ${msg}`);
            isRecognizing.value = false;
            // 发生错误时自动停止识别并关闭麦克风
            if (recording.value) {
              addLog("发生错误，自动停止录音并关闭麦克风");
              try {
                stop(); // 调用stop函数来正确关闭麦克风
              } catch (e) {
                addLog(`自动停止录音失败: ${(e && e.message) || e}`);
              }
            }
          },
        });
      }
      return recorderClientRef.value;
    }
    const recorder = useIatRecorder({
      client: ensureRecorderClient(),
      frameMs: 40,
      vadThreshold: 10,
    });

    async function start() {
      if (recording.value) return;

      // 先停止之前的录音
      if (simpleMode.value === "on" && recorder.recording.value) {
        try {
          recorder.stop();
        } catch (e) {
          addLog("停止便捷模式失败: " + ((e && e.message) || e));
        }
      }

      text.value = "";
      sid.value = "";
      pending = new Float32Array(0);
      audioCtxClosed.value = false;

      if (simpleMode.value === "on") {
        try {
          // 重置便捷模式客户端
          recorderClientRef.value = null;
          await recorder.start();
          recording.value = true;
          level.value = 0;
          addLog("便捷模式：开始录音");
        } catch (e) {
          addLog("便捷模式启动失败: " + ((e && e.message) || e));
        }
        return;
      }

      // 手动模式：重置客户端并打开连接
      reset();

      try {
        await open();
        addLog("WebSocket连接已建立");
      } catch (e) {
        addLog("WebSocket连接失败: " + ((e && e.message) || e));
        return;
      }

      try {
        // 先清理之前的资源
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

        addLog("申请麦克风权限...");
        mediaStream.value = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000 },
        });
        addLog("麦克风权限获取成功");

        audioCtx.value = getSharedAudioContext(16000);
        addLog("AudioContext已准备就绪");
        const source = audioCtx.value.createMediaStreamSource(
          mediaStream.value,
        );

        const onChunk = (float32) => {
          level.value = calculateLevel(float32);
          let data = float32;
          if (audioCtx.value.sampleRate !== 16000) {
            const len = Math.round(
              (float32.length * 16000) / audioCtx.value.sampleRate,
            );
            const r = new Float32Array(len);
            for (let i = 0; i < len; i++) {
              r[i] =
                float32[Math.floor((i * audioCtx.value.sampleRate) / 16000)] ||
                0;
            }
            data = r;
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
          addLog("尝试使用AudioWorklet...");
          processor.value = await createAudioWorkletProcessor(
            audioCtx.value,
            onChunk,
          );
          source.connect(processor.value);
          processor.value.connect(audioCtx.value.destination);
          addLog("AudioWorklet处理器已启动");
        } catch (e) {
          addLog(
            "AudioWorklet不可用，回退到ScriptProcessor: " +
              ((e && e.message) || e),
          );
          processor.value = createScriptProcessor(audioCtx.value, onChunk);
          source.connect(processor.value);
          processor.value.connect(audioCtx.value.destination);
          addLog("ScriptProcessor处理器已启动");
        }
      } catch (e) {
        addLog("启动失败: " + ((e && e.message) || e));
        return;
      }

      recording.value = true;
    }

    function stop() {
      if (!recording.value) return;

      if (simpleMode.value === "on") {
        try {
          recorder.stop();
        } catch (e) {
          addLog("便捷模式停止失败: " + ((e && e.message) || e));
        }
        recording.value = false;
        level.value = 0;
        addLog("识别已停止");
        return;
      }

      // 手动模式停止
      try {
        sendFrame(new ArrayBuffer(0), true);
      } catch (e) {
        addLog("结束帧发送失败: " + ((e && e.message) || e));
      }
      try {
        close();
      } catch (e) {
        addLog("关闭连接失败: " + ((e && e.message) || e));
      }
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

      // 清理资源
      processor.value = null;
      mediaStream.value = null;
      // audioCtx.value = null  // 不清理共享AudioContext引用
      recording.value = false;
      level.value = 0;
      addLog("识别已停止");
    }

    onBeforeUnmount(() => {
      if (recording.value) {
        stop();
      }
    });

    async function checkHealth() {
      try {
        healthLoading.value = true;
        healthMsg.value = "";
        const r = await checkServiceHealth(serverBase.value, 'iat', authToken.value);
        if (r.ok) {
          const m = `IAT服务：OK (${r.status || ""}) @ ${r.endpoint || ""}`;
          healthMsg.value = m;
          addLog(m);
        } else {
          const m = `IAT服务：失败 ${r.status || ""} ${r.error || ""}`;
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
      status,
      error,
      text,
      finalText,
      tempText,
      sid,
      recording,
      level,
      simpleMode,
      recorder,
      logs,
      healthLoading,
      healthMsg,
      isRecognizing,
      checkHealth,
      // 进阶UI
      vinfo,
      rst,
      rlang,
      pd,
      pdEngine,
      nbest,
      wbest,
      start,
      stop,
    };
  },
};
</script>

<style scoped>
.iat-demo {
  max-width: 95%;
  width: 95%;
  margin: 24px auto;
  text-align: left;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
  height: calc(95vh - 120px);
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

.status-item .value.recording {
  color: #52c41a;
}

.status-item .value.recognizing {
  color: #1890ff;
  font-weight: 600;
}

.status-item .value.closed {
  color: #999;
}

.status-item.error {
  color: #ff4d4f;
}

.result {
  background: #f7f9fc;
  border: 1px solid #eef3fb;
  border-radius: 6px;
  padding: 16px;
  min-height: 60px;
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

.result-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.temp-result {
  background: #f0f7ff;
  border: 1px solid #d6e4ff;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.temp-result pre {
  color: #1890ff;
  font-style: italic;
}

.final-result {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
  padding: 12px;
}

.final-result pre {
  color: #52c41a;
  font-weight: 500;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.advanced-params {
  max-height: calc(95vh - 400px);
}

.iat-demo-content {
  flex: 1;
  padding-right: 8px;
  min-height: 0;
}

@media (max-width: 768px) {
  .iat-demo {
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

  .button-group {
    flex-direction: column;
  }

  button {
    min-width: auto;
  }
}
</style>
