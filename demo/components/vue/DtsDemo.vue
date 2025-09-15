<template>
  <div class="vue-panel dts-demo">
    <h2>长文本语音合成 (DTS)</h2>
    <p class="description">
      支持长文本语音合成，单次可处理10万字符。支持任务创建、查询、等待和下载功能。
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

    <!-- 音频参数 -->
    <div class="demo-section audio-params">
      <h3 class="demo-section-title">音频参数</h3>
      <div class="grid">
        <div class="form-group">
          <label for="aue">音频编码</label>
          <select id="aue" v-model="aue">
            <option value="raw">PCM - 原始音频</option>
            <option value="mp3">MP3 - 压缩音频</option>
            <option value="speex">Speex - 压缩音频</option>
            <option value="opus">Opus - 压缩音频</option>
          </select>
          <div class="hint">选择音频输出格式</div>
        </div>
        <div class="form-group">
          <label for="vcn">发音人</label>
          <select id="vcn" v-model="vcn">
            <option value="x4_yeting">希涵（女声，游戏影视解说）</option>
            <option value="x4_mingge">明哥（男声，阅读听书）</option>
            <option value="x4_pengfei">小鹏（男声，新闻播报）</option>
            <option value="x4_qianxue">千雪（女声，阅读听书）</option>
            <option value="x4_lingbosong">聆伯松（男声，老年，阅读听书）</option>
            <option value="x4_xiuying">秀英（女声，老年，阅读听书）</option>
            <option value="x4_doudou">豆豆（男童，阅读听书）</option>
            <option value="x4_lingxiaoshan_profnews">聆小珊（女声，新闻播报）</option>
            <option value="x4_xiaoguo">小果（女声，新闻播报）</option>
            <option value="x4_xiaozhong">小忠（男声，新闻播报）</option>
            <option value="x4_yezi">小露（女声，通用场景）</option>
            <option value="x4_chaoge">超哥（男声，新闻播报）</option>
            <option value="x4_feidie">飞碟哥（男声，游戏影视解说）</option>
            <option value="x4_lingfeihao_upbeatads">聆飞皓（男声，直播广告）</option>
            <option value="x4_wangqianqian">嘉欣（女声，直播广告）</option>
            <option value="x4_lingxiaozhen_eclives">聆小臻（女声，直播广告）</option>
            <option value="x4_guanyijie">关山-专题（男声，专题片纪录片）</option>
          </select>
          <div class="hint">选择发音人，每种发音人有不同的音色和特点</div>
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
            placeholder="50"
          />
          <div class="hint">音量范围：0-100，50为正常音量</div>
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
        <div class="form-group">
          <label for="bgs">背景音</label>
          <input
            id="bgs"
            v-model.number="bgs"
            type="number"
            min="0"
            max="5"
            placeholder="0"
          />
          <div class="hint">背景音类型：0-5，0为无背景音</div>
        </div>
        <div class="form-group">
          <label for="ttp">拼音标注</label>
          <input
            id="ttp"
            v-model.number="ttp"
            type="number"
            min="0"
            max="1"
            placeholder="0"
          />
          <div class="hint">是否包含拼音标注：0关闭，1开启</div>
        </div>
      </div>
    </div>

    <!-- 合成文本 -->
    <div class="demo-section">
      <h3 class="demo-section-title">合成文本</h3>
      <div class="form-group">
        <label for="text">合成文本</label>
        <textarea
          id="text"
          v-model="text"
          rows="6"
          placeholder="请输入长文本（支持10万字符）"
        ></textarea>
        <div class="hint">支持中英文混合，最大支持10万字符</div>
        <div class="text-counter">文本长度：{{ text.length }} 字符</div>
      </div>
    </div>

    <!-- 轮询配置 -->
    <div class="demo-section">
      <h3 class="demo-section-title">轮询配置</h3>
      <div class="grid">
        <div class="form-group">
          <label for="pollTimeoutMs">轮询超时(ms)</label>
          <input
            id="pollTimeoutMs"
            v-model.number="pollTimeoutMs"
            type="number"
            min="60000"
            placeholder="600000"
          />
          <div class="hint">单次轮询的超时时间，建议600000ms（10分钟）</div>
        </div>
        <div class="form-group">
          <label for="maxPollTimes">最大轮询次数</label>
          <input
            id="maxPollTimes"
            v-model.number="maxPollTimes"
            type="number"
            min="1"
            placeholder="300"
          />
          <div class="hint">最大轮询次数，建议300次</div>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="demo-section">
      <h3 class="demo-section-title">操作控制</h3>
      <div class="button-group">
        <button
          class="demo-button primary"
          :disabled="processing || !text.trim()"
          @click="handleCreateTask"
        >
          {{ processing ? "处理中..." : "创建任务" }}
        </button>
        <button
          class="demo-button secondary"
          :disabled="!taskId"
          @click="handleQueryTask"
        >
          查询状态
        </button>
        <button
          class="demo-button secondary"
          :disabled="!taskId"
          @click="handleWaitTask"
        >
          等待完成
        </button>
        <button
          class="demo-button secondary"
          :disabled="!taskId"
          @click="() => handleDownload('mp3')"
        >
          下载MP3
        </button>
        <button
          class="demo-button secondary"
          :disabled="!taskId"
          @click="() => handleDownload('wav')"
        >
          下载WAV
        </button>
        <button
          class="demo-button secondary"
          :disabled="!taskId"
          @click="() => handleDownload('pcm')"
        >
          下载PCM
        </button>
        <button class="demo-button secondary" @click="handleReset">重置</button>
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
        <div v-if="taskId" class="status-item">
          <span class="label">任务ID：</span>
          <span class="value">{{ taskId }}</span>
        </div>
        <div v-if="processing" class="status-item processing">
          <span class="label">处理状态：</span>
          <span class="value">处理中...</span>
        </div>
        <div v-if="error" class="status-item error">
          <span class="label">错误：</span>
          <span class="value">{{ error }}</span>
        </div>
        <div class="status-item">
          <span class="label">文本长度：</span>
          <span class="value">{{ text.length }} 字符</span>
        </div>
        <div class="status-item">
          <span class="label">发音人：</span>
          <span class="value">{{ getVoiceName(vcn) }}</span>
        </div>
      </div>
    </div>

    <!-- 任务结果 -->
    <div v-if="result" class="demo-section">
      <h3 class="demo-section-title">任务结果</h3>
      <div class="result">
        <pre>{{ formatJson(result) }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from "vue";
import { useDts } from "xfyun-webapi-sdk/vue";
import { appendLog, safePublishLog } from "./logUtils";
import { checkServiceHealth } from "../utils/health";

export default {
  name: "DtsDemo",
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

    const aue = ref("raw");
    const vcn = ref("x4_mingge");
    const speed = ref(50);
    const volume = ref(50);
    const pitch = ref(50);
    const bgs = ref(0);
    const ttp = ref(0);

    const text = ref(
      "长文本语音合成提供了支持单次超大文本（万字级别）进行快速语音合成的功能。",
    );

    const logs = ref([]);
    const healthLoading = ref(false);
    const healthMsg = ref("");
    /**
     * 组件内追加日志并广播到悬浮日志面板。
     * @param {string} m 日志文本
     */
    const addLog = (m) => {
      appendLog(logs, m);
      safePublishLog("DTS", "info", m);
    };

    const pollTimeoutMs = ref(10 * 60 * 1000);
    const maxPollTimes = ref(300);

    const {
      status,
      error,
      taskId,
      result,
      createTask,
      queryTask,
      waitForTask,
      downloadResult,
      reset,
    } = useDts({
      serverBase: serverBase.value,
      getAuthCode: () => authToken.value,
      business: () => ({
        aue: aue.value,
        vcn: vcn.value,
        speed: speed.value,
        volume: volume.value,
        pitch: pitch.value,
        bgs: bgs.value,
        ttp: ttp.value,
      }),
      onTaskCreated: (tid) => {
        taskId.value = tid;
        addLog(`任务创建成功，ID: ${tid}`);
      },
      onTaskCompleted: (r) => {
        result.value = r;
        addLog("任务完成！");
      },
      onError: (msg) => {
        addLog(`错误: ${msg}`);
      },
      pollTimeoutMs: () => pollTimeoutMs.value,
      maxPollTimes: () => maxPollTimes.value,
    });

    const processing = ref(false);

    async function handleCreateTask() {
      if (!text.value.trim()) {
        addLog("请输入要合成的文本");
        return;
      }
      try {
        processing.value = true;
        await createTask(text.value);
        addLog("开始创建DTS任务...");
      } catch (e) {
        console.warn("dts create error", e);
        processing.value = false;
      }
    }

    async function handleQueryTask() {
      if (!taskId.value) return;
      try {
        const r = await queryTask(taskId.value);
        addLog(`查询结果: ${JSON.stringify(r)}`);
      } catch (e) {
        console.warn("dts query error", e);
      }
    }

    async function handleWaitTask() {
      if (!taskId.value) return;
      try {
        addLog("等待任务完成...");
        await waitForTask(taskId.value, 2000);
        addLog("任务已完成");
        processing.value = false;
      } catch (e) {
        console.warn("dts wait error", e);
        processing.value = false;
      }
    }

    async function handleDownload(fmt) {
      if (!taskId.value) {
        addLog("错误: 没有任务ID，请先创建任务");
        return;
      }
      try {
        addLog(`下载结果（${fmt}）...`);
        const blob = await downloadResult(taskId.value, fmt);
        if (!blob) {
          addLog("没有可下载的结果");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dts-result-${taskId.value}.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
        addLog(`下载完成: dts-result-${taskId.value}.${fmt} (${(blob.size / 1024).toFixed(1)} KB)`);
      } catch (e) {
        addLog(`下载错误: ${e instanceof Error ? e.message : "未知错误"}`);
        console.warn("dts download error", e);
      }
    }

    function handleReset() {
      try {
        reset();
      } catch (e) {
        console.warn("dts reset error", e);
      }
      logs.value = [];
      processing.value = false;
    }

    onBeforeUnmount(handleReset);

    async function checkHealth() {
      try {
        healthLoading.value = true;
        healthMsg.value = "";
        const r = await checkServiceHealth(serverBase.value, 'dts-create', authToken.value);
        if (r.ok) {
          const m = `DTS创建服务：OK (${r.status || ""}) @ ${r.endpoint || ""}`;
          healthMsg.value = m;
          addLog(m);
        } else {
          const m = `DTS创建服务：失败 ${r.status || ""} ${r.error || ""}`;
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

    // 发音人名称映射
    const voiceNames = {
      'x4_yeting': '希涵（女声，游戏影视解说）',
      'x4_mingge': '明哥（男声，阅读听书）',
      'x4_pengfei': '小鹏（男声，新闻播报）',
      'x4_qianxue': '千雪（女声，阅读听书）',
      'x4_lingbosong': '聆伯松（男声，老年，阅读听书）',
      'x4_xiuying': '秀英（女声，老年，阅读听书）',
      'x4_doudou': '豆豆（男童，阅读听书）',
      'x4_lingxiaoshan_profnews': '聆小珊（女声，新闻播报）',
      'x4_xiaoguo': '小果（女声，新闻播报）',
      'x4_xiaozhong': '小忠（男声，新闻播报）',
      'x4_yezi': '小露（女声，通用场景）',
      'x4_chaoge': '超哥（男声，新闻播报）',
      'x4_feidie': '飞碟哥（男声，游戏影视解说）',
      'x4_lingfeihao_upbeatads': '聆飞皓（男声，直播广告）',
      'x4_wangqianqian': '嘉欣（女声，直播广告）',
      'x4_lingxiaozhen_eclives': '聆小臻（女声，直播广告）',
      'x4_guanyijie': '关山-专题（男声，专题片纪录片）'
    };

    function getVoiceName(vcn) {
      return voiceNames[vcn] || vcn;
    }

    const business = () => ({
      aue: aue.value,
      vcn: vcn.value,
      speed: speed.value,
      volume: volume.value,
      pitch: pitch.value,
      bgs: bgs.value,
      ttp: ttp.value,
    });

    return {
      serverBase,
      authToken,
      aue,
      vcn,
      speed,
      volume,
      pitch,
      bgs,
      ttp,
      text,
      logs,
      pollTimeoutMs,
      maxPollTimes,
      status,
      error,
      taskId,
      result,
      processing,
      handleCreateTask,
      handleQueryTask,
      handleWaitTask,
      handleDownload,
      handleReset,
      getVoiceName,
      formatJson: (o) => {
        try {
          return JSON.stringify(o, null, 2);
        } catch (e) {
          return String(o);
        }
      },
      business,
      healthLoading,
      healthMsg,
      checkHealth,
    };
  },
};
</script>

<style scoped>
.dts-demo {
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

.demo-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.demo-section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e6f7ff;
  padding-bottom: 8px;
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

.text-counter {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
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
  position: relative;
  overflow: hidden;
}

button.primary {
  background: #1677ff;
  color: white;
  border-color: #1677ff;
}

button.primary:hover:not(:disabled) {
  background: #4096ff;
  border-color: #4096ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
}

button.secondary {
  background: #fff;
  color: #333;
}

button.secondary:hover:not(:disabled) {
  background: #f0f7ff;
  border-color: #91c3ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button:active:not(:disabled) {
  transform: translateY(0);
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

.status-item .value.processing {
  color: #52c41a;
}

.status-item .value.completed {
  color: #52c41a;
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
  min-height: 100px;
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.audio-params {
  max-height: calc(95vh - 400px);
}

@media (max-width: 768px) {
  .dts-demo {
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
