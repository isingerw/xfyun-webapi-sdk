<template>
  <div id="app">
    <div class="tabs">
      <button :class="{ active: tab === 'iat' }" @click="tab = 'iat'">
        语音听写 (IAT)
      </button>
      <button :class="{ active: tab === 'tts' }" @click="tab = 'tts'">
        在线语音合成 (TTS)
      </button>
      <button
        :class="{ active: tab === 'tts-streaming' }"
        @click="tab = 'tts-streaming'"
      >
        流式语音合成
      </button>
      <button :class="{ active: tab === 'rtasr' }" @click="tab = 'rtasr'">
        实时语音转写 (RTASR)
      </button>
      <button :class="{ active: tab === 'dts' }" @click="tab = 'dts'">
        长文本语音合成 (DTS)
      </button>
    </div>
    <div class="panel">
      <IatDemo
        v-if="tab === 'iat'"
        :server-base="globalConfig.serverBase"
        :auth-token="globalConfig.authToken"
      />
      <TtsDemo
        v-else-if="tab === 'tts'"
        :server-base="globalConfig.serverBase"
        :auth-token="globalConfig.authToken"
      />
      <TtsStreamingDemo
        v-else-if="tab === 'tts-streaming'"
        :server-base="globalConfig.serverBase"
        :auth-token="globalConfig.authToken"
      />
      <RtasrDemo
        v-else-if="tab === 'rtasr'"
        :server-base="globalConfig.serverBase"
        :auth-token="globalConfig.authToken"
      />
      <DtsDemo
        v-else-if="tab === 'dts'"
        :server-base="globalConfig.serverBase"
        :auth-token="globalConfig.authToken"
      />
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import IatDemo from "./IatDemo.vue";
import TtsDemo from "./TtsDemo.vue";
import TtsStreamingDemo from "./TtsStreamingDemo.vue";
import RtasrDemo from "./RtasrDemo.vue";
import DtsDemo from "./DtsDemo.vue";
import { checkServiceHealth } from "../utils/health";

export default {
  name: "App",
  components: {
    IatDemo,
    TtsDemo,
    TtsStreamingDemo,
    RtasrDemo,
    DtsDemo,
  },
  setup() {
    const tab = ref("iat");
    const healthLoading = ref(false);
    const healthStatus = ref("");

    const globalConfig = ref({
      serverBase: "http://127.0.0.1:8083",
      authToken: "bkNFSXdrdGtaUkNvcFdtbTNIUURPZW8xbXFRaXp2aUV0RUxkcEsrdkFXRFFuSjRwM2M0bk5zT2VYTnNDWEhNNXZRNUErSGFhSHduREZZUGpmN2xuTGpMbVJVZkpXRHJoNXRYK2YzNnREemE4VDFoM01KTjlYbTVwajVyaC9IVG9YeHE2RkxYUUQ0c0pVdnQydWJXYmtuRGhCNWhqUDB5UmQxdE9SODV6bDhVQXp3aGRKZGVUejJhVDhXcDMvWUdPWnhUWERDcXl2L0Y2eXBDUGpseWtOWjJDM24wc0pVMS9heWRqL0EzQk56Ykx6dlVKeUc2N0VMV2N4TUQya2RDam5wZnF0bUFsYWFwN3lkMitlN3NUSS9FWlJVSXRidzM2K2t3enZVK2x1TUs5VFBNRlY0cjVoZFEyZEMyaitDN3hudXJNRC9jUzBCWW44K3dJSDA0WVF6K1J0ZU5yZkJNU3JZTXQrMjZvaVZyejVoamMwSWg1WVJTN0NPRFFlVTVyTG5PKzcvNjQ5bG9TVlFUbUFTbFpXYWkxK3JBU0NPMHlvZEJKSFd6cDEySGEzc3UwZkQwcXFwZVBYLzdtejVSZ1dTOENpNUw4QUFFTTh3ZUpJenozMW5zbGZoeDk3WXZ1WEZwb01HMHpodWdWV05zZEllVGQ1TE02TWRFWk1FUXVzK2dGTGp4cVRHbGgzRWlDM1dlKzc4Y1BjcmFMU0tWTGk3VXBpR1NMdUIzbnl0VW1wV1hkQ3BVNW52MGJKOGJMVFpqaWRPMlFkMFBWdjdjU0JBU0dHSmg0WmpZb3pzeTZjQUtPK3lMYVgxR2xjeVBHTmt2Zmo4N2VHM2ZTdWMxbEtwa3ZGNmIxaWJIbDZWb2orWmVNOStuZy9QRW5nNVY3MGt4R1V2K1Rnc1U9.S2RXRnJkcXE3YzM4STUwa3RaMjZzRmFONlROVFpFRDBsMWsxdVdCNnpFL0M2Z1VSQkExZDJ3bVlhdHhBanJpWkNCTXZBcXZOV3VnK3BvY0tva2N2SHQ1Njlhek5WMnNKbS9URjBYQmR5Vmd4OW1YN0pGRDFQb0JZNHpDUnVJWFplSnVIejkzdVhkVUYvM0VWY21FUVRJdGFsQm9qWC96RUU5TVpYVi9FQWJUUFdrY2phbldrSHEwR2tWTW5qVUEvVytWTVhIV1dCS0ZZZkZjNlRRT3M0SjhRbWdlM0lTSWhnVzBzMU1jQms0TlFhTDJEVG9LSHVDekk4cEk3a3prS1JZOTVZbE56VEVkaitQQkRjeVgwVWdESU9xY0tYWDd0OWFvT3pOTllPMXhId1JyTFEvT2VQTGttMDBsRll3TGdMeDl4U2FrY2dUc1VWSkF2b1VKcER3PT0="
    });

    // 检查所有服务的健康状态
    async function checkAllHealth() {
      if (!globalConfig.value.serverBase) {
        healthStatus.value = "请先配置服务地址";
        return;
      }

      healthLoading.value = true;
      healthStatus.value = "";

      const services = [
        { name: "IAT", type: "iat" },
        { name: "TTS", type: "tts" },
        { name: "RTASR", type: "rtasr" },
        { name: "DTS创建", type: "dts-create" },
        { name: "DTS查询", type: "dts-query" }
      ];

      const results = [];
      for (const service of services) {
        try {
          const result = await checkServiceHealth(
            globalConfig.value.serverBase,
            service.type,
            globalConfig.value.authToken
          );
          results.push({
            name: service.name,
            ok: result.ok,
            status: result.status,
            error: result.error
          });
        } catch (e) {
          results.push({
            name: service.name,
            ok: false,
            error: e.message || e
          });
        }
      }

      const successCount = results.filter(r => r.ok).length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        healthStatus.value = `所有服务正常 (${successCount}/${totalCount})`;
      } else {
        const failed = results.filter(r => !r.ok);
        healthStatus.value = `部分服务异常 (${successCount}/${totalCount}): ${failed.map(f => f.name).join(", ")}`;
      }

      healthLoading.value = false;
    }

    return {
      tab,
      globalConfig,
      healthLoading,
      healthStatus,
      checkAllHealth
    };
  }
};
</script>

<style>
#app,
button,
input,
select,
textarea {
  box-sizing: border-box;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
  max-width: 95%;
  margin-left: auto;
  margin-right: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs {
  margin: 20px auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(23, 99, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.tabs button {
  padding: 10px 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-sizing: border-box;
  color: #4a5568;
  position: relative;
  overflow: hidden;
  min-width: 70px;
}

.tabs button::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1763ff, #4096ff);
  opacity: 0;
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(23, 99, 255, 0.3);
}

.tabs button:hover {
  color: #1763ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(23, 99, 255, 0.2);
}

.tabs button:hover::before {
  opacity: 0.1;
}

.tabs button.active {
  color: white !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(23, 99, 255, 0.4);
  position: relative;
  z-index: 2;
}

.tabs button.active::before {
  opacity: 1;
  z-index: -1;
}

/* 强制设置选中按钮的文字颜色，覆盖所有可能的状态 */
.tabs button.active,
.tabs button.active:hover,
.tabs button.active:focus,
.tabs button.active:active,
.tabs button.active:visited {
  color: white !important;
  -webkit-text-fill-color: white !important;
  -webkit-text-stroke-color: white !important;
  text-fill-color: white !important;
  text-stroke-color: white !important;
}

/* 使用更高优先级的选择器 */
div#app div.tabs button.active {
  color: white !important;
  -webkit-text-fill-color: white !important;
}

.panel {
  margin-top: 16px;
  padding: 0;
  width: 100%;
  flex: 1;
}

/* 全局配置面板样式 */
.global-config {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.global-config h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e6f7ff;
  padding-bottom: 8px;
}

.config-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: end;
}

.config-form .form-group {
  margin-bottom: 0;
}

.config-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.config-form input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.config-form input:focus {
  outline: none;
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
}

.config-button {
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid #1677ff;
  background: #1677ff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.config-button:hover:not(:disabled) {
  background: #4096ff;
  border-color: #4096ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
}

.config-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.health-status {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
}

@media (max-width: 768px) {
  .config-form {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .config-button {
    width: 100%;
  }
}
</style>
