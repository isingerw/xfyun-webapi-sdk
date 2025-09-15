/**
 * 共享的Demo配置Hook
 * 减少代码冗余，统一管理配置
 */
import { ref, computed } from "vue";

// 默认配置
const DEFAULT_CONFIG = {
  serverBase: "http://127.0.0.1:8083",
  authToken:
    "bkNFSXdrdGtaUkNvcFdtbTNIUURPZW8xbXFRaXp2aUV0RUxkcEsrdkFXRFFuSjRwM2M0bk5zT2VYTnNDWEhNNXZRNUErSGFhSHduREZZUGpmN2xuTGpMbVJVZkpXRHJoNXRYK2YzNnREemE4VDFoM01KTjlYbTVwajVyaC9IVG9YeHE2RkxYUUQ0c0pVdnQydWJXYmtuRGhCNWhqUDB5UmQxdE9SODV6bDhVQXp3aGRKZGVUejJhVDhXcDMvWUdPWnhUWERDcXl2L0Y2eXBDUGpseWtOWjJDM24wc0pVMS9heWRqL0EzQk56Ykx6dlVKeUc2N0VMV2N4TUQya2RDam5wZnF0bUFsYWFwN3lkMitlN3NUSS9FWlJVSXRidzM2K2t3enZVK2x1TUs5VFBNRlY0cjVoZFEyZEMyaitDN3hudXJNRC9jUzBCWW44K3dJSDA0WVF6K1J0ZU5yZkJNU3JZTXQrMjZvaVZyejVoamMwSWg1WVJTN0NPRFFlVTVyTG5PKzcvNjQ5bG9TVlFUbUFTbFpXYWkxK3JBU0NPMHlvZEJKSFd6cDEySGEzc3UwZkQwcXFwZVBYLzdtejVSZ1dTOENpNUw4QUFFTTh3ZUpJenozMW5zbGZoeDk3WXZ1WEZwb01HMHpodWdWV05zZEllVGQ1TE02TWRFWk1FUXVzK2dGTGp4cVRHbGgzRWlDM1dlKzc4Y1BjcmFMU0tWTGk3VXBpR1NMdUIzbnl0VW1wV1hkQ3BVNW52MGJKOGJMVFpqaWRPMlFkMFBWdjdjU0JBU0dHSmg0WmpZb3pzeTZjQUtPK3lMYVgxR2xjeVBHTmt2Zmo4N2VHM2ZTdWMxbEtwa3ZGNmIxaWJIbDZWb2orWmVNOStuZy9QRW5nNVY3MGt4R1V2K1Rnc1U9.S2RXRnJkcXE3YzM4STUwa3RaMjZzRmFONlROVFpFRDBsMWsxdVdCNnpFL0M2Z1VSQkExZDJ3bVlhdHhBanJpWkNCTXZBcXZOV3VnK3BvY0tva2N2SHQ1Njlhek5WMnNKbS9URjBYQmR5Vmd4OW1YN0pGRDFQb0JZNHpDUnVJWFplSnVIejkzdVhkVUYvM0VWY21FUVRJdGFsQm9qWC96RUU5TVpYVi9FQWJUUFdrY2phbldrSHEwR2tWTW5qVUEvVytWTVhIV1dCS0ZZZkZjNlRRT3M0SjhRbWdlM0lTSWhnVzBzMU1jQms0TlFhTDJEVG9LSHVDekk4cEk3a3prS1JZOTVZbE56VEVkaitQQkRjeVgwVWdESU9xY0tYWDd0OWFvT3pOTllPMXhId1JyTFEvT2VQTGttMDBsRll3TGdMeDl4U2FrY2dUc1VWSkF2b1VKcER3PT0=",
};

// 获取配置值的辅助函数
function getServerBase() {
  return (
    window.__SERVER_BASE__ ||
    localStorage.getItem("serverBase") ||
    DEFAULT_CONFIG.serverBase
  );
}

function getAuthToken() {
  return (
    window.__AUTH_CODE__ ||
    localStorage.getItem("auth") ||
    DEFAULT_CONFIG.authToken
  );
}

export function useDemoConfig() {
  const serverBase = ref(getServerBase());
  const authToken = ref(getAuthToken());
  const healthLoading = ref(false);
  const healthMsg = ref("");

  // 计算属性：获取认证码函数
  const getAuthCode = computed(() => () => authToken.value);

  // 健康检查函数
  const checkHealth = async () => {
    try {
      healthLoading.value = true;
      healthMsg.value = "";

      // 内联健康检查逻辑
      const base = String(serverBase.value || "").replace(/\/$/, "");
      if (!base) {
        healthMsg.value = "健康：serverBase 为空";
        return;
      }

      const candidates = [
        "/api/v1/xfyun/sign/tts",
        "/api/v1/xfyun/sign/rtasr",
        "/api/v1/xfyun/sign/iat",
        "/api/v1/xfyun/sign/dts",
      ];
      const headers = authToken.value
        ? { Authorization: `Bearer ${authToken.value}` }
        : {};

      for (const path of candidates) {
        const url = base + path;
        try {
          const resp = await fetch(url, { method: "GET", headers });
          const contentType = resp.headers.get("content-type") || "";
          let body;
          if (contentType.includes("application/json")) {
            try {
              body = await resp.json();
            } catch (_) {
              body = await resp.text();
            }
          } else {
            body = await resp.text();
          }
          if (resp.ok) {
            healthMsg.value = `健康：OK (${resp.status}) @ ${url}`;
            return;
          }
        } catch (e) {
          // 继续尝试下一个
        }
      }

      healthMsg.value = "健康：所有端点检查失败";
    } catch (error) {
      const msg = `健康检查异常：${error?.message || error}`;
      healthMsg.value = msg;
    } finally {
      healthLoading.value = false;
    }
  };

  return {
    serverBase,
    authToken,
    getAuthCode,
    healthLoading,
    healthMsg,
    checkHealth,
  };
}
