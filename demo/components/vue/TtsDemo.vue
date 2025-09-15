<template>
  <div class="vue-panel tts-demo">
    <h2>在线语音合成 (TTS)</h2>
    <p class="description">
      支持将文本转换为语音，支持多种音频格式和发音人。内置自动播放功能。
    </p>
    <div class="tts-demo-content">

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

    <!-- 合成文本 -->
    <div class="demo-section">
      <h3 class="demo-section-title">合成文本</h3>
      <div class="form-group">
        <label for="text">待合成文本</label>
        <textarea
          id="text"
          v-model="text"
          rows="4"
          placeholder="请输入要合成的文本"
        ></textarea>
        <div class="hint">支持中英文混合，建议单次不超过500字符</div>
      </div>
    </div>

    <!-- 音频参数 -->
    <div class="demo-section audio-params">
      <h3 class="demo-section-title">音频参数</h3>
      <div class="grid">
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
    </div>

    <!-- 控制按钮 -->
    <div class="demo-section">
      <h3 class="demo-section-title">操作控制</h3>
      <div class="button-group">
        <button
          class="demo-button primary"
          :disabled="loading || status === 'connecting'"
          @click="speak"
        >
          {{ loading ? "合成中..." : "开始合成并播放" }}
        </button>
        <button
          class="demo-button secondary"
          :disabled="!loading"
          @click="stop"
        >
          停止
        </button>
        <button class="demo-button secondary" @click="requestAutoplay">
          恢复自动播放
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
        <div v-if="error" class="status-item error">
          <span class="label">错误：</span>
          <span class="value">{{ error }}</span>
        </div>
        <div
          v-if="status === 'playing' || status === 'open'"
          class="status-item"
        >
          <span class="label">音频电平：</span>
          <div class="level-display">
            <div class="level-bar">
              <div class="level-fill" :style="{ width: level + '%' }"></div>
            </div>
            <span class="level-text">{{ level }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 日志信息 -->
    <div class="demo-section">
      <h3 class="demo-section-title">操作日志</h3>
      <div class="logs">
        <div v-if="logs.length === 0" class="empty">暂无日志</div>
        <div v-else class="log-list">
          <div v-for="(log, index) in logs" :key="index" class="log-item">
            {{ log }}
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount, watch, onMounted } from "vue";
import { useTts, getSharedAudioContext } from "xfyun-webapi-sdk/vue";
import { checkServiceHealth } from "../utils/health";
import { appendLog, safePublishLog } from "./logUtils";

export default {
  name: "TtsDemo",
  props: {
    serverBase: {
      type: String,
      default: ""
    },
    authToken: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const serverBase = ref(props.serverBase);
    const authToken = ref(props.authToken);

    const text = ref("欢迎使用科大讯飞在线语音合成。");
    const aue = ref("raw");
    const vcn = ref("x4_yezi");
    const speed = ref(50);
    const volume = ref(60);
    const pitch = ref(50);

    const level = ref(0);
    const healthLoading = ref(false);
    const healthMsg = ref("");
    const logs = ref([]);

    /**
     * 组件内追加日志并广播到悬浮日志面板。
     * @param {string} m 日志文本
     */
    const addLog = (m) => {
      appendLog(logs, m);
      safePublishLog("TTS", "info", m);
    };

    // 创建动态业务参数对象
    const getBusinessParams = () => ({
      aue: aue.value,
      vcn: vcn.value,
      speed: speed.value,
      volume: volume.value,
      pitch: pitch.value,
    });

    // 创建TTS选项对象，支持动态更新
    const ttsOptions = ref({
      serverBase: serverBase.value,
      getAuthCode: () => authToken.value,
      business: getBusinessParams(), // 初始参数
      autoplay: true, // 启用内置自动播放，但确保不会双重播放
      mp3Playback: "mse", // 启用MP3播放
      onLevel: (lv) => {
        level.value = Math.max(0, Math.min(100, Math.round(lv || 0)));
      },
      onComplete: () => {
        addLog("TTS音频播放完成");
        loading.value = false; // 确保加载状态被重置
      },
      onLog: (lvl, payload) => {
        try {
          safePublishLog(
            "TTS",
            lvl,
            payload?.message || payload?.event || "event",
            payload,
          );
        } catch (e) {
          console.warn("[TTS] onLog handle failed", e);
        }
      },
    });

    // 创建TTS Hook，使用动态业务参数
    const {
      status,
      error,
      speak,
      stop: ttsStop,
      forceRecreate,
    } = useTts(ttsOptions.value);

    // 监听参数变化，更新TTS选项并强制重新创建客户端
    watch([aue, vcn, speed, volume, pitch], () => {
      // 更新TTS选项中的业务参数
      ttsOptions.value.business = getBusinessParams();

      addLog(
        `TTS参数已更新: 发音人=${vcn.value}, 音频格式=${aue.value}, 语速=${speed.value}, 音量=${volume.value}, 音调=${pitch.value}`,
      );

      // 强制停止当前播放并重新创建客户端
      try {
        ttsStop();
        forceRecreate(); // 使用新的强制重新创建方法
        addLog("TTS客户端已强制重新创建，新参数将在下次合成时生效");
      } catch (e) {
        addLog(`重新创建TTS客户端失败: ${(e && e.message) || e}`);
      }
    });

    const loading = ref(false);

    async function speakAction() {
      if (loading.value) return;

      // 先停止之前的播放，避免重叠
      try {
        ttsStop();
        addLog("已停止之前的TTS播放");
      } catch (e) {
        // 忽略停止错误
      }

      error.value && (error.value = null);
      loading.value = true;

      // 记录当前使用的参数
      const currentParams = getBusinessParams();
      addLog(
        `开始TTS合成: "${text.value.substring(0, 50)}${text.value.length > 50 ? "..." : ""}"`,
      );
      addLog(
        `使用参数: 发音人=${currentParams.vcn}, 音频格式=${currentParams.aue}, 语速=${currentParams.speed}, 音量=${currentParams.volume}, 音调=${currentParams.pitch}`,
      );

      try {
        await speak(text.value);
        addLog("TTS合成请求已发送");
      } catch (e) {
        addLog(`TTS合成失败: ${(e && e.message) || e}`);
        console.warn("tts speak error", e);
        loading.value = false;
      }
    }

    function stop() {
      try {
        addLog("停止TTS合成");
        ttsStop();
        addLog("TTS合成已停止");
      } catch (e) {
        addLog(`停止TTS失败: ${(e && e.message) || e}`);
        console.warn("tts stop error", e);
      }
    }

    async function requestAutoplay() {
      try {
        addLog("尝试恢复音频自动播放");
        const ctx = getSharedAudioContext(16000);
        if (ctx && ctx.state === "suspended") {
          await ctx.resume();
          addLog("AudioContext已恢复");
        }
        // 兼容外部按钮复用
        try {
          window.__AUDIO_GESTURE__ = async () => {
            try {
              await ctx.resume();
              addLog("通过手势恢复AudioContext");
            } catch (err) {
              addLog(
                `手势恢复AudioContext失败: ${(err && err.message) || err}`,
              );
              console.warn("resume failed", err);
            }
          };
        } catch (err) {
          addLog(`设置手势钩子失败: ${(err && err.message) || err}`);
          console.warn("gesture hook failed", err);
        }
      } catch (e) {
        addLog(`恢复自动播放失败: ${(e && e.message) || e}`);
        console.warn("requestAutoplay error", e);
      }
    }

    onBeforeUnmount(stop);

    // 进入页面后自动播放
    onMounted(() => {
      if (text.value && text.value.trim()) {
        const timer = setTimeout(() => {
          speakAction();
        }, 0);
        // 避免潜在的计时器泄露
        onBeforeUnmount(() => clearTimeout(timer));
      }
    });

    async function checkHealth() {
      try {
        healthLoading.value = true;
        healthMsg.value = "";
        addLog("开始TTS服务健康检查");
        const r = await checkServiceHealth(serverBase.value, 'tts', authToken.value);
        if (r.ok) {
          const msg = `TTS服务：OK (${r.status || ""}) @ ${r.endpoint || ""}`;
          healthMsg.value = msg;
          addLog(msg);
        } else {
          const msg = `TTS服务：失败 ${r.status || ""} ${r.error || ""}`;
          healthMsg.value = msg;
          addLog(msg);
        }
      } catch (e) {
        const msg = `健康检查异常：${(e && e.message) || e}`;
        healthMsg.value = msg;
        addLog(msg);
      } finally {
        healthLoading.value = false;
      }
    }

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
      loading,
      level,
      logs,
      speak: speakAction,
      stop,
      requestAutoplay,
      healthLoading,
      healthMsg,
      checkHealth,
    };
  },
};
</script>

<style scoped>
.tts-demo {
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
  min-width: 80px;
}

.status-item .value {
  color: #333;
  font-family: monospace;
  font-size: 13px;
}

.status-item .value.connecting {
  color: #1890ff;
}

.status-item .value.playing {
  color: #52c41a;
}

.status-item .value.closed {
  color: #999;
}

.status-item.error {
  color: #ff4d4f;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.audio-params {
  max-height: calc(95vh - 400px);
}

.tts-demo-content {
  flex: 1;
  padding-right: 8px;
  min-height: 0;
}

.logs {
  background: #f7f9fc;
  border: 1px solid #eef3fb;
  border-radius: 6px;
  padding: 16px;
  max-height: 300px;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-item {
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  padding: 4px 8px;
  background: #fff;
  border-radius: 4px;
  border-left: 3px solid #1890ff;
  word-break: break-word;
}

@media (max-width: 768px) {
  .tts-demo {
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
