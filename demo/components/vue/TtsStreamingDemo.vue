<template>
  <div class="vue-panel tts-streaming-demo">
    <h2>流式语音合成</h2>
    <p class="description">
      支持流式文本输入，实时合成语音。支持逐段文本输入、实时播放、暂停恢复等功能。
    </p>
    <div class="tts-streaming-demo-content">

    <!-- 基础配置 -->
    <DemoSection title="基础配置">
      <div class="form-grid">
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
      </div>
      <div class="button-group">
        <DemoButton
          type="secondary"
          :loading="healthLoading"
          @click="checkHealth"
        >
          {{ healthLoading ? "检查中..." : "签名健康检查" }}
        </DemoButton>
        <div v-if="healthMsg" class="hint">{{ healthMsg }}</div>
      </div>
    </DemoSection>

    <!-- 音频参数 -->
    <DemoSection title="音频参数">
      <div class="form-grid">
        <div class="form-group">
          <label for="aue">音频编码</label>
          <select id="aue" v-model="aue">
            <option value="raw">PCM - 原始音频</option>
            <option value="mp3">MP3 - 压缩音频</option>
          </select>
          <div class="hint">选择音频输出格式</div>
        </div>
        <div class="form-group">
          <label for="vcn">发音人</label>
          <select id="vcn" v-model="vcn">
            <option value="x4_xiaoyan">讯飞小燕 (普通话)</option>
            <option value="x4_yezi">讯飞小露 (普通话)</option>
            <option value="aisjiuxu">讯飞许久 (普通话)</option>
            <option value="aisjinger">讯飞小婧 (普通话)</option>
            <option value="aisbabyxu">讯飞许小宝 (普通话)</option>
          </select>
          <div class="hint">选择发音人，不同发音人有不同的音色特点</div>
        </div>
        <div class="form-group">
          <label for="speed">语速</label>
          <input
            id="speed"
            v-model.number="speed"
            type="number"
            min="0"
            max="100"
            placeholder="50"
          />
          <div class="hint">语速范围：0-100，50为正常语速</div>
        </div>
        <div class="form-group">
          <label for="volume">音量</label>
          <input
            id="volume"
            v-model.number="volume"
            type="number"
            min="0"
            max="100"
            placeholder="60"
          />
          <div class="hint">音量范围：0-100，60为正常音量</div>
        </div>
        <div class="form-group">
          <label for="pitch">音调</label>
          <input
            id="pitch"
            v-model.number="pitch"
            type="number"
            min="0"
            max="100"
            placeholder="50"
          />
          <div class="hint">音调范围：0-100，50为正常音调</div>
        </div>
      </div>
    </DemoSection>

    <!-- 流式文本输入 -->
    <DemoSection title="流式文本输入">
      <div class="form-group">
        <label for="text">待合成文本</label>
        <textarea
          id="text"
          v-model="text"
          rows="4"
          placeholder="请输入要合成的文本，支持分段输入"
        ></textarea>
        <div class="hint">支持中英文混合，可以分段输入进行流式合成</div>
      </div>
      <div class="button-group">
        <DemoButton
          type="primary"
          :disabled="!isConnected || !text.trim()"
          @click="appendText"
        >
          追加文本
        </DemoButton>
        <DemoButton type="secondary" :disabled="!isConnected" @click="endText">
          结束文本输入
        </DemoButton>
      </div>
    </DemoSection>

    <!-- 控制按钮 -->
    <DemoSection title="操作控制">
      <div class="button-group">
        <DemoButton
          type="primary"
          :disabled="status !== 'idle'"
          @click="startStreaming"
        >
          开始流式合成
        </DemoButton>
        <DemoButton type="secondary" :disabled="!isPlaying" @click="pause">
          暂停播放
        </DemoButton>
        <DemoButton
          type="secondary"
          :disabled="status !== 'paused'"
          @click="resume"
        >
          恢复播放
        </DemoButton>
        <DemoButton
          type="danger"
          :disabled="status === 'idle'"
          @click="stopStreaming"
        >
          停止合成
        </DemoButton>
      </div>
    </DemoSection>

    <!-- 状态信息 -->
    <DemoSection title="状态信息">
      <div class="status">
        <div class="status-item">
          <span class="label">状态：</span>
          <span class="value" :class="status">{{ status }}</span>
        </div>
        <div class="status-item">
          <span class="label">连接状态：</span>
          <span class="value" :class="{ connected: isConnected }">
            {{ isConnected ? "已连接" : "未连接" }}
          </span>
        </div>
        <div class="status-item">
          <span class="label">播放状态：</span>
          <span class="value" :class="{ playing: isPlaying }">
            {{ isPlaying ? "播放中" : "未播放" }}
          </span>
        </div>
        <div v-if="currentText" class="status-item">
          <span class="label">当前文本：</span>
          <span class="value">{{ currentText }}</span>
        </div>
        <div v-if="error" class="status-item error">
          <span class="label">错误：</span>
          <span class="value">{{ error }}</span>
        </div>
      </div>
    </DemoSection>

    <!-- 日志信息 -->
    <DemoSection title="操作日志">
      <div class="logs">
        <div v-if="logs.length === 0" class="empty">暂无日志</div>
        <div v-else class="log-list">
          <div v-for="(log, index) in logs" :key="index" class="log-item">
            {{ log }}
          </div>
        </div>
      </div>
    </DemoSection>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount, watch } from "vue";
import { useStreamingTts } from "xfyun-webapi-sdk/vue";
import { useDemoConfig } from "./shared/useDemoConfig.js";
import { useLogging } from "./shared/useLogging.js";
import { checkServiceHealth } from "../utils/health";
import DemoSection from "./shared/DemoSection.vue";
import DemoButton from "./shared/DemoButton.vue";

export default {
  name: "TtsStreamingDemo",
  components: {
    DemoSection,
    DemoButton,
  },
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
    // 使用传入的配置
    const serverBase = ref(props.serverBase);
    const authToken = ref(props.authToken);
    const getAuthCode = () => authToken.value;
    
    // 健康检查相关
    const healthLoading = ref(false);
    const healthMsg = ref("");
    
    async function checkHealth() {
      try {
        healthLoading.value = true;
        healthMsg.value = "";
        const r = await checkServiceHealth(serverBase.value, 'tts', authToken.value);
        if (r.ok) {
          const m = `TTS流式服务：OK (${r.status || ""}) @ ${r.endpoint || ""}`;
          healthMsg.value = m;
          addLog(m);
        } else {
          const m = `TTS流式服务：失败 ${r.status || ""} ${r.error || ""}`;
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

    // 使用共享日志
    const { logs, addLog } = useLogging("TTS-Streaming");

    const text = ref(
      "欢迎使用科大讯飞流式语音合成。这是一个流式TTS演示，支持逐段文本输入。",
    );
    const aue = ref("raw");
    const vcn = ref("x4_yezi");
    const speed = ref(50);
    const volume = ref(60);
    const pitch = ref(50);

    // 创建动态业务参数对象
    const getBusinessParams = () => ({
      aue: aue.value,
      vcn: vcn.value,
      speed: speed.value,
      volume: volume.value,
      pitch: pitch.value,
    });

    // 创建StreamingTTS选项对象
    const streamingTtsOptions = ref({
      serverBase: serverBase.value,
      getAuthCode: () => authToken.value,
      business: getBusinessParams(),
      autoplay: true,
      mp3Playback: "mse",
      onTextReceived: (text) => {
        addLog(`收到文本: ${text}`);
      },
      onAudioReceived: (audio) => {
        addLog(`收到音频数据: ${audio.length} bytes`);
      },
      onPlaying: (playing) => {
        addLog(`播放状态变化: ${playing ? "播放中" : "已停止"}`);
      },
      onComplete: () => {
        addLog("流式TTS合成完成");
      },
      onError: (error) => {
        addLog(`流式TTS错误: ${error}`);
      },
      onLog: (lvl, payload) => {
        try {
          safePublishLog(
            "TTS-Streaming",
            lvl,
            payload?.message || payload?.event || "event",
            payload,
          );
        } catch (e) {
          console.warn("[TTS-Streaming] onLog handle failed", e);
        }
      },
    });

    // 创建StreamingTTS Hook
    const {
      status,
      error,
      start,
      appendText: appendTextFn,
      endText,
      pause,
      resume,
      stop: stopStreaming,
      isConnected,
      isPlaying,
      currentText,
    } = useStreamingTts(streamingTtsOptions.value);

    // 监听参数变化，更新StreamingTTS选项
    watch([aue, vcn, speed, volume, pitch], () => {
      streamingTtsOptions.value.business = getBusinessParams();
      addLog(
        `流式TTS参数已更新: 发音人=${vcn.value}, 音频格式=${aue.value}, 语速=${speed.value}, 音量=${volume.value}, 音调=${pitch.value}`,
      );
    });

    async function startStreaming() {
      try {
        addLog("开始流式TTS合成");
        await start();
        addLog("流式TTS连接已建立");
      } catch (e) {
        addLog(`启动流式TTS失败: ${(e && e.message) || e}`);
      }
    }

    function appendText() {
      if (!text.value.trim()) {
        addLog("文本为空，无法追加");
        return;
      }

      try {
        addLog(`追加文本: "${text.value}"`);
        appendTextFn(text.value);
        text.value = ""; // 清空输入框
      } catch (e) {
        addLog(`追加文本失败: ${(e && e.message) || e}`);
      }
    }

    function endTextInput() {
      try {
        addLog("结束文本输入");
        endText();
      } catch (e) {
        addLog(`结束文本输入失败: ${(e && e.message) || e}`);
      }
    }

    function pausePlayback() {
      try {
        addLog("暂停播放");
        pause();
      } catch (e) {
        addLog(`暂停播放失败: ${(e && e.message) || e}`);
      }
    }

    function resumePlayback() {
      try {
        addLog("恢复播放");
        resume();
      } catch (e) {
        addLog(`恢复播放失败: ${(e && e.message) || e}`);
      }
    }

    function stopStreamingTts() {
      try {
        addLog("停止流式TTS合成");
        stopStreaming();
        addLog("流式TTS合成已停止");
      } catch (e) {
        addLog(`停止流式TTS失败: ${(e && e.message) || e}`);
      }
    }

    onBeforeUnmount(() => {
      if (isConnected.value) {
        stopStreaming();
      }
    });

    return {
      serverBase,
      authToken,
      text,
      aue,
      vcn,
      speed,
      volume,
      pitch,
      status,
      error,
      isConnected,
      isPlaying,
      currentText,
      logs,
      startStreaming,
      appendText,
      endText: endTextInput,
      pause: pausePlayback,
      resume: resumePlayback,
      stopStreaming: stopStreamingTts,
      healthLoading,
      healthMsg,
      checkHealth,
    };
  },
};
</script>

<style scoped>
.tts-streaming-demo {
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

.tts-streaming-demo-content {
  flex: 1;
  padding-right: 8px;
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.status {
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 0;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-item .label {
  font-weight: 600;
  color: #374151;
  min-width: 100px;
  font-size: 14px;
}

.status-item .value {
  color: #1f2937;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  font-size: 14px;
  font-weight: 500;
}

.status-item .value.connecting {
  color: #3b82f6;
}

.status-item .value.playing {
  color: #10b981;
}

.status-item .value.connected {
  color: #10b981;
}

.status-item .value.closed {
  color: #6b7280;
}

.status-item.error {
  color: #ef4444;
}

.logs {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  max-height: 400px;
  margin-top: 20px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  border-left: 4px solid #667eea;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty {
  color: #9ca3af;
  font-style: italic;
  text-align: center;
  padding: 40px;
  font-size: 16px;
}

@media (max-width: 768px) {
  .tts-streaming-demo {
    margin: 12px;
    padding: 16px;
    max-width: 98%;
    width: 98%;
    overflow-y: auto
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .button-group {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .status-item .label {
    min-width: auto;
  }

  .logs {
    max-height: 300px;
  }
}
</style>
